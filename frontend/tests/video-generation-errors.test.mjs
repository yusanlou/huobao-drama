import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import vm from 'node:vm'
import * as contracts from '../../shared/production.mjs'
const require = createRequire(new URL('../package.json', import.meta.url))
const { parse } = require('@babel/parser'), { transformSync } = require('esbuild')
const source = readFileSync(new URL('../app/views/drama/episode.vue', import.meta.url), 'utf8').split('<script setup>')[1].split('</script>')[0]
const fn = parse(source, { sourceType: 'module' }).program.body.find(n => n.type === 'FunctionDeclaration' && n.id.name === 'genVid')
const genVid = source.slice(fn.start, fn.end)
function toastHarness(locale = 'zh') {
  const messages = JSON.parse(readFileSync(new URL(`../app/locales/${locale}.json`, import.meta.url), 'utf8'))
  const t = key => key.split('.').reduce((value, part) => value?.[part], messages) || key
  const notifications = [], mod = { exports: {} }
  const script = readFileSync(new URL('../app/composables/useToast.ts', import.meta.url), 'utf8')
  new Function('require', 'module', 'exports', transformSync(script, { loader: 'ts', format: 'cjs' }).code)(id => {
    if (id === 'vue-sonner') return { toast: { error: m => notifications.push(m) } }
    if (id.includes('shared-production')) return contracts
    return { i18n: { global: { t, locale: { value: locale } } } }
  }, mod, mod.exports)
  return { t, notifications, ...mod.exports }
}
function fixture(transition = 'cut') {
  const state = { id: 1, position: 'beside bed', pose: 'standing, looking at bed', appearance: 'brown fur, no clothing', visible: true }
  const plan = { version: 1, transition: 'start', reason: 'Opening', space: 'bed left, door front', camera: 'door wide', start: [state], end: [state] }
  const storyboards = [
    { id: 1, storyboard_number: 1, character_ids: [1], duration: 5, result: contracts.mergeContinuity('', plan), video_url: '/previous.mp4' },
    { id: 2, storyboard_number: 2, character_ids: [1], duration: 2, result: contracts.mergeContinuity('', { ...plan, transition, reason: 'Closer view of the same action', camera: transition === 'continuous' ? plan.camera : 'door medium close' }), video_prompt: '踮脚，轻轻抬手。' },
  ]
  return { project: { id: 1 }, episode: { id: 1 }, shot: storyboards[1], storyboards, characters: [{ id: 1, name: '弟弟', image_url: '/portrait.png' }], config: { id: 1, provider: 'aliyun', model: ['wan3.0-video'] } }
}
function pageHarness(c, options = { mode: 'reference' }) {
  const notification = toastHarness(), submissions = []
  const ctx = vm.createContext({ ...contracts, ...notification,
    selectedSb: { value: c.shot }, continuityDraftDirty: { value: false }, saveRequirements: async () => {}, refresh: async () => {},
    sbs: { value: c.storyboards }, epId: { value: 1 }, videoOptions: { value: options },
    videoInput: shot => contracts.inspectVideoInput({ ...c, shot, options }), continuityContext: shot => ({ ...c, shot }),
    failedVideoMessages: { value: {} }, pendingVideoIds: { value: [] }, isPendingVideo: () => false,
    taskAPI: { listByEpisode: async () => ({ tasks: [] }), generate: async body => { submissions.push(body); return { id: 10 } } },
    toast: { success() {} }, pollVideoGeneration() {},
  })
  vm.runInContext(genVid, ctx)
  return { ctx, submissions, ...notification }
}
test('real page handler submits a camera cut in default reference mode, without demanding first-frame review', async () => {
  const c = fixture(), p = pageHarness(c)
  assert.equal(await p.ctx.genVid(c.shot), true, p.notifications.join('\n'))
  assert.equal(p.submissions.length, 1)
  assert.deepEqual(p.submissions[0].reference_image_urls, ['/portrait.png'])
  assert.equal(p.submissions[0].first_frame_url, undefined)
  assert.match(p.submissions[0].prompt, /beside bed/)
  assert.deepEqual(p.notifications, [])
})
test('same-camera continuation remains blocked and displays the actual preparation step, not video failure', async () => {
  const c = fixture('continuous'), p = pageHarness(c)
  assert.equal(await p.ctx.genVid(c.shot), false)
  assert.equal(p.submissions.length, 0)
  assert.match(p.notifications[0], /首帧|接续/)
  assert.notEqual(p.notifications[0], '视频生成失败')
})
test('choosing first-frame mode for a cut still requires a fresh review; reference mode never fakes a review', () => {
  const c = fixture(), options = { mode: 'first_frame', first_frame_url: '/frame.png' }
  const body = contracts.inspectVideoInput({ ...c, options }).body
  assert.throws(() => contracts.assertContinuityInput(c, body, options), /核对/)
  options.continuity_review = { snapshot: contracts.continuitySnapshot(c), frame_url: '/frame.png' }
  assert.doesNotThrow(() => contracts.assertContinuityInput(c, body, options))
  c.storyboards[0].video_url = '/new.mp4'
  assert.throws(() => contracts.assertContinuityInput(c, body, options), /核对/)
})
test('state jumps, missing predecessor and active predecessor still block reference cuts with useful errors', async () => {
  for (const change of ['state', 'previous', 'running']) {
    const c = fixture(), p = pageHarness(c)
    if (change === 'state') { const plan = contracts.parseContinuity(c.shot.result).plan; plan.start[0].position = 'across room'; c.shot.result = contracts.mergeContinuity('', plan) }
    if (change === 'previous') c.storyboards[0].video_url = ''
    if (change === 'running') p.ctx.taskAPI.listByEpisode = async () => ({ tasks: [{ type: 'video', storyboard_id: 1, status: 'processing' }] })
    assert.equal(await p.ctx.genVid(c.shot), false)
    assert.equal(p.submissions.length, 0)
    assert.notEqual(p.notifications[0], '视频生成失败')
  }
})
test('trusted local validation is readable; raw provider errors remain hidden and unknown text keeps its fallback', () => {
  for (const locale of ['zh', 'en']) {
    const { mapError } = toastHarness(locale)
    const error = new contracts.ContinuityError('接续画面尚未核对，请先准备首帧 / Review the first frame before generating.')
    assert.match(mapError(error, { fallback: 'episode.vid.genFailed' }), locale === 'zh' ? /首帧/ : /first frame/)
    assert.ok(!mapError(new Error('provider crashed secret=PRIVATE'), { fallback: 'episode.vid.genFailed' }).includes('PRIVATE'))
  }
})
test('reference-only adapter can prepare a camera cut, while same-camera continuation keeps its frame requirement', () => {
  const c = fixture(); c.shot.duration = 4
  c.config = { id: 2, provider: 'volcengine', model: ['doubao-seedance-2-0'] }
  const preview = contracts.inspectVideoInput({ ...c, options: { mode: 'reference' } })
  assert.equal(preview.continuity.requires_first_frame, false)
  assert.doesNotThrow(() => contracts.assertContinuityInput(c, preview.body, { mode: 'reference' }))
  assert.match(preview.warnings.join(' '), /不锁定首帧/)
  assert.equal(contracts.requiresContinuityFrame(contracts.continuityCheck(fixture('continuous').storyboards, 2), { mode: 'reference' }), true)
})
test('multiple continuity conflicts retain every localized line in the real page error', async () => {
  const c = fixture(), plan = contracts.parseContinuity(c.shot.result).plan
  plan.start[0].pose = 'sitting'
  plan.start[0].appearance = 'new clothing'
  c.shot.result = contracts.mergeContinuity('', plan)
  const p = pageHarness(c)
  assert.equal(await p.ctx.genVid(c.shot), false)
  assert.equal(p.submissions.length, 0)
  assert.match(p.notifications[0], /pose/)
  assert.match(p.notifications[0], /appearance/)
  assert.equal(p.notifications[0].split('\n').length, 2)
  const error = new contracts.ContinuityError(contracts.continuityCheck(c.storyboards, c.shot.id).issues.map(i => i.message).join('\n'))
  const english = toastHarness('en').mapError(error)
  assert.equal(english.split('\n').length, 2)
  assert.doesNotMatch(english, /[一-鿿]/)
})
