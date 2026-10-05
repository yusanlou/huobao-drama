import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { completeVideoPrompts, emptyRequirements, parseRequirements, mergeRequirements, agentMessage, inspectVideoInput, productionChecks, requiresContinuityFrame, continuityCheck, parseContinuity, assertContinuityInput, assertContinuityBatch } from '../../shared/production.mjs'

test('requirements preserve surrounding text exactly and reject damaged/duplicate/unknown blocks', () => {
  const req = { ...emptyRequirements(), target_duration_seconds: 54, must_keep: ['事实'] }
  const original = '原说明 \n\n尾行  '
  const appended = mergeRequirements(original, req)
  assert.equal(appended.slice(0, original.length), original)
  assert.deepEqual(parseRequirements(appended).requirements, req)
  const withSuffix = appended + '\n后缀  '
  assert.equal(mergeRequirements(withSuffix, { ...req, target_duration_seconds: 60 }).endsWith('\n后缀  '), true)
  for (const damaged of [appended + appended, appended.replace(':v1', ':v2'), appended.replace('"version": 1', '"version": 9'), '<!-- huobao-production:v1 -->{bad}', '<!-- huobao-production:v1']) assert.throws(() => mergeRequirements(damaged, req))
  assert.equal(parseRequirements('plain text').requirements, null)
  assert.throws(() => mergeRequirements('', { ...req, target_duration_seconds: 0 }))
  const markerText = { ...req, avoid: ['<!-- huobao-production:v1 -->'] }
  assert.deepEqual(parseRequirements(mergeRequirements(original, markerText)).requirements, markerText)
  assert.match(agentMessage('rewrite', { description: appended }), /target_duration_seconds.*54/)
  assert.ok(!agentMessage('rewrite').includes('"target_duration_seconds":60'))
})

const fixture = () => ({ project: { id: 1, aspect_ratio: '16:9' }, episode: { id: 2, resolution: '720p' }, config: { id: 3, provider: 'aliyun', model: ['wan3.0-video'] }, shot: { id: 4, duration: 6, video_prompt: '@林明 进入 @机房。', scene_id: 10, character_ids: [11, 12], prop_ids: [] }, scenes: [{ id: 10, location: '机房', image_url: '/room.png' }], characters: [{ id: 11, name: '林明', image_url: '/hero.png' }, { id: 12, name: '画外旁白' }], props: [] })
test('reference order, dedup and missing offscreen portraits work consistently; invalid mentions fail', () => {
  const f = fixture(), preview = inspectVideoInput(f)
  assert.equal(preview.body.prompt, '@图片2林明 进入 @图片1机房。')
  assert.deepEqual(preview.body.reference_image_urls, ['/room.png', '/hero.png'])
  assert.equal(preview.warnings.length, 1)
  f.shot.video_prompt = '@画外旁白 说话'
  assert.throws(() => inspectVideoInput(f), /Missing image/)
  assert.equal(inspectVideoInput({ ...f, options: { mode: 'text' } }).body.prompt, '画外旁白 说话')
  f.shot.video_prompt = '@不存在'
  assert.throws(() => inspectVideoInput(f), /Unbound reference/)
  f.shot.video_prompt = '@林明'; f.characters.push({ id: 12, name: '林明', image_url: '/other.png' })
  assert.throws(() => inspectVideoInput(f), /Ambiguous asset/)
})
test('no silent reference truncation, native modes and adapter conversions are checked', () => {
  const f = fixture()
  const ten = Array.from({ length: 10 }, (_, i) => `/image${i}.png`)
  f.shot.video_prompt = '静止镜头'
  assert.equal(inspectVideoInput({ ...f, options: { reference_image_urls: ten } }).body.reference_image_urls.length, 10)
  const seedance = { ...f, config: { id: 3, provider: 'volcengine', model: ['doubao-seedance-2-0-mini-260615'] } }
  assert.throws(() => inspectVideoInput({ ...seedance, options: { reference_image_urls: ten } }), /Too many references/)
  assert.throws(() => inspectVideoInput({ ...seedance, options: { duration: 16 } }), /out of range/)
  assert.throws(() => inspectVideoInput({ ...seedance, options: { mode: 'first_frame', first_frame_url: '/f.png' } }), /Unsupported generation mode/)
  const first = inspectVideoInput({ ...f, options: { mode: 'first_last', first_frame_url: '/f.png', last_frame_url: '/l.png', generate_audio: false, prompt_extend: false } })
  assert.deepEqual(first.body.reference_image_urls, [])
  assert.equal(first.body.generate_audio, false); assert.equal(first.body.prompt_extend, false)
  assert.throws(() => inspectVideoInput({ ...f, options: { mode: 'first_last', first_frame_url: '/f.png', last_frame_url: '/l.png', reference_image_urls: ten } }), /conflict/)
  const mini = { ...f, config: { id: 8, provider: 'minimax', model: ['MiniMax-H3'] }, episode: { resolution: '1080p' } }
  assert.throws(() => inspectVideoInput({ ...mini, options: { generate_audio: false } }), /cannot be disabled/)
  assert.equal(inspectVideoInput(mini).predicted.resolution, '2K')
  assert.equal(inspectVideoInput({ ...seedance, episode: { resolution: '1080p' } }).predicted.resolution, '720p')
})
test('preview injects style once without changing submitted prompt; checks remain advisory', () => {
  const f = fixture(), p = inspectVideoInput({ ...f, style_prompt: 'VHS archive' })
  assert.ok(!p.body.prompt.includes('VHS archive')); assert.equal(p.predicted.prompt.split('VHS archive').length, 2)
  const checks = productionChecks([{ id: 1, duration: 6, description: '旁白：“一句完整的话。”', video_prompt: '一句' }], { ...emptyRequirements(), target_duration_seconds: 5 }, 1)
  assert.equal(checks.difference_seconds, 1); assert.deepEqual(checks.missing_quoted_text, ['一句完整的话。']); assert.equal(checks.speech_duration_measured, false)
})

