// Shared by the web page and MCP; stored in the existing storyboard.result field.
// These are blocking structural checks, not proof that a model rendered correctly.
const OPEN = '<!-- huobao-continuity:v1 -->'
const CLOSE = '<!-- /huobao-continuity:v1 -->'
const read = (row, a, b) => row?.[a] ?? row?.[b]
export class ContinuityError extends Error { constructor(message) { super(message); this.code = 'CONTINUITY' } }
const assert = (ok, message) => { if (!ok) throw new ContinuityError(message) }
const text = v => typeof v === 'string' && v.trim() && v.length <= 4000
export function validateContinuity(plan) {
  assert(plan && plan.version === 1 && ['start', 'continuous', 'cut', 'time_cut'].includes(plan.transition), '接续表版本或切镜类型无效 / Invalid continuity plan.')
  assert(Object.keys(plan).every(k => ['version', 'transition', 'reason', 'space', 'camera', 'start', 'end'].includes(k)), '接续表含未知字段 / Unknown continuity field.')
  for (const k of ['reason', 'space', 'camera']) assert(text(plan[k]), `接续表缺少 ${k} / Missing continuity ${k}.`)
  for (const key of ['start', 'end']) {
    assert(Array.isArray(plan[key]) && plan[key].length <= 100, '人物状态必须是列表 / Character states must be an array.')
    assert(new Set(plan[key].map(s => s.id)).size === plan[key].length, '人物状态不能重复 / Duplicate character state.')
    for (const state of plan[key]) {
      assert(state && Number.isSafeInteger(state.id) && state.id > 0 && typeof state.visible === 'boolean', '人物 ID 或是否入画无效 / Invalid character ID or visibility.')
      assert(Object.keys(state).every(k => ['id', 'position', 'pose', 'appearance', 'visible'].includes(k)), '人物状态含未知字段 / Unknown character state field.')
      for (const k of ['position', 'pose', 'appearance']) assert(text(state[k]), `人物 ${state.id} 缺少 ${k} / Missing character state.`)
    }
  }
  assert(JSON.stringify(plan.start.map(s => s.id).sort()) === JSON.stringify(plan.end.map(s => s.id).sort()), '同镜起止须跟踪同一组人物，离开画面的人也保留位置 / Track offscreen characters at both ends.')
  return JSON.parse(JSON.stringify(plan))
}
export function parseContinuity(result = '') {
  const marks = [...result.matchAll(/<!--\s*\/?huobao-continuity\b[^>]*-->/g)]
  const count = (result.match(/<!--\s*\/?huobao-continuity\b/g) || []).length
  if (!count) return { plan: null, text: result, start: -1, end: -1 }
  assert(count === 2 && marks.length === 2 && marks[0][0] === OPEN && marks[1][0] === CLOSE, '接续表标记损坏、重复或版本未知，请修复后生成 / Invalid continuity block.')
  let value
  try { value = JSON.parse(result.slice(marks[0].index + OPEN.length, marks[1].index)) } catch { assert(false, '接续表 JSON 损坏 / Invalid continuity JSON.') }
  const start = marks[0].index, end = marks[1].index + CLOSE.length
  return { plan: validateContinuity(value), text: result.slice(0, start) + result.slice(end), start, end }
}
export function mergeContinuity(result, plan) {
  const old = parseContinuity(result || '')
  const block = `${OPEN}\n${JSON.stringify(validateContinuity(plan), null, 2).replace(/</g, '\\u003c')}\n${CLOSE}`
  return old.start < 0 ? (result || '') + '\n' + block : result.slice(0, old.start) + block + result.slice(old.end)
}
export function orderedShots(shots) {
  const order = s => Number(read(s, 'storyboard_number', 'storyboardNumber') ?? s.shot_number)
  return shots.every(s => Number.isFinite(order(s))) ? [...shots].sort((a, b) => order(a) - order(b)) : [...shots]
}
export function continuityCheck(shots, id) {
  const rows = orderedShots(shots), index = rows.findIndex(s => Number(s.id) === Number(id))
  const shot = rows[index], previous = rows[index - 1], issues = []
  let plan = null, previousPlan = null
  const issue = (code, message) => issues.push({ code, message })
  if (!shot) return { plan, previous: null, issues, needs_frame: false, automatic_approval: false }
  if (previous) { try { previousPlan = parseContinuity(previous.result || '').plan } catch { /* Report below only when this shot depends on it. */ } }
  try { plan = parseContinuity(shot.result || '').plan } catch (e) { issue('invalid_plan', e.message) }
  if (!plan && !issues.length) issue('missing_plan', '尚未填写接续表；先确认空间、起止状态和切镜方式 / Add the continuity plan before generation.')
  if (plan) {
    if (!previous && plan.transition !== 'start') issue('first_shot', '第一镜须标为开场 / First shot must use start.')
    if (previous && plan.transition === 'start') issue('unexpected_start', '中途不能重置为开场，请明确换机位或时间跳切 / Use cut or time_cut after the first shot.')
    const bound = (read(shot, 'character_ids', 'characterIds') || []).map(Number)
    for (const characterId of bound) if (!plan.start.some(s => s.id === characterId)) issue('untracked_character', `人物 ${characterId} 已绑定但未交代状态 / Bound character has no tracked state.`)
    for (const state of [...plan.start, ...plan.end]) if (state.visible && !bound.includes(state.id)) issue('unbound_character', `人物 ${state.id} 入画但未绑定素材 / Visible character is not bound.`)
    if (previous && ['continuous', 'cut'].includes(plan.transition)) {
      try { previousPlan = parseContinuity(previous.result || '').plan } catch (e) { issue('invalid_previous', e.message) }
      if (!previousPlan) issue('missing_previous', '上一镜缺少有效接续表 / Previous shot needs a continuity plan.')
      else {
        if (previousPlan.space !== plan.space) issue('space_changed', '连续时空的布景定义发生变化 / Spatial layout changed without a time/place cut.')
        if (plan.transition === 'continuous' && previousPlan.camera !== plan.camera) issue('camera_changed', '同机位接续不能改变机位 / Continuous handoff changed camera.')
        const ids = new Set([...previousPlan.end, ...plan.start].map(s => s.id))
        for (const characterId of ids) {
          const from = previousPlan.end.find(s => s.id === characterId), to = plan.start.find(s => s.id === characterId)
          if (!from || !to) { issue('unestablished_character', `人物 ${characterId} 突然出现或丢失，画外角色也须交代位置 / Character appears or disappears without a tracked location.`); continue }
          for (const key of ['position', 'pose', 'appearance', ...(plan.transition === 'continuous' ? ['visible'] : [])]) {
            if (from[key] !== to[key]) issue('state_jump', `人物 ${characterId} 的 ${key} 与上一镜结束不一致 / Character state jumps at the cut.`)
          }
        }
      }
    }
  }
  return { plan, previous: previous ? { id: previous.id, video_url: read(previous, 'video_url', 'videoUrl') || '', plan: previousPlan } : null, issues,
    needs_frame: !!previous && ['continuous', 'cut'].includes(plan?.transition), automatic_approval: false }
}

