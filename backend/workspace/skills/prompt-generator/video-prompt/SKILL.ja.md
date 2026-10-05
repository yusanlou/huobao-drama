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

## 演技と情報順序を保つ
開始画面、description の動作、result を照合する。構図、位置、可視範囲、音のきっかけを video_prompt に含める。他の業務フィールドを動画モデルが自動で読むとは考えない。主な演技を一つ選び、見える変化の順序を書く。秒数は計画でありフレーム単位の保証ではない。
反例：開始が既に目を見開き頭を引いた顔なのに、眠気から驚きへ変化させる。
正例：半開きの目・緩んだ口・引いていない頭→焦点と短い停止→目が開き身体が後から続く→鏡を見たまま終了。image_prompt が最終表情ならその矛盾を指摘する。video_prompt のみ更新可能なら画像項目を変えず、曖昧な文で隠さない。
初発見を反復せず、持ち物と配置をつなぎ、画外の人物を勝手に先出ししない。基本キャラ画像は同一性を定め、物語中の絆創膏・持ち物・表情は承認済み状態に従う。きれいな基本図を全編変化禁止と解釈しない。
新しい筋・冗談・台詞・未許可編集を加えず、解決できない矛盾は具体的な修正案とともに報告する。保存成功は品質承認ではない。

補足の handoff.plan の固定配置・カメラ・人物位置・姿勢・外観・画面外状態を video_prompt に反映。handoff.issues があれば矛盾を報告し、提示文だけで修復できなければ保存を停止。登場・移動・外観変化を捏造せず、検査を通すために result を変更しません。

## 脚本の情報を映像表現に引き継ぐ

既存の絵コンテだけでなく現在の script 全文を読む。事実と因果、動作の過程と速度、表情と身体反応、空間と小道具の状態、色・光・材質と変化、音のきっかけ、情報の公開順、明示的な省略・禁止を確認可能な要点に分ける。must_keep は追加条件であり、それ以外を捨ててよいという意味ではない。

観客の理解、感情、画面の読み取りに役立つ情報は保持する。文言、画角、ショット数は変えられ、根拠のある等価な表現も可能だが、逐語的なコピーは不要。削除できるのは独自の役割がない重複修辞や無関係な説明だけ。動機や感情に関わる内面は見える行動や音に翻訳し、「撮れない」からと捨てない。原文で省略した出来事は補わず、隠された状態と公開順を守る。

既存の分解作業内で、原文の短い引用→役割→対象ショットと見える・聞こえる表現→保持／等価な表現／妥当な省略／未解決を照合する。一つの要点を複数ショットに分けても、複数要点を一つにまとめてもよい。等価性や省略しても失われない理由を示す。短さ、尺、接続表があることは、有用な情報を黙って削る理由にならない。曖昧な文は解釈を明示し、任意の演出を必須の出来事と断定しない。

脚本全文→description/image_prompt/result、次にショット→video_prompt と実際に送信する開始フレーム・参照素材を逆照合する。確認済みで送信する画像は静的な外見を担えるが、未確認・未送信の URL は根拠にならない。呼吸の上下、歩き方、表情変化、光の変化、音のタイミングは動的プロンプトにも必要。業務フィールドや同じ単語の存在だけで保持を証明しない。画角、遮蔽、時間を考慮し、遠景の小さな顔で微表情が読めると決めつけない。

「呼吸で布団が上下」は「睡眠／呼吸音」だけでは不十分。「忍び足」は単なる移動ではなく、「肩が震え、目を細めて笑う」は単なる笑いの我慢ではない。「徐々に明るくなる」は既に明るい朝ではない。ただし新しい朝の場面を示す文は状態説明の場合もあり、必須のタイムラプスと断定しない。夜から朝への変化を見せるという明確な要件があれば、その過程を可視化する。例の筋書きを転用しない。

尺が足りなければ並行可能な演技、重複表現の統合、配分調整を試し、残る矛盾を報告する。黙って削ったり読めない速さにしない。位置の連続性と情報保持を別々に確認し、位置ずれ防止だけのために全画角を固定したり反応を削らない。

実際に読んだ保存結果から、原文要点・ショット ID/番号と具体表現・処理結果の短い対照表を返す。すべての省略、弱まった有用な表現、未解決項目を列挙し、取得できないフィールドは未確認とする。これは成果の根拠であって内部推論ではなく、脚本や演技本文には入れない。video_prompt のみの更新なら上流の欠落をフィールドとともに報告し、他の値を無断で変更したり後の情報を先に明かさない。AI の自己確認は意味の完全性や生成映像の品質を保証しない。

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
