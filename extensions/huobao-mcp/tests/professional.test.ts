import test from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { once } from 'node:events'
import { mkdtemp, rm, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createHash } from 'node:crypto'
import { createExtension } from '../src/server.js'
import { hash } from '../src/core.js'
import { emptyRequirements, mergeRequirements, agentMessage } from '../../../shared/production.mjs'

async function fixture(agentTimeout = 500) {
  const dir = await mkdtemp(join(tmpdir(), 'huobao-professional-'))
  const episode: any = { id: 2, description: 'Original description\n', content: 'Original source', script_content: 'Approved script', video_config_id: 3, resolution: '720p' }
  const shots: any[] = [{ id: 4, episode_id: 2, duration: 6, video_prompt: '旁白：“这是逐字台词。”', description: '旁白：“这是逐字台词。”', scene_id: null, character_ids: [], prop_ids: [] }]
  const calls: any[] = [], uploads: Buffer[] = []
  let delay = 0, agentStatus = 200, batchIds: number[] = []
  const configs = [{ id: 3, name: 'Wan', provider: 'aliyun', model: ['wan3.0-video'], service_type: 'video', is_active: true, api_key: 'NEVER_RETURN_THIS', base_url: 'https://provider.example/key/NEVER_RETURN_THIS' }]
  const server = createServer(async (req, res) => {
    const chunks = []; for await (const chunk of req) chunks.push(chunk)
    const raw = Buffer.concat(chunks), path = new URL(req.url!, 'http://local').pathname.replace('/api/v1', '')
    if (path.startsWith('/upload/')) { uploads.push(raw); res.end(JSON.stringify({ code: 200, data: { url: '/static/upload.mp4', path: 'static/upload.mp4' } })); return }
    const body = raw.length ? JSON.parse(raw.toString()) : undefined
    calls.push({ path, method: req.method, body })
    let data: any = null
    if (path === '/health') data = { status: 'ok' }
    else if (path === '/dramas/1') data = { id: 1, episodes: [episode], characters: [], scenes: [], props: [], style: 'archive', aspect_ratio: '16:9' }
    else if (path === '/episodes/2' && req.method === 'PUT') Object.assign(episode, body)
    else if (path === '/episodes/2/storyboards') data = shots
    else if (/^\/episodes\/2\/(characters|scenes|props)$/.test(path)) data = []
    else if (path === '/ai-configs' || path === '/ai-configs/3') data = path.endsWith('/3') ? configs[0] : configs
    else if (path === '/style-presets') data = [{ id: 9, value: 'archive', name: 'Archive', prompt: 'VHS texture', is_active: true }]
    else if (path === '/episodes/2/generate-video-prompts') { batchIds = body.storyboard_ids; data = { total: batchIds.length } }
    else if (path === '/episodes/2/video-prompts-status') data = { status: 'done', total: batchIds.length }
    else if (path.startsWith('/agent/')) {
      await new Promise(r => setTimeout(r, delay))
      if (agentStatus !== 200) { res.writeHead(agentStatus); res.end(JSON.stringify({ code: agentStatus, message: 'NEVER_RETURN_THIS' })); return }
      if (path.includes('script_rewriter')) episode.script_content = 'Native generated screenplay'
      if (path.includes('prompt_generator')) shots[0].video_prompt = 'Native generated video prompt'
      data = { type: 'done', text: 'NEVER_RETURN_THIS', toolResults: [{ secret: 'NEVER_RETURN_THIS' }] }
    } else if (path === '/tasks/8') data = { id: 8, dramaId: 1, storyboardId: 4, prompt: 'VHS texture，\n逐字台词', params: JSON.stringify({ generateAudio: false, promptExtend: false, duration: 6, api_key: 'NEVER_RETURN_THIS', headers: { authorization: 'NEVER_RETURN_THIS' } }) }
    else if (path === '/tasks' && req.method === 'POST') data = { id: 8 }
    else if (path === '/tasks') data = [{ id: 11, dramaId: 1, characterId: 20, type: 'image' }, { id: 12, dramaId: 1, characterId: 21, type: 'image' }, { id: 13, dramaId: 9, characterId: 20, type: 'image' }]
    else if (path === '/ai-configs/test') data = { ok: true, reachable: true, status: 200, response_preview: 'NEVER_RETURN_THIS', url: configs[0].base_url }
    res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify({ code: 200, data }))
  })
  server.listen(0, '127.0.0.1'); await once(server, 'listening')
  const options = { apiBase: `http://127.0.0.1:${(server.address() as any).port}/api/v1`, dataDir: dir, publicUrl: 'http://localhost:5680/mcp', origins: [], agentTimeout, pollMs: 60000 }
  let app = createExtension(options); app.ledger.state.enabled = true; app.ledger.save()
  return { episode, shots, calls, uploads, dir, get app() { return app }, setDelay(ms: number) { delay = ms }, failAgent() { agentStatus = 400 },
    async restart() { await app.close(); app = createExtension(options) },
    async close() { await app.close(); server.closeAllConnections(); await new Promise<void>(r => server.close(() => r())); await rm(dir, { recursive: true, force: true }) },
  }
}
const scope = { project_id: 1, episode_id: 2 }
async function poll(f: Awaited<ReturnType<typeof fixture>>, id: string) {
  for (let i = 0; i < 100; i++) {
    const call = await f.app.workbench.invoke('hb_get_call', { call_id: id })
    if (!['queued', 'dispatching'].includes(call.status)) return call
    await new Promise(r => setTimeout(r, 10))
  }
  throw Error('Call did not finish')
}
test('requirements use native episode descriptions, roundtrip both directions, preserve text and check hashes', async () => {
  const f = await fixture()
  try {
    const first = await f.app.workbench.invoke('hb_get_production_requirements', scope)
    const req = { ...emptyRequirements(), target_duration_seconds: 54 }
    const args = { ...scope, request_key: 'requirements-save', expected_hash: first.description_hash, requirements: req }
    const saved = await f.app.workbench.invoke('hb_update_production_requirements', args)
    assert.equal(saved.requirements.target_duration_seconds, 54); assert.match(f.episode.description, /^Original description\n/)
    assert.equal(f.episode.content, 'Original source'); assert.equal(f.episode.script_content, 'Approved script')
    await f.app.workbench.invoke('hb_update_production_requirements', args)
    assert.equal(f.calls.filter(c => c.method === 'PUT').length, 1)
    f.episode.description = mergeRequirements(f.episode.description, { ...req, must_keep: ['Web edit'] })
    assert.deepEqual((await f.app.workbench.invoke('hb_get_production_requirements', scope)).requirements.must_keep, ['Web edit'])
    await assert.rejects(f.app.workbench.invoke('hb_update_production_requirements', { ...args, request_key: 'stale-save' }), /Description changed/)
  } finally { await f.close() }
})
test('native Agent receives the same message as webpage, immediate receipt, dedupe and readback evidence', async () => {
  const f = await fixture()
  try {
    f.setDelay(60); f.episode.description = mergeRequirements('', { ...emptyRequirements(), target_duration_seconds: 54 })
    const args = { ...scope, request_key: 'rewrite-source', expected_hash: hash('Original source') }
    const start = await f.app.workbench.invoke('hb_rewrite_script', args)
    assert.equal(start.status, 'queued')
    assert.equal((await f.app.workbench.invoke('hb_rewrite_script', args)).call_id, start.call_id)
    await assert.rejects(f.app.workbench.invoke('hb_rewrite_script', { ...args, expected_hash: hash('other') }), /different arguments/)
    const receipt = await poll(f, start.call_id)
    assert.equal(receipt.status, 'response_received'); assert.equal(f.episode.script_content, 'Native generated screenplay')
    const native = f.calls.filter(c => c.path.includes('/agent/'))
    assert.equal(native.length, 1)
    assert.equal(native[0].body.message, agentMessage('rewrite', { description: f.episode.description }))
    assert.ok(!JSON.stringify(receipt).includes('NEVER_RETURN_THIS'))
  } finally { await f.close() }
})
test('timeout and native 400 after potential writes remain unknown; restart never redispatches', async () => {
  const f = await fixture(30)
  try {
    f.setDelay(100)
    const args = { ...scope, request_key: 'timeout-rewrite', expected_hash: hash('Original source') }
    const start = await f.app.workbench.invoke('hb_rewrite_script', args)
    assert.equal((await poll(f, start.call_id)).status, 'submission_unknown')
    await f.restart()
    await f.app.workbench.invoke('hb_rewrite_script', args)
    assert.equal(f.calls.filter(c => c.path.includes('/agent/')).length, 1)
    f.setDelay(0); f.failAgent()
    const failed = await f.app.workbench.invoke('hb_rewrite_script', { ...args, request_key: 'reconciled-new-call' })
    assert.equal((await poll(f, failed.call_id)).status, 'submission_unknown')
  } finally { await f.close() }
})
test('shutdown marks dispatched calls unknown and callbacks never write after the ledger lock is released', async () => {
  const f = await fixture()
  try {
    f.setDelay(150)
    const start = await f.app.workbench.invoke('hb_rewrite_script', { ...scope, request_key: 'shutdown-call', expected_hash: hash('Original source') })
    await new Promise(r => setTimeout(r, 20))
    await f.restart()
    assert.equal((await f.app.workbench.invoke('hb_get_call', { call_id: start.call_id })).status, 'submission_unknown')
    await new Promise(r => setTimeout(r, 170))
    assert.equal((await f.app.workbench.invoke('hb_get_call', { call_id: start.call_id })).status, 'submission_unknown')
  } finally { await f.close() }
})
test('single and native batch prompts enforce explicit episode scope without invoking another compiler', async () => {
  const f = await fixture()
  try {
    await assert.rejects(f.app.workbench.invoke('hb_generate_video_prompts', { ...scope, request_key: 'bad-scope-ids', mode: 'native_batch', storyboard_ids: [99] }), /unique storyboards/)
    await f.app.workbench.invoke('hb_generate_video_prompts', { ...scope, request_key: 'native-batch', mode: 'native_batch', storyboard_ids: [4] })
    assert.deepEqual(f.calls.find(c => c.path.endsWith('/generate-video-prompts')).body.storyboard_ids, [4])
    const single = await f.app.workbench.invoke('hb_generate_video_prompts', { ...scope, request_key: 'native-single', mode: 'single', storyboard_ids: [4] })
    await poll(f, single.call_id)
    assert.equal(f.episode.script_content, 'Approved script')
    assert.equal(f.shots[0].video_prompt, 'Native generated video prompt')
  } finally { await f.close() }
})
test('preview and plan carry audio, rewrite, first/last frames and style; task secrets stay private', async () => {
  const f = await fixture()
  try {
    const options = { mode: 'first_last', first_frame_url: '/first.png', last_frame_url: '/last.png', generate_audio: false, prompt_extend: false, seed: 42 }
    const preview = await f.app.workbench.invoke('hb_inspect_video_input', { ...scope, storyboard_id: 4, options })
    const plan = await f.app.workbench.invoke('hb_plan_production', { ...scope, actions: [{ kind: 'storyboard_video', target_id: 4, video_options: options }] })
    assert.deepEqual(plan.steps[0].body, preview.body)
    assert.match(preview.predicted.prompt, /^VHS texture/); assert.ok(!preview.body.prompt.includes('VHS texture'))
    await f.app.workbench.invoke('hb_start_run', { request_key: 'video-request', plan_id: plan.id }); await f.app.workbench.production.tick()
    const sent = f.calls.find(c => c.path === '/tasks' && c.method === 'POST').body
    assert.equal(sent.generate_audio, false); assert.equal(sent.prompt_extend, false); assert.equal(sent.last_frame_url, '/last.png')
    const task = await f.app.workbench.invoke('hb_task_action', { project_id: 1, task_id: 8, action: 'read' })
    assert.equal(task.submission.generate_audio, false); assert.ok(!JSON.stringify(task).includes('NEVER_RETURN_THIS'))
    const history = await f.app.workbench.invoke('hb_task_action', { project_id: 1, action: 'list', character_id: 20, type: 'image' })
    assert.deepEqual(history.items.map((r: any) => r.id), [11])
    const configs = await f.app.workbench.invoke('hb_model_config_action', { action: 'list' })
    assert.equal(configs[0].credential_mask, '********'); assert.ok(!JSON.stringify(configs).includes('NEVER_RETURN_THIS'))
    const probe = await f.app.workbench.invoke('hb_model_config_action', { action: 'test', id: 3, request_key: 'test-config' })
    assert.ok(probe.ok); assert.ok(!JSON.stringify(probe).includes('NEVER_RETURN_THIS'))
    assert.ok(!(await readFile(join(f.dir, 'state.json'), 'utf8')).includes('NEVER_RETURN_THIS'))
  } finally { await f.close() }
})
test('bounded multipart upload accepts remote chunks, rejects offset/hash errors and deduplicates final submit', async () => {
  const f = await fixture()
  try {
    const bytes = Buffer.from('sample-video-data'), sha256 = createHash('sha256').update(bytes).digest('hex')
    const transfer = await f.app.workbench.invoke('hb_upload_begin', { request_key: 'upload-begin', kind: 'video', filename: 'test.mp4', size_bytes: bytes.length, sha256 })
    await assert.rejects(f.app.workbench.invoke('hb_upload_chunk', { request_key: 'bad-offset', upload_id: transfer.upload_id, offset: 4, base64: bytes.toString('base64') }), /exceeds|offset/)
    const chunk = { request_key: 'good-chunk', upload_id: transfer.upload_id, offset: 0, base64: bytes.toString('base64') }
    await f.app.workbench.invoke('hb_upload_chunk', chunk); await f.app.workbench.invoke('hb_upload_chunk', chunk)
    const finish = { request_key: 'upload-finish', upload_id: transfer.upload_id }
    const result = await f.app.workbench.invoke('hb_upload_finish', finish)
    assert.equal(result.path, 'static/upload.mp4'); await f.app.workbench.invoke('hb_upload_finish', finish)
    assert.equal(f.uploads.length, 1); assert.ok(f.uploads[0].includes(bytes))
    await assert.rejects(f.app.workbench.invoke('hb_upload_begin', { request_key: 'huge-audio', kind: 'audio', filename: 'test.mp3', size_bytes: 21 * 1024 * 1024, sha256 }), /limit/)
  } finally { await f.close() }
})