test('editorial evidence follows shot order, accepts native and UI shapes and never approves semantics', () => {
  const shots = [
    { id: 3, storyboard_number: 3, image_prompt: '听到笑声才转头', description: '寻找笑声', duration: 4 },
    { id: 1, storyboard_number: 1, result: '站定镜前', duration: 3 },
    { id: 2, storyboard_number: 2, imagePrompt: '已在微笑的脸', description: '从困倦演到惊讶', videoPrompt: '看清后惊讶', result: '惊讶地看镜子', shotType: '近景', duration: 7 },
  ]
  const checks = productionChecks(shots, emptyRequirements(), '2')
  assert.equal(checks.continuity.previous.end, '站定镜前')
  assert.equal(checks.continuity.current.start_frame, '已在微笑的脸')
  assert.equal(checks.continuity.current.camera.shot_type, '近景')
  assert.equal(checks.continuity.next.start_frame, '听到笑声才转头')
  assert.deepEqual(shots.map(s => s.id), [3, 1, 2])
  // Complete fields can still contradict each other. Do not invent an automatic verdict.
  assert.deepEqual(checks.editorial_review.missing_fields, [])
  assert.equal(checks.editorial_review.status, 'needs_review')
  assert.equal(checks.editorial_review.automatic_approval, false)
  assert.deepEqual(checks.editorial_review.questions.map(q => q.id), ['source_information', 'prompt_transfer', 'reaction', 'transition', 'staging', 'reveal', 'states', 'timing'])
  assert.equal(productionChecks(shots, null, 1).continuity.previous, null)
  assert.equal(productionChecks(shots, null, 3).continuity.next, null)
})

test('no selected shot never leaks the first shot as a false next shot; missing evidence is explicit', () => {
  const shots = [{ id: 1, duration: 4, image_prompt: ' ', result: 'done' }]
  for (const id of [undefined, 99]) {
    const checks = productionChecks(shots, null, id)
    assert.equal(checks.continuity, null)
    assert.equal(checks.next, '')
    assert.equal(checks.editorial_review.status, 'no_selection')
    assert.equal(checks.storyboard_seconds, 4)
  }
  assert.deepEqual(productionChecks(shots, null, 1).editorial_review.missing_fields, ['description', 'image_prompt', 'video_prompt'])
})

test('video Agent messages include missing native start/end/camera evidence without expanding the write scope', () => {
  const storyboards = [
    { id: 1, storyboard_number: 1, result: 'previous end' },
    { id: 2, storyboard_number: 2, image_prompt: 'sleepy face', result: 'surprised face', description: 'discover', duration: 7, angle: 'mirror view', movement: 'static', sound_effect: 'a suppressed laugh', bgm_prompt: 'no music' },
    { id: 3, storyboard_number: 3, image_prompt: 'still looking in mirror', description: 'turn at laugh' },
    { id: 4, storyboard_number: 4, description: 'unrelated private scene' },
  ]
  const message = agentMessage('video_prompt', { storyboard_ids: [2], storyboards })
  for (const text of ['sleepy face', 'surprised face', 'mirror view', 'static', 'previous end', 'turn at laugh', 'a suppressed laugh', 'no music']) assert.ok(message.includes(text))
  assert.ok(!message.includes('unrelated private scene'))
  assert.match(message, /只允许更新指定 ID 的 video_prompt/)
  assert.ok(!agentMessage('rewrite', { storyboards }).includes('sleepy face'))
})

