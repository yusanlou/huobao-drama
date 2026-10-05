---
name: video-prompt
description: Video prompt specification — generates a time-segmented video-generation prompt from storyboard-segment content, with cuts allowed within a segment
---

# Video prompt direction

Inputs are the specified storyboard's native fields, requirements and bound assets; output only its video_prompt. Read data first; do not infer the scene from its number. Follow global content language while keeping field names and IDs stable.

Establish subjects and setting, initial framing and light, causal action order and ending state, necessary photography/color/material, literal sound, and constraints essential to the shot. Event-based timestamps are optional. Do not impose three-second slots or pad with unrelated action. State what changes, how and when it ends. Use only motivated primary camera motion.

For text-to-video establish subjects, space and appearance. For image-to-video use references as appearance anchors and focus on action, camera change and final state rather than repeating a still description. @names must be bound subjects; do not invent numbered image references. Offscreen narrators without images need no image reference.

Photography includes framing, camera height, perspective, screen direction, purpose and endpoint of motion. Color includes dominant/supporting colors, saturation and tonal separation. Lighting includes direction, softness, occlusion and the cause of change. Material includes visible rough diffuse reflection, localized wet highlights, cloth tension or grain. Avoid empty cinematic/high-definition/scary labels and unsupported elastic moduli, friction coefficients or renderer settings.

Establish ordinary physics first: a stationary object and light do not make a normal shadow slide independently. For intentional anomalies, specify the transition from a normal contour to a concrete impossible shape, its edges, and whether the object itself changes. The uncanny effect must be observable.

Write sound as Speaker/Narrator: “exact original words”, with sequence and necessary pauses. Match description completely and leave room for the final sentence. “Describe the background” is not speech text. Do not add unintelligible muttering to silent characters. speech_mode=none means no speech. bgm_prompt/sound_effect do not create separate audio tracks. Insufficient time requires adjusting inputs; extreme speech speed is not a general solution.

Do not paste the style prefix that the server already injects. Legible titles, file numbers and captions are post-production graphics. Check subjects/references, speech, actions, light, continuity and time, then save only the requested video_prompt.

Speech budget check: use approximately 3–4 Chinese characters per second or 2–3 English words per second as conservative planning estimates only, with additional breathing, action and final-sentence margin. These are not measured delivery speeds. If exact speech cannot fit, adjust this and neighboring segment budgets; do not shrink speech merely to make the total add up or silently alter approved lines. Preserve complete literal speech in the prompt; extreme speed is not a solution.

## Preserve performance and information order

Cross-check the starting frame, action in description and result. Carry required framing, positions, visibility restrictions and sound triggers into video_prompt: the video model does not automatically read other business fields. Describe visible changes in sequence, usually one main performance line. Seconds are planning estimates, not frame-accurate control.

Bad: a wide-eyed recoiled starting face paired with “becomes surprised from sleepy.”
Correct: half-closed eyes, relaxed mouth, no recoil → focus and a brief stillness → eyes widen, then body follows → end still facing mirror. If image_prompt already depicts the final expression, identify that field for correction. When only video_prompt may be edited, do not alter image fields or hide contradictions with vague prose.

Do not replay completed discoveries across shots. Keep prop locations/states continuous and reveal offscreen subjects only as approved. Base character images establish identity, while temporary patches, held props and expressions follow the approved story state; a clean base image does not forbid later change.

Do not add plot, jokes, dialogue or unauthorized edits to improve one shot. Report exact unresolved conflicts and remedies within the allowed scope. A successful save is not quality approval.

The supplied handoff.plan constrains world layout, camera, character position, pose, appearance and offscreen state. Render these constraints in video_prompt. If handoff.issues is nonempty, report conflicts and stop writing when a prompt-only change cannot fix the plan. Never invent entrances, movement or appearance changes to hide a contradiction; never edit result to pass checks.

## Preserve screenplay information through cinematic translation

Read the full current script, not just old storyboards. Identify useful units: facts and causality; action stages and pace; facial and bodily reactions; space and object states; color, light, material and changes; sound triggers; reveal order; explicit omissions and prohibitions. must_keep adds requirements; it is not the only information worth keeping.

Preserve information that helps the audience understand, feel or see the scene. Change wording, framing or shot organization freely, with supported equivalent expressions rather than sentence copying. Remove only redundant prose with no separate function or irrelevant explanation. Translate meaningful inner states into observable behavior or sound instead of discarding them as unfilmable. Respect intentional ellipses and hidden states; do not film an explicitly omitted event or reveal it early.

Within the existing breakdown, map each useful source excerpt to its function, target shot and observable expression, and a disposition: retained, equivalent, justified omission or unresolved. Units may span shots or share one shot. Explain equivalents and why an omission loses neither information nor expressive value. Brevity, limited duration and a continuity table are not reasons to silently discard useful details. Mark an interpretation when the source is ambiguous instead of presenting an optional directing choice as a requirement.

