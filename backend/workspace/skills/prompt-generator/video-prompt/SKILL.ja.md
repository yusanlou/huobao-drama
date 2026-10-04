---
name: video-prompt
description: 動画プロンプト仕様 — 絵コンテパラグラフの内容に基づき、時間で区間分けされ、区間内でカット切り替え可能な動画生成プロンプトを生成する
---

以下は制作規則です。出力言語はシステムの全体コンテンツ言語設定に従います。英語の規則をそのまま作品本文に出力しないでください。

# Video prompt direction

Inputs are the specified storyboard's native fields, requirements and bound assets; output only its video_prompt. Read data first; do not infer the scene from its number. Follow global content language while keeping field names and IDs stable.

Establish subjects and setting, initial framing and light, causal action order and ending state, necessary photography/color/material, literal sound, and constraints essential to the shot. Event-based timestamps are optional. Do not impose three-second slots or pad with unrelated action. State what changes, how and when it ends. Use only motivated primary camera motion.

For text-to-video establish subjects, space and appearance. For image-to-video use references as appearance anchors and focus on action, camera change and final state rather than repeating a still description. @names must be bound subjects; do not invent numbered image references. Offscreen narrators without images need no image reference.

Photography includes framing, camera height, perspective, screen direction, purpose and endpoint of motion. Color includes dominant/supporting colors, saturation and tonal separation. Lighting includes direction, softness, occlusion and the cause of change. Material includes visible rough diffuse reflection, localized wet highlights, cloth tension or grain. Avoid empty cinematic/high-definition/scary labels and unsupported elastic moduli, friction coefficients or renderer settings.

Establish ordinary physics first: a stationary object and light do not make a normal shadow slide independently. For intentional anomalies, specify the transition from a normal contour to a concrete impossible shape, its edges, and whether the object itself changes. The uncanny effect must be observable.

Write sound as Speaker/Narrator: “exact original words”, with sequence and necessary pauses. Match description completely and leave room for the final sentence. “Describe the background” is not speech text. Do not add unintelligible muttering to silent characters. speech_mode=none means no speech. bgm_prompt/sound_effect do not create separate audio tracks. Insufficient time requires adjusting inputs; extreme speech speed is not a general solution.

Do not paste the style prefix that the server already injects. Legible titles, file numbers and captions are post-production graphics. Check subjects/references, speech, actions, light, continuity and time, then save only the requested video_prompt.

Speech budget check: use approximately 3–4 Chinese characters per second or 2–3 English words per second as conservative planning estimates only, with additional breathing, action and final-sentence margin. These are not measured delivery speeds. If exact speech cannot fit, adjust this and neighboring segment budgets; do not shrink speech merely to make the total add up or silently alter approved lines. Preserve complete literal speech in the prompt; extreme speed is not a solution.
