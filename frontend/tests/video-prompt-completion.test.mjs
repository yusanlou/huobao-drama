import test from 'node:test'
import assert from 'node:assert/strict'
import { completeVideoPrompts, videoPromptCoverage, agentMessage, mergeContinuity, inspectVideoInput } from '../../shared/production.mjs'
const full = '【画面起点】门侧中景，手还挡在门口。\n【动作节奏】认出钥匙上的红线，手顿住再收回。\n【摄影】固定平视，眼睛和钥匙同框，红线清晰。\n【光色与材质】店内暖光从右侧照入，旧钥匙暗哑，只有齿边有细窄反光。\n【声音】衣袖摩擦声，无对白、无配乐。\n【结束与衔接】右手收至身体侧面，门口留出通道。'
const clone = x => JSON.parse(JSON.stringify(x))
const context = () => ({ episode: { id: 2, script_content: '认出红线后让路' }, storyboards: [{ id: 1, description: '认出红线后让路', duration: 5, video_prompt: '固定镜头，认出红线后让路。' }, { id: 2, duration: 2, video_prompt: full }] })
test('section inspection catches nonempty summaries, empty headings, placeholders and dropped exact speech', () => {
  assert.equal(videoPromptCoverage(context().storyboards[0]).status, 'needs_detail')
  assert.equal(videoPromptCoverage({ video_prompt: full }).status, 'specified')
  assert.equal(videoPromptCoverage({ video_prompt: full }).semantic_approval, false)
  for (const replacement of ['', '待补充', 'TODO']) assert.deepEqual(videoPromptCoverage({ video_prompt: full.replace('衣袖摩擦声，无对白、无配乐。', replacement) }).missing_sections, ['sound'])
  assert.deepEqual(videoPromptCoverage({ video_prompt: full, description: '旁白：“灯始终没有动。”' }).missing_speech, ['灯始终没有动。'])
  const english = '[Frame] box on desk [Action] shadow unfolds fingers [Camera] locked wide [Light and material] fixed hard overhead light, matte wood [Sound] no speech [End and continuity] five fingers remain'
  assert.equal(videoPromptCoverage({ video_prompt: english }).status, 'specified')
})
test('default completion refines nonempty drafts and skips specified ones, supplying fresh full context', async () => {
  const c = context(), calls = [], progress = []
  c.storyboards[0].image_prompt = 'hand still blocks door'; c.storyboards[0].movement = 'fixed'
  const report = await completeVideoPrompts({ readContext: async () => clone(c), generate: async (id, fresh) => {
    calls.push(id); assert.equal(fresh.storyboards[0].image_prompt, 'hand still blocks door'); c.storyboards[0].video_prompt = full
  }, onProgress: p => progress.push(p) })
  assert.deepEqual(calls, [1]); assert.equal(report.status, 'specified'); assert.equal(report.semantic_approval, false)
  assert.deepEqual(report.generated, [1]); assert.deepEqual(progress.at(-1), { total: 1, completed: 1 })
  assert.equal(c.episode.script_content, '认出红线后让路')
})
test('short light transition can be concise but must specify the six relevant dimensions', async () => {
  const c = context(); c.storyboards = [{ id: 9, duration: 2, video_prompt: '【画面起点】固定窗框，窗外靛蓝。【动作节奏】两秒内天色渐亮。【摄影】固定近景，不切镜。【光色与材质】冷蓝渐变淡金，木框保持哑光。【声音】无语言、无配乐，风声延续。【结束与衔接】晨光稳定，窗框位置不变。' }]
  const result = await completeVideoPrompts({ readContext: async () => clone(c), generate: async () => assert.fail('No padding call needed') })
  assert.deepEqual(result.generated, [])
})
test('one failed or still-incomplete refinement stops remaining IDs without retry', async () => {
  for (const mode of ['transport', 'incomplete']) {
    const c = context(); c.storyboards[1].video_prompt = ''; const calls = []
    await assert.rejects(completeVideoPrompts({ readContext: async () => clone(c), generate: async id => {
      calls.push(id); if (mode === 'transport') throw Error('response lost'); c.storyboards[0].video_prompt = 'still a summary'
    } }), mode === 'transport' ? /response lost/ : /仍有缺项/)
    assert.deepEqual(calls, [1])
  }
})
test('conflicting source edits stop dispatch; out-of-scope writes stop subsequent IDs', async () => {
  for (const phase of ['before', 'after']) {
    const c = context(), calls = []; let reads = 0
    await assert.rejects(completeVideoPrompts({ readContext: async () => {
      if (++reads === 2 && phase === 'before') c.episode.script_content = 'user edit'
      return clone(c)
    }, generate: async id => { calls.push(id); c.storyboards[0].video_prompt = full; c.storyboards[0].description = 'unexpected change' } }), e => e.code === 'PROMPT_SOURCE_CHANGED')
    assert.deepEqual(calls, phase === 'before' ? [] : [1])
  }
})
test('explicit regeneration scopes IDs and unchanged existing text is not treated as regenerated', async () => {
  const c = context(); const calls = []
  await assert.rejects(completeVideoPrompts({ readContext: async () => clone(c), storyboardIds: [2], force: true, generate: async id => { calls.push(id) } }), e => e.code === 'PROMPT_UNCHANGED')
  assert.deepEqual(calls, [2])
  for (const ids of [[], [1, 1], [99]]) await assert.rejects(completeVideoPrompts({ readContext: async () => clone(c), storyboardIds: ids, generate: async () => assert.fail() }), e => e.code === 'PROMPT_SCOPE')
})
test('both native creative instructions include the same full specification, rewrite remains narrative', () => {
  for (const kind of ['breakdown', 'video_prompt']) {
    const message = agentMessage(kind, { storyboard_ids: [1], storyboards: context().storyboards })
    for (const term of ['【画面起点】', '【光色与材质】', '【结束与衔接】', '逐字台词']) assert.ok(message.includes(term))
  }
  assert.ok(!agentMessage('rewrite').includes('【摄影】'))
})
test('time-cut request does not command omitted offscreen actions to be performed', () => {
  const shot = { id: 1, duration: 2, video_prompt: '窗外从夜到晨，人物保持画外。', result: mergeContinuity('晨光稳定。', { version: 1, transition: 'time_cut', reason: '过夜，省略贴片过程', space: '窗框固定', camera: '窗户近景', start: [], end: [] }) }
  const body = inspectVideoInput({ project: { id: 1 }, episode: { id: 2 }, shot, storyboards: [{ id: 0, storyboard_number: 1 }, { ...shot, storyboard_number: 2 }], config: { id: 1, provider: 'aliyun', model: 'wan3.0-video' }, options: { mode: 'text' } }).body
  assert.match(body.prompt, /省略的事件不补演/); assert.doesNotMatch(body.prompt, /按本镜动作完成状态变化/)
})