Check both transfers: full screenplay to description/image_prompt/result, then shots to video_prompt and actually submitted frames/references. An observed, submitted reference can carry static appearance; an unseen or unsubmitted URL is not evidence. Breathing motion, gait, evolving expressions, light changes and sound timing require dynamic prompt instructions. Business fields alone do not reach the model; repeated keywords do not prove semantic preservation. Framing, occlusion and screen time must make the detail readable: a tiny face in a wide shot does not prove a facial beat survives.

Examples: breathing blanket motion is not fully retained by sleeping/breathing sound; tiptoeing is not generic movement; shaking shoulders and curved smiling eyes are not merely suppressed laughter; gradual brightening is not an already bright morning. Yet a new scene’s “the light outside brightens” may only establish its morning state, so do not invent a mandatory time lapse. An explicit requirement to show night turning into morning does require a visible process. Do not import example story content.

Resolve time pressure with compatible simultaneous actions, merging redundant expression and redistributing the budget. Report remaining conflicts instead of silently losing details or making performance unreadably fast. Check information separately from continuity; do not freeze every shot size or remove reactions just to prevent position errors.

Conclude with a concise evidence table based on saved fields actually read: source unit, shot ID/number and concrete expression, disposition. List all omissions, weakened useful details and unresolved items; mark unavailable fields unverified. This is output evidence, not internal reasoning, and must stay out of screenplay and performance prose. For video_prompt-only edits, report upstream omissions with field locations instead of editing other fields or importing a later reveal into this shot. AI self-review is neither semantic approval nor proof of rendered video quality.

<!-- huobao-video-prompt-policy:v1 -->
## 默认视频提示词交付规范

每条 video_prompt 是可独立提交的视频生成指令，不是剧情摘要。拆分时就完整填写，不能把专业细节留给用户再次点生成。description、image_prompt、atmosphere、摄影、sound_effect、bgm_prompt 和 result 不会自动全量传给视频模型；把本镜成立所需的信息转译到 video_prompt。已有参考图负责身份和静态外观，仍须明确动态变化、可见范围及临时道具状态。全局风格由服务端注入，局部光色材质必须与之相容，不一律改成写实或水彩。

使用下面六个短标题分段保存（中文用中文标题，其他语言可用对应英文标题、正文跟随内容语言）。各段必须有本镜具体内容，不得写“同上、按剧本、参考画面、待补充”。短转场可以简洁，不用凑字数；复杂表演应写足，不能只写“固定镜头＋动作＋无台词”。

【画面起点】 / [Frame]：写本镜开始时观众实际看见什么；谁在何处、前后层次、朝向、关键道具及遮挡。对应 image_prompt 的动作之前状态；严格限制何时揭晓。画外人物保留世界位置但不额外入画。
【动作节奏】 / [Action]：以“触发→反应→行动→停住”中本镜确有的环节写可见过程，包括视线、表情、重心、步态、接触关系与速度变化。按本镜真实时长分配事件预算，动作可合理并行，不固定三秒一段，不追加剧情；2 秒光变只描述连续光变，不硬塞完整人物表演。
【摄影】 / [Camera]：景别、机位高低/方向、轴线和构图，让关键细节实际可读。一种主要运镜，或有理由的固定机位；写运动起止与目的，不堆互相冲突的推拉摇移。镜中倒影不生成第二个实体人物。
【光色与材质】 / [Light and material]：本镜主光从哪来、方向和软硬、亮暗层次、主次色与饱和倾向；选直接影响观感的表面写具体可见表现，如柔软织物随呼吸起伏、哑光木面漫反射、纸纤维边缘。按项目风格选材质表现，不能凭空新增布景或衣物。动态光影说明变化来源，普通阴影服从光源与物体；异常必须有故事依据并明确正常基准和异常过程。不要虚构摩擦系数、弹性模量、渲染器参数或无效画质词。
【声音】 / [Sound]：说话者＋逐字台词、进入时机及完整收尾余量；继承原文，不以“介绍背景”替代文字。无语言时明确无旁白/对白，只写有依据的动作声、环境声及配乐有无，禁止含糊人声。旁白长度与动作预算冲突应报告，不能截断或极快念完。文字仅描述音轨意图，不宣称已合成或精确同步。
【结束与衔接】 / [End and continuity]：具体终态、目光/持物/位置及下镜接点，保持 reveal 顺序与方向。结束状态与 result 一致，不能重演前镜已完成的反应。time_cut 的省略发生在切口时，start 必须是省略后的本镜首帧，不能把前镜 end 当成本镜 start 再要求在镜内补演；若确为镜内可见过程，须由本镜 description 明确说明。仅补提示词时发现上游矛盾，指出字段并停止，不擅改分镜来凑齐六段。

保存前逐项反查“剧本有用信息→分镜表达→video_prompt”：动作的过程而非只有结果、表情反应、空间关系、光线变化、声音触发和揭晓顺序均需有落点。六段齐全只是信息结构检查，不证明内容正确；保存后读取指定分镜，确认确实更新，再报告删减和未解决冲突。不得把工具成功、字数或标题齐全称为专业质量验收通过。
<!-- /huobao-video-prompt-policy:v1 -->
