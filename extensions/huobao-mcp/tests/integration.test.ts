import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createExtension } from '../src/server.js'
import { hash } from '../src/core.js'

async function fixture() {
  const calls: { path: string; method: string; body: any }[] = []
  let content = 'original script', nextId = 20, generationCount = 0
  let failProps = false, hangGeneration = false, mutateOnGenerate = false
  let heldRead: { started: () => void; wait: Promise<void> } | undefined
  let taskStatus = 'processing'
  const characters: any[] = [{ id: 3, name: '阿青', image_url: '/static/a.png', description: 'hero' }]
  const scenes: any[] = [{ id: 4, location: '竹林', image_url: '/static/forest.png' }]
  const props: any[] = []
  const shots: any[] = [{ id: 5, episode_id: 2, storyboard_number: 1, description: 'shot', video_prompt: '@阿青 走进 @竹林', character_ids: [3], prop_ids: [], scene_id: 4, duration: 5, video_url: '/static/old.mp4' }]
  const upstream = createServer(async (req, res) => {
    let raw = ''; for await (const c of req) raw += c
    const body = raw ? JSON.parse(raw) : undefined
    const path = new URL(req.url!, 'http://localhost').pathname.replace('/api/v1', '')
    calls.push({ path, method: req.method!, body })
    if (path === '/dramas/1' && heldRead) { const gate = heldRead; heldRead = undefined; gate.started(); await gate.wait }
    let data: any = null
    const episode = { id: 2, title: 'Episode', content, image_config_id: 1, video_config_id: 2, resolution: '720p' }
    const project = { id: 1, title: 'Test project', episodes: [episode], characters, scenes, props, aspect_ratio: '16:9' }
    if (path === '/health') data = { status: 'ok' }
    else if (path === '/ai-configs') data = [{ id: 1, name: 'test config', api_key: 'DO_NOT_LEAK', settings: '{"token":"DO_NOT_LEAK"}', service_type: 'image', model: ['test'] }]
    else if (path === '/dramas/1') data = project
    else if (path === '/dramas') data = req.method === 'GET' ? { items: [project], pagination: { total: 1 } } : { id: ++nextId, ...body }
    else if (path === '/episodes/2' && req.method === 'PUT') content = body.content
    else if (path === '/episodes/2/characters') data = characters
    else if (path === '/episodes/2/scenes') data = scenes
    else if (path === '/episodes/2/props') data = props
    else if (path === '/episodes/2/storyboards') data = shots
    else if (path === '/props' && req.method === 'POST') {
      if (failProps && body.name === 'bad') { res.writeHead(500); res.end(JSON.stringify({ code: 500, message: 'secret DO_NOT_LEAK' })); return }
      data = { id: ++nextId, ...body }; props.push(data)
    }
    else if (path === '/tasks' && req.method === 'POST') {
      generationCount++; data = { id: generationCount }
      if (mutateOnGenerate) shots[0].video_prompt = 'edited on webpage'
      if (hangGeneration) { setTimeout(() => res.end(JSON.stringify({ code: 201, data })), 1000); return }
    }
    else if (path.startsWith('/tasks/')) data = { id: Number(path.split('/')[2]), type: 'video', drama_id: 1, storyboard_id: 5, status: taskStatus, localPath: '/static/new.mp4' }
    else if (path === '/storyboards/5' && req.method === 'PUT') Object.assign(shots[0], body)
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: 200, data }))
  })
  upstream.listen(0, '127.0.0.1'); await once(upstream, 'listening')
  const apiBase = `http://127.0.0.1:${(upstream.address() as any).port}/api/v1`
  const dir = await mkdtemp(join(tmpdir(), 'huobao-mcp-test-'))
  const origin = 'http://localhost:3013'
  let app = createExtension({ dataDir: dir, apiBase, publicUrl: 'http://localhost:5680/mcp', origins: [origin], timeout: 500, pollMs: 60_000 })
  const start = async () => { app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening'); return `http://127.0.0.1:${(app.server.address() as any).port}` }
  let base = await start()
  async function control(path: string, method = 'GET', body?: any, override: Record<string, string> = {}) {
    return fetch(`${base}/control${path}`, { method, headers: { Origin: origin, 'Content-Type': 'application/json', ...override }, body: body === undefined ? undefined : JSON.stringify(body) })
  }
  async function enable(enabled: boolean) {
    const status = await (await control('/status')).json()
    const response = await control('/enabled', 'PUT', { enabled, expected_revision: status.revision })
    assert.equal(response.status, 200)
  }
  async function client() {
    const c = new Client({ name: 'integration-client', version: '1.0' })
    await c.connect(new StreamableHTTPClientTransport(new URL(`${base}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${app.ledger.state.clientToken}` } } }))
    return c
  }
  return {
    get app() { return app }, get base() { return base }, calls, characters, shots, enable, control, client,
    holdNextProjectRead() {
      let started!: () => void, release!: () => void
      const reached = new Promise<void>(r => { started = r })
      const wait = new Promise<void>(r => { release = r })
      heldRead = { started, wait }; return { reached, release }
    },
    setFailProps() { failProps = true }, setHangGeneration() { hangGeneration = true }, setTaskComplete() { taskStatus = 'completed' },
    get generationCount() { return generationCount },
    async restart() { await app.close(); app = createExtension({ dataDir: dir, apiBase, publicUrl: 'http://localhost:5680/mcp', origins: [origin], timeout: 500, pollMs: 60_000 }); base = await start() },
    async cleanup() { await app.close(); upstream.closeAllConnections(); await new Promise<void>(r => upstream.close(() => r())); await rm(dir, { recursive: true, force: true }) },
  }
}