// Run the actual page functions against delayed/failing native saves, without an AI call.
const require = createRequire(new URL('../package.json', import.meta.url))
const { parse: parseJS } = require('@babel/parser')
const page = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
function functions(names) { return parseJS(page, { sourceType: 'module' }).program.body.filter(n => n.type === 'FunctionDeclaration' && names.includes(n.id.name)).map(n => page.slice(n.start, n.end)).join('\n') }
test('rewrite waits for source and requirements saves; failure stops generation and success reporting', async () => {
  let release, requests = [], errors = []
  const wait = new Promise(r => { release = r })
  const ctx = vm.createContext({ localRaw: { value: 'new source' }, episode: { value: { content: 'old' } }, epId: { value: 2 }, dramaId: 1, preparingAgent: { value: false }, rn: { value: false },
    episodeAPI: { update: async () => { requests.push('save'); await wait } }, saveRequirements: async () => { requests.push('requirements'); return '' }, agentMessage, runAgent: async () => { requests.push('agent') }, refresh() {}, chatModelOverride() {}, chatConfigId() {}, toastError: e => errors.push(e.message) })
  vm.runInContext(functions(['saveRaw', 'doRewrite']), ctx)
  const pending = ctx.doRewrite(); await Promise.resolve()
  assert.deepEqual(requests, ['save']); assert.equal(ctx.episode.value.content, 'old')
  release(); await pending
  assert.deepEqual(requests, ['save', 'requirements', 'agent']); assert.equal(ctx.episode.value.content, 'new source')
  requests = []; ctx.episodeAPI.update = async () => { throw Error('save failed') }
  await ctx.doRewrite()
  assert.deepEqual(requests, []); assert.deepEqual(errors, ['save failed']); assert.equal(ctx.preparingAgent.value, false)
})
test('web default breakdown uses shared completion for nonempty short prompts via original APIs', async () => {
  const requests = [], errors = []
  const saved = [{ id: 4, image_prompt: 'saved start', result: 'saved end', duration: 6, video_prompt: 'short existing prompt' }]
  const full = '【画面起点】床边站定。【动作节奏】目光转向窗外。【摄影】固定中景。【光色与材质】侧窗柔光，哑光木框。【声音】无语音，风声。【结束与衔接】看向窗外停住。'
  const ctx = vm.createContext({ videoPromptBatch: { value: { running: false } }, videoPromptPageActive: true, dramaId: 1,
    completeVideoPrompts, readVideoPromptContext: async () => ({ episode: { id: 2, description: '' }, storyboards: structuredClone(saved) }),
    agentMessage, effectiveVideoModelLabel: { value: 'wan' }, chatModelOverride() {}, chatConfigId() {}, refresh: async () => { requests.push('refresh') },
    api: { post: async (path, body) => { requests.push({ path, body }); saved[0].video_prompt = full } }, toastError: e => errors.push(e.message) })
  vm.runInContext(functions(['finishVideoPrompts', 'onBreakdownDone']), ctx)
  await ctx.onBreakdownDone()
  assert.equal(requests[0].path, '/agent/prompt_generator/chat')
  assert.match(requests[0].body.message, /saved start/)
  assert.match(requests[0].body.message, /【光色与材质】/)
  assert.equal(saved[0].video_prompt, full); assert.equal(ctx.videoPromptBatch.value.running, false)
  assert.deepEqual(errors, [])
  ctx.readVideoPromptContext = async () => { throw Error('read failed') }
  await assert.rejects(ctx.onBreakdownDone(), /read failed/)
  assert.equal(requests.filter(x => typeof x === 'object').length, 1)
})

test('single generation saves requirements then forces only selected prompt; errors do not toast success', async () => {
  const requests = [], errors = []
  const ctx = vm.createContext({ videoPromptGeneratingIds: { value: [] }, videoPromptBatch: { value: { running: false } }, rn: { value: false }, preparingAgent: { value: false },
    saveRequirements: async () => { requests.push('requirements') }, finishVideoPrompts: async (ids, force) => { requests.push([Array.from(ids), force]) }, t: s => s,
    toast: { success: () => requests.push('success') }, toastError: e => errors.push(e.message) })
  vm.runInContext(functions(['genVideoPrompt']), ctx)
  await ctx.genVideoPrompt({ id: 4 })
  assert.deepEqual(requests, ['requirements', [[4], true], 'success'])
  assert.deepEqual(Array.from(ctx.videoPromptGeneratingIds.value), [])
  requests.length = 0; ctx.finishVideoPrompts = async () => { throw Error('incomplete') }
  await ctx.genVideoPrompt({ id: 4 })
  assert.deepEqual(requests, ['requirements']); assert.deepEqual(errors, ['incomplete'])
})

test('requirements accept reactive Vue form values without cloning Proxy failures', () => {
  const { reactive } = require('vue')
  const draft = reactive({ ...emptyRequirements(), target_duration_seconds: 54, must_keep: ['literal speech'] })
  assert.deepEqual(parseRequirements(mergeRequirements('Original', draft)).requirements, JSON.parse(JSON.stringify(draft)))
})

