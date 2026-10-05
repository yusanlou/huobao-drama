import test from 'node:test'
import assert from 'node:assert/strict'
import { mergeContinuity, parseContinuity, continuityCheck, continuitySnapshot, assertContinuityInput, assertContinuityBatch, assertContinuityTasks, inspectVideoInput } from '../../shared/production.mjs'

const clone = x => JSON.parse(JSON.stringify(x))
const person = (id, position = 'bed foot') => ({ id, position, pose: 'standing, paws down', appearance: id === 13 ? 'three cheek bandages' : 'clean face', visible: true })
const plan = transition => ({ version: 1, transition, reason: 'Action continues without elapsed time', space: 'bed left; mirror right; door foreground', camera: 'door wide, same side of axis', start: [person(13, 'mirror'), person(14)], end: [person(13, 'mirror'), person(14)] })
function fixture() {
  const shots = ['start', 'continuous', 'cut'].map((kind, i) => ({ id: i + 1, storyboard_number: i + 1, character_ids: [13, 14], duration: 4, video_prompt: '哥哥回头，弟弟留在床尾。', result: mergeContinuity('Both standing.', plan(kind)), video_url: `/v${i + 1}.mp4` }))
  return { project: { id: 1, style: 'animation' }, episode: { id: 2, script_content: 'script' }, shot: shots[1], storyboards: shots, config: { id: 3, provider: 'aliyun', model: ['wan3.0-video'] }, characters: [{ id: 13, name: '哥哥' }, { id: 14, name: '弟弟' }] }
}
test('continuity block roundtrips without erasing endings and rejects damaged/duplicate data', () => {
  const source = 'Ending\n', saved = mergeContinuity(source, plan('start')) + '\nPostscript'
  assert.equal(parseContinuity(saved).text, source + '\n\nPostscript')
  assert.ok(mergeContinuity(saved, plan('time_cut')).endsWith('\nPostscript'))
  for (const bad of [saved + saved, saved.replace(':v1', ':v2'), '<!-- huobao-continuity:v1', saved.replace('"version": 1', '"version": 2')]) assert.throws(() => mergeContinuity(bad, plan('start')))
  const p = plan('start'); p.reason = '<!-- huobao-continuity:v1 -->'
  assert.deepEqual(parseContinuity(mergeContinuity('', p)).plan, p)
})
test('reported position resets, sudden characters and appearance transfer are blocked', () => {
  for (const [field, value] of [['position', 'on bed again'], ['pose', 'sitting again'], ['appearance', 'clean face again']]) {
    const f = fixture(), p = plan('continuous'); p.start[0][field] = value; f.shot.result = mergeContinuity('', p)
    assert.ok(continuityCheck(f.storyboards, 2).issues.some(i => i.code === 'state_jump'))
    assert.throws(() => assertContinuityInput(f, {}, {}), /不一致/)
  }
  const f = fixture(), p = plan('continuous'); p.start.push(person(15)); p.end.push(person(15)); f.shot.result = mergeContinuity('', p)
  assert.ok(continuityCheck(f.storyboards, 2).issues.some(i => i.code === 'unestablished_character'))
  assert.ok(continuityCheck(f.storyboards, 2).issues.some(i => i.code === 'unbound_character'))
})
test('camera cuts change visibility but preserve world state; time jumps establish new state explicitly', () => {
  const f = fixture(), p = plan('cut'); p.camera = 'mirror insert'; p.start[1].visible = false; p.end[1].visible = false
  f.shot.result = mergeContinuity('', p)
  assert.deepEqual(continuityCheck(f.storyboards, 2).issues, [])
  p.transition = 'continuous'; f.shot.result = mergeContinuity('', p)
  assert.ok(continuityCheck(f.storyboards, 2).issues.some(i => i.code === 'camera_changed'))
  p.transition = 'time_cut'; p.reason = 'Night to morning, character walked during the omitted interval'; p.start[0].position = 'door'
  f.shot.result = mergeContinuity('', p)
  assert.deepEqual(continuityCheck(f.storyboards, 2).issues, [])
  assert.equal(continuityCheck(f.storyboards, 2).needs_frame, false)
  assert.equal(continuityCheck(f.storyboards, 2).automatic_approval, false)
})
test('only a reviewed actual first-frame request passes; any predecessor/source change invalidates review', () => {
  const f = fixture(), options = { mode: 'first_frame', first_frame_url: '/handoff.png' }
  options.continuity_review = { snapshot: continuitySnapshot(f), frame_url: options.first_frame_url }
  const body = inspectVideoInput({ ...f, options }).body
  assert.doesNotThrow(() => assertContinuityInput(f, body, options))
  assert.match(body.prompt, /弟弟：入画；bed foot/)
  assert.match(body.prompt, /clean face/)
  assert.equal(body.first_frame_url, '/handoff.png')
  assert.ok(!('continuity_review' in body))
  assert.throws(() => assertContinuityInput(f, { reference_image_urls: ['/handoff.png'] }, options), /首帧提交/)
  for (const edit of [g => { g.storyboards[0].video_url = '/replacement.mp4' }, g => { g.shot.video_prompt += ' new' }, g => { g.episode.script_content += ' revised' }, g => { g.storyboards[0].result += 'changed' }, g => { g.characters[0].image_url = '/new.png' }]) {
    const g = clone(f); g.shot = g.storyboards[1]; edit(g)
    assert.throws(() => assertContinuityInput(g, body, options), /已改变/)
  }
  f.storyboards[0].video_url = ''
  assert.throws(() => assertContinuityInput(f, body, options), /上一段视频/)
})
test('batch refuses direct and indirect dependencies before any submission; independent jumps can batch', () => {
  const f = fixture()
  assert.throws(() => assertContinuityBatch(f.storyboards, [1, 2]), /不能|批次/)
  assert.throws(() => assertContinuityBatch(f.storyboards, [1, 3]), /批次/)
  f.storyboards[1].result = mergeContinuity('', { ...plan('time_cut'), reason: 'Next morning' })
  assert.doesNotThrow(() => assertContinuityBatch(f.storyboards, [1, 3]))
  assert.doesNotThrow(() => assertContinuityBatch(f.storyboards, [1, 2]))
  f.storyboards[0].result = 'legacy ending'
  assert.throws(() => assertContinuityBatch(f.storyboards, [1]), /尚未填写/)
})
test('old and malformed plans remain readable but are never treated as an approved handoff', () => {
  const f = fixture(); f.shot.result = 'Old text'
  const preview = inspectVideoInput(f)
  assert.equal(preview.continuity.issues[0].code, 'missing_plan')
  assert.throws(() => assertContinuityInput(f, preview.body, {}), /尚未填写/)
  f.shot.result = '<!-- huobao-continuity:v1 -->{}'
  assert.equal(continuityCheck(f.storyboards, 2).issues[0].code, 'invalid_plan')
})
test('an in-flight predecessor cannot be reviewed using an older completed video', () => {
  const f = fixture()
  assert.throws(() => assertContinuityTasks(f.storyboards, 2, [{ type: 'video', storyboard_id: 1, status: 'processing' }]), /仍在生成/)
  assert.throws(() => assertContinuityTasks(f.storyboards, 2, undefined), /无法读取/)
  assert.doesNotThrow(() => assertContinuityTasks(f.storyboards, 2, [{ type: 'video', storyboard_id: 1, status: 'completed' }]))
})