async function tool(client: Client, name: string, args: any) {
  const result = await client.callTool({ name, arguments: args })
  assert.equal(result.isError, undefined, JSON.stringify(result))
  return (result.structuredContent as any).result
}

test('standard MCP handshake, schema discovery and sanitized context work; disabling rejects an already connected client', async () => {
  const f = await fixture()
  try {
    assert.equal((await f.control('/status')).status, 200)
    await f.enable(true)
    const c = await f.client()
    try {
      assert.equal((await c.listTools()).tools.length, 17)
      const context = await tool(c, 'hb_get_context', { project_id: 1, episode_id: 2 })
      assert.equal(context.characters[0].id, 3)
      assert.equal(JSON.stringify(context).includes('DO_NOT_LEAK'), false)
      const status = await (await f.control('/status')).json()
      assert.equal(JSON.stringify(status).includes('clientToken'), false)
      await f.enable(false)
      await assert.rejects(c.callTool({ name: 'hb_find_projects', arguments: {} }))
      assert.equal((await f.control('/status')).status, 200)
      await f.restart()
      assert.equal((await (await f.control('/status')).json()).enabled, false)
    } finally { await c.close() }
  } finally { await f.cleanup() }
})

test('control needs no pairing but retains Origin protection, switch revisions and MCP authentication', async () => {
  const f = await fixture()
  try {
    assert.equal((await f.control('/enabled', 'PUT', { enabled: true, expected_revision: 0 }, { Origin: 'https://evil.example' })).status, 403)
    assert.equal((await f.control('/enabled', 'PUT', { enabled: true, expected_revision: 0 }, { Origin: '', Authorization: `Bearer ${f.app.ledger.state.clientToken}` })).status, 403)
    await f.enable(true)
    assert.equal((await f.control('/enabled', 'PUT', { enabled: false, expected_revision: 0 })).status, 409)
    assert.equal((await f.control('/pair', 'POST', { code: 'obsolete' })).status, 404)
    const configResponse = await f.control('/client-config', 'POST', {})
    assert.equal(configResponse.status, 200)
    assert.equal(configResponse.headers.get('set-cookie'), null)
    assert.equal((await configResponse.json()).headers.Authorization, `Bearer ${f.app.ledger.state.clientToken}`)
    assert.equal((await f.control('/client-config', 'POST', {}, { Origin: 'https://evil.example' })).status, 403)
    assert.equal((await fetch(`${f.base}/mcp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })).status, 401)
  } finally { await f.cleanup() }
})

test('script write checks observed content and repeats safely across restart without a second upstream write', async () => {
  const f = await fixture()
  try {
    await f.enable(true)
    const args = { project_id: 1, episode_id: 2, request_key: 'script-write-1', field: 'content', content: 'new script', expected_hash: hash('original script') }
    const result = await f.app.workbench.invoke('hb_write_script', args)
    assert.equal(result.matches_written, true)
    await f.restart()
    assert.deepEqual(await f.app.workbench.invoke('hb_write_script', args), result)
    assert.equal(f.calls.filter(c => c.path === '/episodes/2' && c.method === 'PUT').length, 1)
    await assert.rejects(f.app.workbench.invoke('hb_write_script', { ...args, request_key: 'another-script' }), /Content changed/)
  } finally { await f.cleanup() }
})

test('batch receipts preserve successful items and stop after an uncertain upstream write', async () => {
  const f = await fixture()
  try {
    await f.enable(true); f.setFailProps()
    const args = { project_id: 1, episode_id: 2, request_key: 'props-batch-1', kind: 'props', items: ['cup', 'bad', 'hat'].map(name => ({ fields: { name } })) }
    const result = await f.app.workbench.invoke('hb_upsert_assets', args)
    assert.deepEqual(result.receipts.map((r: any) => r.status), ['succeeded', 'unknown', 'not_started'])
    assert.equal(JSON.stringify(result).includes('DO_NOT_LEAK'), false)
    await f.app.workbench.invoke('hb_upsert_assets', args)
    assert.equal(f.calls.filter(c => c.path === '/props').length, 2)
  } finally { await f.cleanup() }
})

test('production prepares ordered references, persists run IDs, pauses future dispatch and observes in-flight completion', async () => {
  const f = await fixture()
  try {
    await f.enable(true)
    const plan = await f.app.workbench.invoke('hb_plan_production', { project_id: 1, episode_id: 2, actions: [{ kind: 'storyboard_video', target_id: 5 }] })
    assert.equal(plan.steps[0].body.prompt, '@图片2阿青 走进 @图片1竹林')
    assert.deepEqual(plan.steps[0].body.reference_image_urls, ['/static/forest.png', '/static/a.png'])
    assert.equal(plan.steps[0].overwrites_current, true)
    const run = await f.app.workbench.invoke('hb_start_run', { plan_id: plan.id, request_key: 'video-run-1' })
    await f.app.workbench.production.tick()
    assert.equal(run.steps[0].status, 'submitted')
    await f.enable(false); f.setTaskComplete()
    await f.app.workbench.production.tick()
    assert.equal(run.status, 'completed'); assert.equal(f.generationCount, 1)
    await f.restart(); await f.enable(true)
    const recovered = await f.app.workbench.invoke('hb_get_run', { run_id: run.id })
    assert.equal(recovered.status, 'completed'); assert.equal(recovered.steps[0].result.local_path, '/static/new.mp4')
  } finally { await f.cleanup() }
})

test('uncertain generation is never automatically resubmitted or resumed after a restart', async () => {
  const f = await fixture()
  try {
    await f.enable(true); f.setHangGeneration()
    const plan = await f.app.workbench.invoke('hb_plan_production', { project_id: 1, episode_id: 2, actions: [{ kind: 'storyboard_video', target_id: 5 }] })
    const run = await f.app.workbench.invoke('hb_start_run', { plan_id: plan.id, request_key: 'unknown-run' })
    await f.app.workbench.production.tick()
    assert.equal(run.steps[0].status, 'submission_unknown')
    await f.restart()
    await f.app.workbench.production.tick()
    await assert.rejects(f.app.workbench.invoke('hb_control_run', { run_id: run.id, action: 'resume' }), /cannot be retried/)
    assert.equal(f.generationCount, 1)
    await f.app.workbench.invoke('hb_control_run', { run_id: run.id, action: 'reconcile', step_index: 0, upstream_id: 1 })
    f.setTaskComplete(); await f.app.workbench.production.tick()
    assert.equal(f.app.workbench.production.get(run.id).status, 'completed')
    assert.equal(f.generationCount, 1)
  } finally { await f.cleanup() }
})

test('web edits invalidate a prepared plan and no production request is submitted', async () => {
  const f = await fixture()
  try {
    await f.enable(true)
    const plan = await f.app.workbench.invoke('hb_plan_production', { project_id: 1, episode_id: 2, actions: [{ kind: 'storyboard_video', target_id: 5 }] })
    const run = await f.app.workbench.invoke('hb_start_run', { plan_id: plan.id, request_key: 'stale-run-1' })
    f.shots[0].video_prompt = 'Human changed this on the webpage'
    await f.app.workbench.production.tick()
    assert.equal(run.steps[0].error.code, 'STALE_PLAN'); assert.equal(f.generationCount, 0)
  } finally { await f.cleanup() }
})


test('stdio bridge exposes the same tools and honors the HTTP service switch', async () => {
  const f = await fixture()
  let client: Client | undefined
  try {
    await f.enable(true)
    client = new Client({ name: 'stdio-integration-client', version: '1' })
    const transport = new StdioClientTransport({
      command: process.execPath,
      args: ['--import', 'tsx', fileURLToPath(new URL('../src/stdio.ts', import.meta.url))],
      cwd: fileURLToPath(new URL('..', import.meta.url)),
      env: { ...Object.fromEntries(Object.entries(process.env).filter((entry): entry is [string, string] => entry[1] !== undefined)), HUOBAO_MCP_URL: `${f.base}/mcp`, HUOBAO_MCP_TOKEN: f.app.ledger.state.clientToken },
      stderr: 'pipe',
    })
    await client.connect(transport)
    assert.equal((await client.listTools()).tools.length, 17)
    assert.equal((await tool(client, 'hb_find_projects', {})).items[0].id, 1)
    await f.enable(false)
    assert.equal((await client.callTool({ name: 'hb_find_projects', arguments: {} })).isError, true)
  } finally { await client?.close(); await f.cleanup() }
})

test('turning off before dispatch pauses a queued run; enabling does not silently resume it', async () => {
  const f = await fixture()
  try {
    await f.enable(true)
    const plan = await f.app.workbench.invoke('hb_plan_production', { project_id: 1, episode_id: 2, actions: [{ kind: 'storyboard_video', target_id: 5 }] })
    const run = await f.app.workbench.invoke('hb_start_run', { plan_id: plan.id, request_key: 'queued-run-1' })
    await f.enable(false); await f.app.workbench.production.tick()
    assert.equal(f.generationCount, 0); assert.equal(run.status, 'paused')
    await f.enable(true); await f.app.workbench.production.tick()
    assert.equal(f.generationCount, 0)
    await f.app.workbench.invoke('hb_control_run', { run_id: run.id, action: 'resume' })
    await f.app.workbench.production.tick()
    assert.equal(f.generationCount, 1)
  } finally { await f.cleanup() }
})


test('disable during asynchronous preflight prevents the final upstream dispatch', async () => {
  const f = await fixture()
  try {
    await f.enable(true)
    const plan = await f.app.workbench.invoke('hb_plan_production', { project_id: 1, episode_id: 2, actions: [{ kind: 'storyboard_video', target_id: 5 }] })
    const run = await f.app.workbench.invoke('hb_start_run', { plan_id: plan.id, request_key: 'race-run-1' })
    const gate = f.holdNextProjectRead()
    const tick = f.app.workbench.production.tick()
    await gate.reached
    try { await f.enable(false) } finally { gate.release() }
    await tick
    assert.equal(f.generationCount, 0)
    assert.equal(run.status, 'paused')
    assert.equal(run.steps[0].status, 'pending')
  } finally { await f.cleanup() }
})
