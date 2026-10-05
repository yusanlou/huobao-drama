// Optional integration smoke: starts the UNMODIFIED original backend with disposable data.
// Never contacts a paid provider and never writes to the user's running Huobao instance.
import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { createServer } from 'node:net'
import { once } from 'node:events'
import { mkdtemp, rm, cp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { createExtension } from '../src/server.js'
import { emptyRequirements, mergeRequirements, productionChecks, mergeContinuity, parseContinuity } from '../../../shared/production.mjs'
import { execFileSync } from 'node:child_process'
import { hash } from '../src/core.js'
const repo = resolve(fileURLToPath(new URL('../../..', import.meta.url)))
const dir = await mkdtemp(join(tmpdir(), 'huobao-original-backend-'))
await cp(join(repo, 'backend/workspace'), join(dir, 'workspace'), { recursive: true })
const portProbe = createServer(); portProbe.listen(0, '127.0.0.1'); await once(portProbe, 'listening')
const port = (portProbe.address() as any).port; await new Promise<void>(r => portProbe.close(() => r()))
const child = spawn(process.execPath, [join(repo, 'backend/node_modules/tsx/dist/cli.mjs'), 'src/index.ts'], {
  cwd: join(repo, 'backend'), env: { ...process.env, PORT: String(port), SQLITE_PATH: join(dir, 'test.sqlite3'), HUOBAO_DATA_DIR: dir, STORAGE_PATH: join(dir, 'static'), MYSQL_AUTO_IMPORT: 'false', WORKSPACE_PATH: join(dir, 'workspace') }, stdio: 'ignore',
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
    const response = await fetch(`${base}/ai-configs`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ service_type, provider, name: 'MCP smoke only', base_url: 'http://127.0.0.1:1', api_key: 'FAKE_TEST_KEY', model: [service_type === 'video' ? 'MiniMax-H3' : 'test'] }) })
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
  const requirements = await call('hb_get_production_requirements', scope)
  await call('hb_update_production_requirements', { ...scope, request_key: 'smoke-requirements', expected_hash: requirements.description_hash, requirements: { ...emptyRequirements(), target_duration_seconds: 54 } })
  const nativeEpisode = (await (await fetch(`${base}/dramas/${project.id}`)).json()).data.episodes[0]
  assert.match(nativeEpisode.description, /target_duration_seconds.*54/)
  const webDescription = mergeRequirements(nativeEpisode.description, { ...emptyRequirements(), target_duration_seconds: 54, must_keep: ['网页添加的事实'] })
  await fetch(`${base}/episodes/${episode.id}`, { method: 'PUT', headers, body: JSON.stringify({ description: webDescription }) })
  assert.deepEqual((await call('hb_get_production_requirements', scope)).requirements.must_keep, ['网页添加的事实'])
  const checks = await call('hb_get_production_checks', { ...scope, storyboard_id: webpageShots[0].id })
  assert.deepEqual(checks, productionChecks(webpageShots, { ...emptyRequirements(), target_duration_seconds: 54, must_keep: ['网页添加的事实'] }, webpageShots[0].id, nativeEpisode.script_content || nativeEpisode.content || ''))
  assert.equal(checks.editorial_review.status, 'needs_review')
  const state = { id: assets.receipts[0].id, position: 'door', pose: 'standing', appearance: 'white clothes', visible: true }
  const continuityPlan = { version: 1, transition: 'start', reason: 'Opening', space: 'Room with door', camera: 'Wide static', start: [state], end: [state] }
  await call('hb_write_storyboards', { ...scope, request_key: 'smoke-continuity', items: [{ id: webpageShots[0].id, fields: { result: mergeContinuity('Standing at door.', continuityPlan) } }] })
  const nativePlan = (await (await fetch(`${base}/episodes/${episode.id}/storyboards`)).json()).data[0]
  assert.deepEqual(parseContinuity(nativePlan.result).plan, continuityPlan)
  const continuityChecks = await call('hb_get_production_checks', { ...scope, storyboard_id: nativePlan.id })
  assert.deepEqual(continuityChecks.handoff.issues, [])
  assert.equal(continuityChecks.handoff.automatic_approval, false)
  const modelConfigs = await call('hb_model_config_action', { action: 'list' })
  assert.ok(!JSON.stringify(modelConfigs).includes('FAKE_TEST_KEY'))
  for (const language of ['zh', 'en', 'ja', 'ko']) {
    const before = await call('hb_prompt_action', { action: 'read', agent_type: 'script_rewriter', lang: language })
    await call('hb_prompt_action', { action: 'save', agent_type: 'script_rewriter', lang: language, expected_hash: before.content_hash, system_prompt: before.system_prompt + '\nNative API deployment check.', request_key: `smoke-prompt-${language}` })
    const after = await call('hb_prompt_action', { action: 'read', agent_type: 'script_rewriter', lang: language })
    assert.match(after.system_prompt, /Native API deployment check/)
  }
  const deployArgs = [join(repo, 'scripts/deploy-production-config.mjs'), '--base', base, '--backup-dir', join(dir, 'config-backups')]
  execFileSync(process.execPath, [...deployArgs, '--apply'], { stdio: 'pipe' })
  const deployment = JSON.parse(await readFile(join(dir, 'config-backups/production-config-last-deployment.json'), 'utf8'))
  assert.equal(deployment.results.length, 24)
  const deployed = await call('hb_prompt_action', { action: 'read', agent_type: 'script_rewriter', lang: 'zh' })
  assert.doesNotMatch(deployed.system_prompt, /Native API deployment check/)
  assert.match(deployed.system_prompt, /target_duration_seconds/)
  const skill = await call('hb_skill_action', { action: 'read', id: 'prompt-generator/video-prompt', lang: 'zh' })
  assert.match(skill.content, /逐字原台词/)
  // Restore the exact effective configuration, including all language variants.
  execFileSync(process.execPath, [...deployArgs, '--restore', deployment.backup], { stdio: 'pipe' })
  const restored = await call('hb_prompt_action', { action: 'read', agent_type: 'script_rewriter', lang: 'en' })
  assert.match(restored.system_prompt, /Native API deployment check/)
  // MCP off is an extension gate only: original webpage HTTP remains writable.
  app.ledger.state.enabled = false; app.ledger.save()
  assert.equal((await fetch(`${base}/episodes/${episode.id}`, { method: 'PUT', headers, body: JSON.stringify({ title: 'Web works with MCP disabled' }) })).status, 200)
  assert.equal((await (await fetch(`${base}/dramas/${project.id}`)).json()).data.episodes[0].title, 'Web works with MCP disabled')
  app.ledger.state.enabled = true; app.ledger.save()
  const uploadedBytes = Buffer.from('temporary-video-upload')
  const { createHash } = await import('node:crypto')
  const transfer = await call('hb_upload_begin', { request_key: 'native-upload-begin', kind: 'video', filename: 'test.mp4', size_bytes: uploadedBytes.length, sha256: createHash('sha256').update(uploadedBytes).digest('hex') })
  await call('hb_upload_chunk', { request_key: 'native-upload-chunk', upload_id: transfer.upload_id, offset: 0, base64: uploadedBytes.toString('base64') })
  const uploaded = await call('hb_upload_finish', { request_key: 'native-upload-finish', upload_id: transfer.upload_id })
  assert.ok(uploaded.url.startsWith('/static/'))
  const shotId = storyboard.receipts[0].id
  await call('hb_storyboard_action', { ...scope, storyboard_id: shotId, action: 'bind_video', request_key: 'native-bind-video', video_url: uploaded.path })
  assert.equal((await call('hb_storyboard_action', { ...scope, storyboard_id: shotId, action: 'read' })).video_url, uploaded.path)
  const inactive = await call('hb_model_config_action', { action: 'create', request_key: 'native-config-inactive', fields: { name: 'Inactive test', service_type: 'text', provider: 'openai', model: ['test'], api_key: 'NEVER_RETURN_SECRET', is_active: false } })
  assert.equal(inactive.is_active, false)
  const readConfig = await call('hb_model_config_action', { action: 'read', id: inactive.id })
  assert.equal(readConfig.is_active, false); assert.ok(!JSON.stringify(readConfig).includes('NEVER_RETURN_SECRET'))
  const newSkill = 'prompt-generator/smoke-only'
  await call('hb_skill_action', { action: 'create', id: newSkill, content: '---\nname: smoke-only\ndescription: test\n---\nNative skill content', request_key: 'native-skill-create' })
  const skillContent = await call('hb_skill_action', { action: 'read', id: newSkill })
  assert.match(skillContent.content, /Native skill content/)
  await call('hb_skill_action', { action: 'delete', id: newSkill, expected_hash: skillContent.content_hash, request_key: 'native-skill-delete' })
  const context = await call('hb_get_context', scope)
  assert.ok(!JSON.stringify(context).includes('FAKE_TEST_KEY'))
  console.log('PASS: unchanged backend + standard MCP creates project/episode, writes script/assets/storyboards; webpage HTTP reads show the same saved data. Requirements roundtrip, 24 prompt/Skill deployments and restores, upload/binding, masked model config, Skill creation and disabled-MCP webpage writes verified. No provider calls.')
} finally {
  await client?.close(); await app?.close()
  if (child.exitCode === null) { child.kill('SIGTERM'); await once(child, 'exit') }
  await rm(dir, { recursive: true, force: true })
}
