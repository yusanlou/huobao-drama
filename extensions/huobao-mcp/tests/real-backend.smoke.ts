// Optional integration smoke: starts the UNMODIFIED original backend with disposable data.
// Never contacts a paid provider and never writes to the user's running Huobao instance.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createExtension } from '../src/server.js'
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const dir = await mkdtemp(join(tmpdir(), 'huobao-original-backend-'))
const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening')
const port = (portProbe.address() as any).port; await new Promise<void>(r => portProbe.close(() => r()))
const child = spawn(process.execPath, [join(repo, 'backend/node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], {
  cwd: join(repo, 'backend'), env: { ...process.env, PORT: String(port), SQLITE_PATH: join(dir, 'test.sqlite3'), HUOBAO_DATA_DIR: dir, STORAGE_PATH: join(dir, 'static'), MYSQL_AUTO_IMPORT: 'false' }, stdio: 'ignore',
})
const base = `http://127.0.0.1:${port}/api/v1`
let app: ReturnType<typeof createExtension> | undefined
let client: Client | undefined
try {
  let ready = false
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`Original backend exited ${child.exitCode} under ${process.version}. Use the same Node major that installed backend native dependencies.`)
    try { ready = (await fetch(`${base}/health`)).ok } catch {}
    if (ready) break
    await new Promise(r => setTimeout(r, 200))
  }
  assert.ok(ready, 'isolated original backend starts')
  for (const [service_type, provider] of [['image', 'openai'], ['video', 'minimax']]) {
    const response = await fetch(`${base}/ai-configs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_type, provider, name: 'MCP smoke only', base_url: 'http://127.0.0.1:1', api_key: 'FAKE_TEST_KEY', model: ['test'] }) })
    assert.equal(response.status, 201)
  }
  app = createExtension({ dataDir: join(dir, 'mcp'), apiBase: base, publicUrl: 'http://localhost:5680/mcp', origins: ['http://localhost:3013'] })
  app.server.listen(0, '127.0.0.1'); await once(app.server, 'listening')
  const address = `http://127.0.0.1:${(app.server.address() as any).port}`
  const headers: Record<string, string> = { 'Content-Type': 'application/json', Origin: 'http://localhost:3013' }
  assert.equal((await fetch(`${address}/control/enabled`, { method: 'PUT', headers, body: JSON.stringify({ enabled: true, expected_revision: 0 }) })).status, 200)
  client = new Client({ name: 'original-backend-smoke', version: '1' })
  await client.connect(new StreamableHTTPClientTransport(new URL(`${address}/mcp`), { requestInit: { headers: { Authorization: `Bearer ${app.ledger.state.clientToken}` } } }))
  async function call(name: string, args: any) {
    const response = await client!.callTool({ name, arguments: args })
    assert.equal(response.isError, undefined, JSON.stringify(response))
    return (response.structuredContent as any).result
  }
  const project = await call('hb_create_project', { request_key: 'smoke-project', title: 'MCP isolated integration' })
  const episode = await call('hb_create_episode', { request_key: 'smoke-episode', project_id: project.id, title: 'Test episode' })
  const scope = { project_id: project.id, episode_id: episode.id }
  const script = await call('hb_read_content', { ...scope, section: 'script' })
  await call('hb_write_script', { ...scope, request_key: 'smoke-script', field: 'script_content', content: '这是通过标准 MCP 保存的测试剧本。', expected_hash: script.script_content.hash })
  const assets = await call('hb_upsert_assets', { ...scope, request_key: 'smoke-character', kind: 'characters', items: [{ fields: { name: '测试角色', appearance: '白衣', final_prompt: 'test portrait' } }] })
  assert.equal(assets.status, 'succeeded')
  const storyboard = await call('hb_write_storyboards', { ...scope, request_key: 'smoke-storyboard', items: [{ fields: { title: '测试镜头', character_ids: [assets.receipts[0].id], video_prompt: '@测试角色 行走', duration: 5 } }] })
  assert.equal(storyboard.status, 'succeeded')
  const webpageProject = (await (await fetch(`${base}/dramas/${project.id}`)).json()).data
  const webpageShots = (await (await fetch(`${base}/episodes/${episode.id}/storyboards`)).json()).data
  assert.equal(webpageProject.episodes[0].script_content, '这是通过标准 MCP 保存的测试剧本。')
  assert.equal(webpageProject.characters[0].final_prompt, 'test portrait')
  assert.equal(webpageShots[0].video_prompt, '@测试角色 行走')
  const context = await call('hb_get_context', scope)
  assert.ok(!JSON.stringify(context).includes('FAKE_TEST_KEY'))
  console.log('PASS: unchanged backend + standard MCP creates project/episode, writes script/assets/storyboards; webpage HTTP reads show the same saved data. No provider calls.')
} finally {
  await client?.close(); await app?.close()
  if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') }
  await rm(dir, { recursive: true, force: true })
}
