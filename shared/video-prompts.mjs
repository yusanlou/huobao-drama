// One specification for native storyboard_breaker, prompt_generator, web and MCP.
// The generated Skill sections are checked by scripts/sync-video-prompt-policy.mjs.
export const VIDEO_PROMPT_POLICY = `## 默认视频提示词交付规范

每条 video_prompt 是可独立提交的视频生成指令，不是剧情摘要。拆分时就完整填写，不能把专业细节留给用户再次点生成。description、image_prompt、atmosphere、摄影、sound_effect、bgm_prompt 和 result 不会自动全量传给视频模型；把本镜成立所需的信息转译到 video_prompt。已有参考图负责身份和静态外观，仍须明确动态变化、可见范围及临时道具状态。全局风格由服务端注入，局部光色材质必须与之相容，不一律改成写实或水彩。

使用下面六个短标题分段保存（中文用中文标题，其他语言可用对应英文标题、正文跟随内容语言）。各段必须有本镜具体内容，不得写“同上、按剧本、参考画面、待补充”。短转场可以简洁，不用凑字数；复杂表演应写足，不能只写“固定镜头＋动作＋无台词”。

【画面起点】 / [Frame]：写本镜开始时观众实际看见什么；谁在何处、前后层次、朝向、关键道具及遮挡。对应 image_prompt 的动作之前状态；严格限制何时揭晓。画外人物保留世界位置但不额外入画。
【动作节奏】 / [Action]：以“触发→反应→行动→停住”中本镜确有的环节写可见过程，包括视线、表情、重心、步态、接触关系与速度变化。按本镜真实时长分配事件预算，动作可合理并行，不固定三秒一段，不追加剧情；2 秒光变只描述连续光变，不硬塞完整人物表演。
【摄影】 / [Camera]：景别、机位高低/方向、轴线和构图，让关键细节实际可读。一种主要运镜，或有理由的固定机位；写运动起止与目的，不堆互相冲突的推拉摇移。镜中倒影不生成第二个实体人物。
【光色与材质】 / [Light and material]：本镜主光从哪来、方向和软硬、亮暗层次、主次色与饱和倾向；选直接影响观感的表面写具体可见表现，如柔软织物随呼吸起伏、哑光木面漫反射、纸纤维边缘。按项目风格选材质表现，不能凭空新增布景或衣物。动态光影说明变化来源，普通阴影服从光源与物体；异常必须有故事依据并明确正常基准和异常过程。不要虚构摩擦系数、弹性模量、渲染器参数或无效画质词。
【声音】 / [Sound]：说话者＋逐字台词、进入时机及完整收尾余量；继承原文，不以“介绍背景”替代文字。无语言时明确无旁白/对白，只写有依据的动作声、环境声及配乐有无，禁止含糊人声。旁白长度与动作预算冲突应报告，不能截断或极快念完。文字仅描述音轨意图，不宣称已合成或精确同步。
【结束与衔接】 / [End and continuity]：具体终态、目光/持物/位置及下镜接点，保持 reveal 顺序与方向。结束状态与 result 一致，不能重演前镜已完成的反应。time_cut 的省略发生在切口时，start 必须是省略后的本镜首帧，不能把前镜 end 当成本镜 start 再要求在镜内补演；若确为镜内可见过程，须由本镜 description 明确说明。仅补提示词时发现上游矛盾，指出字段并停止，不擅改分镜来凑齐六段。

保存前逐项反查“剧本有用信息→分镜表达→video_prompt”：动作的过程而非只有结果、表情反应、空间关系、光线变化、声音触发和揭晓顺序均需有落点。六段齐全只是信息结构检查，不证明内容正确；保存后读取指定分镜，确认确实更新，再报告删减和未解决冲突。不得把工具成功、字数或标题齐全称为专业质量验收通过。`