test('web video submission stops on missing continuity and on failed fresh reads', async () => {
  const f = fixture(), errors = [], submitted = []
  const ctx = vm.createContext({ saveRequirements: async () => {}, refresh: async () => {}, sbs: { value: [f.shot] },
    selectedSb: { value: f.shot }, continuityDraftDirty: { value: false },
    videoInput: () => inspectVideoInput(f), continuityContext: sb => ({ ...f, shot: sb, storyboards: [f.shot] }), assertContinuityInput,
    videoOptions: { value: {} }, pendingVideoIds: { value: [] }, failedVideoMessages: { value: {} }, toastError: e => errors.push(e.message),
    taskAPI: { generate: async body => { submitted.push(body) } }, t: s => s })
  vm.runInContext(functions(['genVid']), ctx)
  assert.equal(await ctx.genVid(f.shot), false)
  assert.match(errors[0], /尚未填写/); assert.deepEqual(submitted, [])
  ctx.refresh = async strict => { assert.equal(strict, true); throw Error('read failed') }
  assert.equal(await ctx.genVid(f.shot), false)
  assert.equal(errors[1], 'read failed'); assert.deepEqual(submitted, [])
})

test('web batch validates the whole set before submitting any target', async () => {
  const f = fixture(), errors = [], submitted = []
  const ctx = vm.createContext({ batchVideoConfirm: { value: { open: true, targets: [f.shot] } }, saveRequirements: async () => {}, refresh: async () => {}, sbs: { value: [f.shot] }, assertContinuityBatch,
    genVid: async s => { submitted.push(s) }, toastError: e => errors.push(e.message), videoOptions: { value: {} } })
  vm.runInContext(functions(['confirmBatchVideos']), ctx)
  await ctx.confirmBatchVideos()
  assert.match(errors[0], /尚未填写/); assert.deepEqual(submitted, [])
})

test('new page components render with real Vue and i18n runtime', async () => {
  const { createSSRApp } = require('vue'), { renderToString } = require('@vue/server-renderer'), { createI18n } = require('vue-i18n')
  const { parse, compileScript } = require('@vue/compiler-sfc'), { transformSync } = require('esbuild')
  for (const locale of ['zh', 'en', 'ja', 'ko']) {
  const messages = JSON.parse(readFileSync(new URL(`../app/locales/${locale}.json`, import.meta.url), 'utf8'))
  for (const [name, props] of [
    ['ProductionRequirements', { modelValue: { ...emptyRequirements(), target_duration_seconds: 54 }, dirty: false }],
    ['VideoInputOptions', { modelValue: { mode: 'first_last' }, capabilities: { modes: ['text', 'reference', 'first_frame', 'first_last'], audio: true, extend: true }, defaultAudio: true }],
    ['ProductionChecks', { checks: productionChecks([{ id: 1, duration: 6, description: '旁白：“完整台词。”' }], emptyRequirements(), 1, '被子随呼吸轻轻起伏。<script>untrusted()</script>'), preview: inspectVideoInput(fixture()) }],
    ['ContinuityPlan', { shot: fixture().shot, check: continuityCheck([fixture().shot], 4), characters: fixture().characters }],
  ]) {
    const source = readFileSync(new URL(`../app/components/${name}.vue`, import.meta.url), 'utf8')
    const script = compileScript(parse(source).descriptor, { id: name, inlineTemplate: true }).content
    const mod = { exports: {} }
    const componentRequire = id => id === '../../shared-production' ? { parseContinuity, requiresContinuityFrame } : require(id)
    new Function('require', 'module', 'exports', transformSync(script, { format: 'cjs' }).code)(componentRequire, mod, mod.exports)
    const app = createSSRApp(mod.exports.default, props)
    app.use(createI18n({ legacy: false, locale, messages: { [locale]: messages } }))
    const html = await renderToString(app)
    assert.match(html, /<details/)
    assert.ok(!html.includes('professional.'))
    assert.ok(!html.includes('continuity.'))
    if (name === 'ProductionChecks') {
      assert.ok(html.includes(messages.professional.editorialPending))
      assert.ok(html.includes(messages.professional.startFrame))
      assert.ok(html.includes(messages.professional.currentEnd))
      assert.ok(html.includes(messages.professional.check_states))
      assert.ok(html.includes(messages.professional.sourceComparison))
      assert.ok(html.includes('被子随呼吸轻轻起伏。'))
      assert.ok(html.includes(messages.professional.check_source_information))
      assert.ok(html.includes(messages.professional.check_prompt_transfer))
      assert.ok(!html.includes('<script>untrusted()'))
    }
  }
  }
})
