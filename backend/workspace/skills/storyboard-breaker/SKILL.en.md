---
name: storyboard-breaker
description: Professional rules for storyboard breakdown — splitting a script into storyboard segments that each carry multiple sub-shots
---

# Storyboard direction

Break down complete events, not source word counts or fixed-length blocks. Read the episode script, description requirements and existing assets. Preserve literal speech. If it cannot fit, reorganize segments and identify needed script changes; never silently omit words or demand unintelligible speed.

Define the new information each segment gives the viewer. Use space establishment, action evidence, necessary reactions and results. No compulsory camera movement. Framing controls information; camera position respects axis and eyelines. Motion follows a subject or reveals information; otherwise a fixed camera is valid. Cut at action completion, attention shifts or revelations.

In description, specify starting positions, direction, speed changes, contact and ending state. Clarify interactions between subjects. In atmosphere, specify key-light direction, occlusion, softness, tonal separation, color tendency and visible texture. Describe observable material behavior: diffuse surfaces, wet highlights, fabric tension, illuminated dust. Do not pretend arbitrary physical constants are precise model controls. Use result as the next shot's continuity point.

Check positions, orientation, held objects, clothing and prop state, lights and action phase. Separate ordinary physics from intentional anomalies: establish a stable baseline, then specify where change begins, how it develops and where it ends. A bizarre effect must be visible, not merely called eerie.

duration is segment seconds. Speech and action can overlap; unrelated speakers should not overlap without intent. Check the total against a supplied target; otherwise label estimates. Descriptive prose is not spoken runtime. Never cut speech to meet a time limit.

Bind actual episode assets only. Pure narrators need not appear. image_prompt describes a frame; video_prompt describes change, photography, literal sound and necessary constraints. Sound-intention fields are not audio generation. Use native save tools for full rebuilding and ID-scoped updates for local edits.

Speech budget check: use approximately 3–4 Chinese characters per second or 2–3 English words per second as conservative planning estimates only, with additional breathing, action and final-sentence margin. These are not measured delivery speeds. If exact speech cannot fit, adjust this and neighboring segment budgets; do not shrink speech merely to make the total add up or silently alter approved lines. Preserve complete literal speech in the prompt; extreme speed is not a solution.

## Turn narrative into a viewing order

Decide what the audience should know and what remains hidden before choosing framing and blocking. A paragraph can become several shots; several paragraphs can share a shot. Retain effective designs: changed wording is not proof of translation. Each description specifies a starting composition/placement, visible action order and end state. Camera choices serve readability; cuts follow action, attention, revelation or time/place change. Static shots are valid.

image_prompt depicts one static start, never a whole movement or the final reaction. result is the destination; video_prompt connects them and inherits essential framing restrictions. Check neighboring direction, held objects, action phase and emotional progress, especially repeated first discoveries. An image URL alone is not visual evidence; use explicit asset text unless you actually inspect the image.

## Three translations; do not import the sample plot

Comedy, script: “The sleepy brother discovers patches in the mirror and is surprised.”
Weak: the same sentence plus “close-up, static.”
Executable: keep a mirror-frame edge, with only one reflected face visible; patches become clearly visible here for the first time. Half-closed eyes rise and focus; after a blink the gaze rests, eyes widen and the head follows with a small recoil. Keep the full face framed, sibling offscreen, and let the reaction read before ending.
image_prompt: patched face in mirror, half-closed eyes, relaxed mouth, head not recoiled.
result: surprised, still facing the mirror, not turned or smiling. The following shot continues this state, with laughter triggering the turn.

Character drama, script: “The doorkeeper recognizes red thread on the key and lets the visitor pass.”
Executable: a side medium-close framing includes blocking hand, key and eyes, with thread large enough to read. Gaze lands on thread; hand stops, loosens and withdraws, opening the doorway in one shot. If one composition cannot show all evidence clearly, separate the prop evidence and reaction while maintaining established directions.
image_prompt: hand still blocks doorway; key visible; passage not yet open.
result: hand withdrawn, passage clear; the next entrance continues rather than restarting the block.