// Exact serialized snapshot, not a security token or an AI/human quality verdict.
// Changing prompts, bindings, camera, source, assets or predecessor video invalidates review.
export function continuitySnapshot({ episode, project, shot, storyboards, characters = [], scenes = [], props = [] }) {
  const rows = orderedShots(storyboards), i = rows.findIndex(s => Number(s.id) === Number(shot.id))
  const dependent = continuityCheck(storyboards, shot.id).needs_frame
  const fields = ['id', 'duration', 'description', 'result', 'image_prompt', 'video_prompt', 'scene_id', 'character_ids', 'prop_ids', 'shot_type', 'angle', 'movement', 'atmosphere', 'sound_effect', 'bgm_prompt']
  const camel = key => key.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
  const select = row => row ? fields.map(k => read(row, k, camel(k)) ?? null) : null
  const assets = group => [...group].sort((a, b) => Number(a.id) - Number(b.id)).map(a => [a.id, read(a, 'image_url', 'imageUrl') || '', a.description || '', a.prompt || '', a.appearance || ''])
  return JSON.stringify([1, episode.id, read(episode, 'script_content', 'scriptContent') || episode.content || '', episode.description || '',
    project.style || '', project.aspect_ratio || project.aspectRatio || '', rows[i - 1]?.id ?? null, dependent ? select(rows[i - 1]) : null, dependent ? read(rows[i - 1], 'video_url', 'videoUrl') || '' : '', select(shot), assets(characters), assets(scenes), assets(props)])
}
// Cuts preserve world state, not the preceding camera's pixels. Strict frame
// review applies to same-camera continuation or explicitly chosen frame modes.
export function requiresContinuityFrame(check, options = {}) {
  return !!check.needs_frame && (check.plan?.transition === 'continuous' || ['first_frame', 'first_last'].includes(options.mode))
}
export function assertContinuityInput(context, body, options) {
  const check = continuityCheck(context.storyboards, context.shot.id)
  assert(!check.issues.length, check.issues.map(i => i.message).join('\n'))
  const linked = new Set((context.characters || []).map(c => Number(c.id)))
  assert(check.plan.start.every(s => linked.has(s.id)), '接续表使用了本集没有的角色 ID / Continuity plan contains a character outside this episode.')
  if (check.needs_frame) {
    assert(check.previous.video_url, '先生成并检查上一段视频，再准备本镜接续画面 / Previous video must exist before this handoff.')
  }
  if (requiresContinuityFrame(check, options)) {
    assert(['first_frame', 'first_last'].includes(options.mode), '同机位连续动作需要首帧接续，请在本次视频选项选择首帧模式并准备接续画面 / Same-camera continuation needs first-frame mode and a prepared handoff frame.')
    const review = options.continuity_review
    assert(review?.snapshot === continuitySnapshot(context), '接续画面尚未核对或原数据已改变，请重新对照上一段结尾 / Continuity review missing or stale.')
    assert(review.frame_url && review.frame_url === body.first_frame_url, '核对的接续画面必须实际作为首帧提交；不能只传角色参考图 / Submit the reviewed handoff image as the first frame.')
  }
  return check
}
export function assertContinuityBatch(shots, selectedIds) {
  const rows = orderedShots(shots), chosen = new Set(selectedIds.map(Number))
  for (const shot of rows.filter(s => chosen.has(Number(s.id)))) {
    const check = continuityCheck(rows, shot.id)
    assert(!check.issues.length, check.issues.map(i => i.message).join('\n'))
    let i = rows.findIndex(s => s.id === shot.id)
    while (i > 0) {
      const link = continuityCheck(rows, rows[i].id)
      if (!link.needs_frame) break
      i--
      assert(!chosen.has(Number(rows[i].id)), '批次同时包含前后依赖镜头；先验收前镜，再准备后镜首帧 / Dependent shots cannot share a batch, even when dispatched serially.')
    }
  }
}
export function assertContinuityTasks(shots, id, tasks) {
  assert(Array.isArray(tasks), '无法读取生成任务，暂不提交 / Cannot verify active video tasks.')
  const check = continuityCheck(shots, id)
  const ids = [Number(id), ...(check.needs_frame ? [Number(check.previous.id)] : [])]
  assert(!tasks.some(t => t.type === 'video' && ids.includes(Number(read(t, 'storyboard_id', 'storyboardId'))) && !['completed', 'failed', 'cancelled'].includes(t.status)),
    '本镜或上一镜仍在生成，完成并核对后再继续 / Current or preceding video is still generating.')
}