const sections = [
  ['frame', '画面起点', 'Frame'], ['action', '动作节奏', 'Action'], ['camera', '摄影', 'Camera'],
  ['look', '光色与材质', 'Light and material'], ['sound', '声音', 'Sound'], ['ending', '结束与衔接', 'End and continuity'],
]
export function videoPromptCoverage(shot) {
  const prompt = String(shot?.video_prompt ?? shot?.videoPrompt ?? '')
  const blocks = [...prompt.matchAll(/(?:【([^】\n]+)】|\[([^\]\n]+)\])/g)]
  const missing = sections.filter(([, zh, en]) => !blocks.some((block, i) => {
    const title = (block[1] || block[2]).trim().toLowerCase()
    if (![zh, en.toLowerCase()].includes(title)) return false
    const body = prompt.slice(block.index + block[0].length, blocks[i + 1]?.index ?? prompt.length).trim()
    return body.length > 0 && !/^(?:[:：\s]*(?:同上|待补充|按剧本|参考画面|待定|TODO|TBD|N\/A)[.。!！\s]*)$/i.test(body)
  })).map(([key]) => key)
  // Only explicitly quoted text is checked mechanically, not arbitrary prose.
  const speech = [...String(shot?.description || '').matchAll(/(?:旁白|画外音|对白|台词|Narrator|Voiceover)\s*[:：]\s*[“「『"]([^”」』"\n]+)[”」』"]/gi)].map(m => m[1])
  const missingSpeech = speech.filter(line => !prompt.includes(line))
  return { status: missing.length || missingSpeech.length ? 'needs_detail' : 'specified', missing_sections: missing, missing_speech: missingSpeech, semantic_approval: false }
}

// Best-effort concurrent-edit detection; the native API has no atomic CAS.
// Prompt writes may change only the selected prompt, never other creative fields.
function snapshot(c, omitPromptId) {
  const clean = value => {
    if (Array.isArray(value)) return value.map(clean)
    if (!value || typeof value !== 'object') return value
    return Object.fromEntries(Object.keys(value).sort().filter(k => !['updated_at', 'updatedAt', 'created_at', 'createdAt'].includes(k)).map(k => [k, clean(value[k])]))
  }
  return JSON.stringify(clean({ episode: c.episode, project: c.project, style_prompt: c.style_prompt, characters: c.characters, scenes: c.scenes, props: c.props,
    storyboards: c.storyboards.map(s => { const copy = { ...s }; if (Number(s.id) === omitPromptId) { delete copy.video_prompt; delete copy.videoPrompt }; return copy }) }))
}
export class PromptCompletionError extends Error {
  constructor(code, message, report) { super(message); this.code = code; this.report = report }
}

// A bounded fallback within the existing breakdown/generate action. No new jobs,
// database, media generation or retries after an uncertain native Agent request.
export async function completeVideoPrompts({ readContext, generate, storyboardIds, force = false, onProgress = () => {} }) {
  let current = await readContext()
  const ids = storyboardIds ?? current.storyboards.map(s => Number(s.id))
  const report = { status: 'specified', checked: [], generated: [], semantic_approval: false }
  const fail = (code, message) => { report.status = 'needs_attention'; throw new PromptCompletionError(code, message, report) }
  if (!ids.length || new Set(ids).size !== ids.length || ids.some(id => !current.storyboards.some(s => Number(s.id) === id))) fail('PROMPT_SCOPE', '没有可处理的分镜或分镜已变化 / Invalid or empty storyboard scope.')
  const pending = ids.filter(id => force || videoPromptCoverage(current.storyboards.find(s => Number(s.id) === id)).status === 'needs_detail')
  onProgress({ total: pending.length, completed: 0 })
  for (const id of pending) {
    const fresh = await readContext()
    if (snapshot(fresh) !== snapshot(current)) fail('PROMPT_SOURCE_CHANGED', '分镜或创作输入已变化，已停止后续补全；请刷新核对 / Source changed; remaining prompts were not submitted.')
    await generate(id, fresh) // If this throws, never retry or submit remaining IDs.
    const after = await readContext()
    if (snapshot(after, id) !== snapshot(fresh, id)) fail('PROMPT_SOURCE_CHANGED', '补全期间其他内容发生变化，已停止；请核对已保存内容 / Other fields changed during prompt generation.')
    const beforeShot = fresh.storyboards.find(s => Number(s.id) === id), afterShot = after.storyboards.find(s => Number(s.id) === id)
    if (force && String(beforeShot.video_prompt ?? beforeShot.videoPrompt ?? '') === String(afterShot.video_prompt ?? afterShot.videoPrompt ?? '')) fail('PROMPT_UNCHANGED', `分镜 ${id} 的提示词未变化，不能确认完成重写；请核对原内容 / Prompt unchanged; regeneration is unverified.`)
    const check = videoPromptCoverage(after.storyboards.find(s => Number(s.id) === id))
    report.checked.push({ id, ...check }); report.generated.push(id)
    if (check.status !== 'specified') fail('PROMPT_INCOMPLETE', `分镜 ${id} 的提示词仍有缺项，请检查后定向重试 / Prompt remains incomplete: ${[...check.missing_sections, ...check.missing_speech].join(', ')}`)
    current = after
    onProgress({ total: pending.length, completed: report.generated.length })
  }
  report.checked = ids.map(id => ({ id, ...videoPromptCoverage(current.storyboards.find(s => Number(s.id) === id)) }))
  return report
}