Suspense, script: “Lamp and box remain still; the shadow changes and the researcher notices.”
Executable: static side view contains the box and entire shadow-change area. Establish the normal shadow, then show only the original change. A later reaction shot may follow but must not obscure the evidence.
image_prompt: stationary box and normal shadow.
result: the source-prescribed final shape; next shot continues awareness, not another first discovery.

Clear reveals and held reactions can serve children's comedy; restricted visibility can serve suspense; distance and eyelines can express relationships. Choose for this story. Watercolor or photorealism is appearance, not narrative design.

Each record remains one generation segment. Respect the chosen model's duration range; do not disguise a one-second editorial insert as a supported one-second generation task. Internal cuts and inter-clip sound bridges need execution checks; do not promise exact cut timing or completed mixing. Self-check reduces risk, not the need to review actual video.

## Required cross-shot continuity (existing result field)

For a rebuild, the CURRENT script is authoritative. existing_storyboards are old records, not a plot or blocking template. Retain a design only after checking it against the current script.

Establish fixed world landmarks, camera and axis before individual shots. Screen-left is not a world location. Track offscreen characters; a cut cannot move someone, reset a reaction or transfer markings between characters. Changes must be performed during an authorized action.

Keep the natural-language ending in result and append JSON between the EXACT markers `<!-- huobao-continuity:v1 -->` and `<!-- /huobao-continuity:v1 -->`. Do not add backend fields. Example structure only; replace IDs, text and events with this episode's values:

```json
{"version":1,"transition":"start","reason":"Opening establishes the room","space":"bed left, mirror right, door foreground; world landmarks fixed","camera":"door-side wide, camera stays on this side of the bed-mirror axis","start":[{"id":1,"position":"beside mirror","pose":"standing, paws down, facing mirror","appearance":"three bandages on cheek, no clothing","visible":true}],"end":[{"id":1,"position":"beside mirror","pose":"standing, paws down, facing mirror","appearance":"three bandages on cheek, no clothing","visible":true}]}
```

transition: start only for the first shot; continuous for the same camera and continuous time; cut for a new camera and continuous time; time_cut for explicit time/place jumps. reason explains the cut and, for jumps, omitted events; never invent an omitted action to conceal a contradiction. space is the fixed layout, reused verbatim. camera states camera position and axis.

Both start/end track all relevant characters, including offscreen ones, with id, position, pose, appearance, visible. Track every bound character and bind every visible character. Keep identical states verbatim, not paraphrased. The character set must match at both ends; exiting characters retain an offscreen location. Unless time_cut, next start must equal previous end for world position, pose and appearance. A new camera can change visibility, not world state. continuous preserves visibility and camera too. Reflect this plan in description, image_prompt and video_prompt, not an independent contradictory table.

Saving does not approve rendered continuity. Later inspect the real preceding ending and proposed next first frame. New cameras need new compositions; do not blindly reuse the old camera's last frame. Never claim to have inspected unseen media.

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

### Separate physical character state from camera presentation

position, pose and appearance describe physical facts: location/orientation relative to fixed world landmarks, body posture/action phase, and actual markings/clothing/held objects. Keep camera-relative phrases such as "back to camera", "face hidden", "first revealed" or "not yet revealed" out of these three fields. Preserve those reveal and framing instructions in camera, description, image_prompt, video_prompt and the natural-language ending. visible only tracks whether the character is in frame; describe partial occlusion and reflections in shot prose. Do not add continuity schema fields.

Example: a character already faces a mirror with bandages on their face; cutting from their back to the reflected face does not turn them or change their bandages. Previous end and next start use the same verbatim physical state, such as "standing, facing the right-wall mirror" and "bandages on face". The shot fields separately retain the hidden face and first mirror reveal. Establish the shared physical facts before describing viewpoints. Seeing additional detail is not a physical change, but real posture, turning, expression and held-object changes still require story-supported actions; never ignore all differences. Before saving, compare every non-time-cut end/start pair and correct viewpoint contamination. Do not use time_cut or remove physical facts to bypass checks.
