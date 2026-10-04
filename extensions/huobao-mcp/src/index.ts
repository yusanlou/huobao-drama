import { fileURLToPath } from 'node:url'
import { createExtension } from './server.js'
const port = Number(process.env.HUOBAO_MCP_PORT || 5680)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Invalid HUOBAO_MCP_PORT')
const host = process.env.HUOBAO_MCP_HOST || '127.0.0.1'
const agentTimeout = Number(process.env.HUOBAO_MCP_AGENT_TIMEOUT_MS || 300_000)
if (!Number.isInteger(agentTimeout) || agentTimeout < 1000 || agentTimeout > 3_600_000) throw new Error('Invalid HUOBAO_MCP_AGENT_TIMEOUT_MS')
const app = createExtension({
  agentTimeout,
  dataDir: process.env.HUOBAO_MCP_DATA_DIR || fileURLToPath(new URL('../.data', import.meta.url)),
  apiBase: process.env.HUOBAO_API_BASE_URL || 'http://localhost:5679/api/v1',
  publicUrl: process.env.HUOBAO_MCP_PUBLIC_URL || `http://localhost:${port}/mcp`,
  origins: (process.env.HUOBAO_MCP_ORIGINS || `http://localhost:3013,http://localhost:5679,http://localhost:${port}`).split(',').map(s => s.trim()),
})
app.server.on('error', async () => { console.error('MCP listener failed; check address/port.'); await app.close(); process.exitCode = 1 })
app.server.listen(port, host, () => {
  console.log(`Huobao MCP listening on ${host}:${port}; enabled=${app.ledger.state.enabled}`)
  console.log('Open Huobao → Settings → MCP service to enable. No backend code is modified.')
})
let closing = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, async () => {
  if (closing) return
  closing = true
  await app.close(); process.exit(0)
})
