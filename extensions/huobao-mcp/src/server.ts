import { createServer, type IncomingMessage, type ServerResponse } from 'node:http'
import { timingSafeEqual } from 'node:crypto'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import { failure, Fault, Huobao, Ledger, requireValue } from './core.js'
import { Workbench } from './tools.js'

export interface Options {
  dataDir: string; apiBase: string; origins: string[]; publicUrl: string
  timeout?: number; agentTimeout?: number; pollMs?: number
}
const equal = (a: string, b: string) => {
  const left = Buffer.from(a), right = Buffer.from(b)
  return left.length === right.length && timingSafeEqual(left, right)
}
async function jsonBody(req: IncomingMessage) {
  if (!req.headers['content-type']?.startsWith('application/json')) throw new Fault('CONTENT_TYPE', 'Content-Type must be application/json.', 415)
  const chunks: Buffer[] = []; let size = 0
  for await (const chunk of req) {
    size += chunk.length
    if (size > 1024 * 1024) throw new Fault('TOO_LARGE', 'Request exceeds 1 MiB.', 413)
    chunks.push(chunk)
  }
  try { return JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { throw new Fault('INVALID_JSON', 'Invalid JSON.') }
}
function send(res: ServerResponse, status: number, body: unknown) {
  res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  res.end(JSON.stringify(body))
}
export function createExtension(options: Options) {
  const apiBase = options.apiBase.replace(/\/$/, '')
  const upstream = new URL(apiBase), publicUrl = new URL(options.publicUrl)
  requireValue(['http:', 'https:'].includes(upstream.protocol) && !upstream.username && !upstream.password && !upstream.search && !upstream.hash && upstream.pathname === '/api/v1', 'CONFIG', 'HUOBAO_API_BASE_URL must be an HTTP(S) URL ending in /api/v1, without credentials or query.')
  requireValue(['http:', 'https:'].includes(publicUrl.protocol) && !publicUrl.username && !publicUrl.password && !publicUrl.search && !publicUrl.hash, 'CONFIG', 'Invalid public MCP URL.')
  const ledger = new Ledger(options.dataDir, apiBase)
  const api = new Huobao(apiBase, options.timeout, options.agentTimeout)
  const workbench = new Workbench(ledger, api)
  const transports = new Set<StreamableHTTPServerTransport>()
  const origins = new Set(options.origins)
  const allowedHosts = new Set(['localhost', '127.0.0.1', '[::1]', publicUrl.hostname])
  const server = createServer(async (req, res) => {
    try {
      if (ledger.stopping) throw new Fault('STOPPING', 'Extension is shutting down.', 503)
      const host = new URL(`http://${req.headers.host || ''}`).hostname
      if (!allowedHosts.has(host)) throw new Fault('FORBIDDEN_HOST', 'Host is not allowed.', 403)
      const origin = req.headers.origin
      if (origin && !origins.has(origin)) throw new Fault('FORBIDDEN_ORIGIN', 'Origin is not allowed.', 403)
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin')
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, MCP-Protocol-Version, MCP-Session-Id')
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      }
      if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return }
      const path = new URL(req.url || '/', 'http://extension').pathname.replace(/^\/mcp-extension(?=\/)/, '')
      if (path === '/health' && req.method === 'GET') { send(res, 200, { status: 'ok', service: 'huobao-mcp' }); return }
      if (path === '/mcp') {
        const auth = req.headers.authorization || ''
        if (!equal(auth, `Bearer ${ledger.state.clientToken}`)) throw new Fault('UNAUTHORIZED', 'Valid MCP bearer token required.', 401)
        ledger.gate()
        const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true })
        transports.add(transport)
        const mcp = workbench.server()
        res.on('close', () => { transports.delete(transport); void mcp.close() })
        await mcp.connect(transport)
        const body = req.method === 'POST' ? await jsonBody(req) : undefined
        await transport.handleRequest(req, res, body)
        return
      }
      if (!path.startsWith('/control/')) throw new Fault('NOT_FOUND', 'Not found.', 404)
      // The control panel requires no pairing or session; retain browser Origin checks for writes.
      if (req.method !== 'GET' && (!origin || !origins.has(origin))) throw new Fault('CSRF', 'Allowed Origin required.', 403)
      if (path === '/control/status' && req.method === 'GET') {
        let health = 'unreachable'
        try { health = (await api.call('/health')).status === 'ok' ? 'ok' : 'invalid' } catch {}
        send(res, 200, { enabled: ledger.state.enabled, revision: ledger.state.revision, upstream: apiBase, upstream_health: health, mcp_url: options.publicUrl, running: Object.values(ledger.state.runs).filter(r => ['running', 'paused', 'needs_attention'].includes(r.status)).length })
      } else if (path === '/control/enabled' && req.method === 'PUT') {
        const body = z.object({ enabled: z.boolean(), expected_revision: z.number().int().min(0) }).strict().parse(await jsonBody(req))
        if (body.enabled) { const health = await api.call('/health'); requireValue(health.status === 'ok', 'UPSTREAM_UNAVAILABLE', 'Backend health check failed.') }
        if (ledger.stopping) throw new Fault('STOPPING', 'Extension is shutting down.', 503)
        if (body.expected_revision !== ledger.state.revision) throw new Fault('REVISION_CONFLICT', 'Switch changed in another window. Refresh status.', 409)
        ledger.state.enabled = body.enabled; ledger.state.revision++
        if (!body.enabled) for (const run of Object.values(ledger.state.runs)) if (run.status === 'running') run.status = 'paused'
        ledger.save()
        send(res, 200, { enabled: ledger.state.enabled, revision: ledger.state.revision })
      } else if (path === '/control/client-config' && req.method === 'POST') {
        await jsonBody(req)
        send(res, 200, { transport: 'streamable-http', url: options.publicUrl, headers: { Authorization: `Bearer ${ledger.state.clientToken}` } })
      } else if (path === '/control/runs' && req.method === 'GET') {
        const runs = Object.values(ledger.state.runs).slice(-50).reverse()
        send(res, 200, { runs })
      } else if (/^\/control\/runs\/[^/]+\/resume$/.test(path) && req.method === 'POST') {
        await jsonBody(req); send(res, 200, workbench.production.control(path.split('/')[3], 'resume'))
      } else throw new Fault('NOT_FOUND', 'Control route not found.', 404)
    } catch (e) {
      if (!res.headersSent) send(res, e instanceof Fault ? e.status : e instanceof z.ZodError ? 400 : 500, { error: e instanceof z.ZodError ? { code: 'INVALID_INPUT', message: 'Invalid control request.' } : failure(e) })
      else res.end()
    }
  })
  server.requestTimeout = 120_000
  const timer = setInterval(() => { void workbench.production.tick().catch(() => console.error('MCP scheduler failed; check extension storage and upstream health.')) }, options.pollMs || 3000)
  timer.unref()
  return {
    server, ledger, workbench,
    async close() {
      ledger.stopping = true
      clearInterval(timer)
      workbench.calls.stop()
      // Stop new dispatch while preserving the user's persisted enable preference.
      server.close()
      await Promise.all([...transports].map(t => t.close()))
      await workbench.production.serial(async () => {})
      workbench.uploads.close()
      ledger.close()
    },
  }
}
