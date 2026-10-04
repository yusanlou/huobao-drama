import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import { emptyRequirements, parseRequirements, mergeRequirements, agentMessage, inspectVideoInput, productionChecks } from '../../shared/production.mjs'

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
test('post-breakdown completion submits only missing prompt IDs', async () => {
  let submitted
  const ctx = vm.createContext({ refresh: async () => {}, sbs: { value: [{ id: 1, video_prompt: 'approved' }, { id: 2, video_prompt: ' ' }, { id: 3, videoPrompt: 'edited' }] }, batchVideoPrompts: async ids => { submitted = ids } })
  vm.runInContext(functions(['onBreakdownDone']), ctx); await ctx.onBreakdownDone()
  assert.deepEqual(Array.from(submitted), [2])
})

test('requirements accept reactive Vue form values without cloning Proxy failures', () => {
  const { reactive } = require('vue')
  const draft = reactive({ ...emptyRequirements(), target_duration_seconds: 54, must_keep: ['literal speech'] })
  assert.deepEqual(parseRequirements(mergeRequirements('Original', draft)).requirements, JSON.parse(JSON.stringify(draft)))
})

test('new page components render with real Vue and i18n runtime', async () => {
  const { createSSRApp } = require('vue'), { renderToString } = require('@vue/server-renderer'), { createI18n } = require('vue-i18n')
  const { parse, compileScript } = require('@vue/compiler-sfc'), { transformSync } = require('esbuild')
  const messages = JSON.parse(readFileSync(new URL('../app/locales/zh.json', import.meta.url), 'utf8'))
  for (const [name, props] of [
    ['ProductionRequirements', { modelValue: { ...emptyRequirements(), target_duration_seconds: 54 }, dirty: false }],
    ['VideoInputOptions', { modelValue: { mode: 'first_last' }, capabilities: { modes: ['text', 'reference', 'first_frame', 'first_last'], audio: true, extend: true }, defaultAudio: true }],
    ['ProductionChecks', { checks: productionChecks([{ id: 1, duration: 6, description: '旁白：“完整台词。”' }], emptyRequirements(), 1), preview: inspectVideoInput(fixture()) }],
  ]) {
    const source = readFileSync(new URL(`../app/components/${name}.vue`, import.meta.url), 'utf8')
    const script = compileScript(parse(source).descriptor, { id: name, inlineTemplate: true }).content
    const mod = { exports: {} }
    new Function('require', 'module', 'exports', transformSync(script, { format: 'cjs' }).code)(require, mod, mod.exports)
    const app = createSSRApp(mod.exports.default, props)
    app.use(createI18n({ legacy: false, locale: 'zh', messages: { zh: messages } }))
    const html = await renderToString(app)
    assert.match(html, /<details/)
    assert.ok(!html.includes('professional.'))
  }
})
