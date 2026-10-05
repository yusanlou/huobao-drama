---
name: storyboard-breaker
description: 絵コンテ分解のプロ仕様 — 脚本を複数のサブカットを収める絵コンテパラグラフに分割する
---

以下は制作規則です。出力言語はシステムの全体コンテンツ言語設定に従います。英語の規則をそのまま作品本文に出力しないでください。

# Storyboard direction

Break down complete events, not source word counts or fixed-length blocks. Read the episode script, description requirements and existing assets. Preserve literal speech. If it cannot fit, reorganize segments and identify needed script changes; never silently omit words or demand unintelligible speed.

Define the new information each segment gives the viewer. Use space establishment, action evidence, necessary reactions and results. No compulsory camera movement. Framing controls information; camera position respects axis and eyelines. Motion follows a subject or reveals information; otherwise a fixed camera is valid. Cut at action completion, attention shifts or revelations.

In description, specify starting positions, direction, speed changes, contact and ending state. Clarify interactions between subjects. In atmosphere, specify key-light direction, occlusion, softness, tonal separation, color tendency and visible texture. Describe observable material behavior: diffuse surfaces, wet highlights, fabric tension, illuminated dust. Do not pretend arbitrary physical constants are precise model controls. Use result as the next shot's continuity point.

Check positions, orientation, held objects, clothing and prop state, lights and action phase. Separate ordinary physics from intentional anomalies: establish a stable baseline, then specify where change begins, how it develops and where it ends. A bizarre effect must be visible, not merely called eerie.

duration is segment seconds. Speech and action can overlap; unrelated speakers should not overlap without intent. Check the total against a supplied target; otherwise label estimates. Descriptive prose is not spoken runtime. Never cut speech to meet a time limit.

Bind actual episode assets only. Pure narrators need not appear. image_prompt describes a frame; video_prompt describes change, photography, literal sound and necessary constraints. Sound-intention fields are not audio generation. Use native save tools for full rebuilding and ID-scoped updates for local edits.

Speech budget check: use approximately 3–4 Chinese characters per second or 2–3 English words per second as conservative planning estimates only, with additional breathing, action and final-sentence margin. These are not measured delivery speeds. If exact speech cannot fit, adjust this and neighboring segment budgets; do not shrink speech merely to make the total add up or silently alter approved lines. Preserve complete literal speech in the prompt; extreme speed is not a solution.

## 物語を観客の見る順序へ
何を見せ何を隠すかを決めてから構図と配置を選ぶ。一段落を複数ショットにも、複数段落を一つにもできる。有効な設計は残す。description に開始構図・位置、見える動作順、終了状態を書く。切り替えは動作、注意、開示、時空間変化に基づく。固定撮影も有効。
image_prompt は単一の静止した開始で、移動全体や最終反応を書かない。result への変化を video_prompt に記す。隣接ショットの向き、持ち物、動作段階、感情の進度を合わせ、初発見を繰り返さない。画像 URL だけで配置を理解したと扱わず、実際に見ていなければ明示された素材文に基づく。

## 三つの変換例（筋を転用しない）
喜劇「眠い兄が鏡で絆創膏を発見し驚く」：原文に「近景・固定」を付けるだけでは不足。鏡枠の端を残し、反射した一つの顔だけを見せ、ここで絆創膏を初めて明瞭に出す。半開きの目が上がり焦点を結ぶ。瞬き後に視線が止まり、目が開き、頭が少し遅れて引く。顔を画内に保ち、弟は画外。開始画面は半開きの目、緩んだ口、引いていない頭。終了は鏡を見たまま驚き、まだ振り向かず笑わない。次はこの状態を受け、笑い声で振り向く。
人物劇「門番が鍵の赤い糸を認めて通す」：側面の中近景に手、鍵、目を配置し、糸を読める大きさにする。糸を見る、手が止まる、緩んで引く、道が開く。全てを読めなければ物の証拠と反応に分け、左右関係を保つ。開始は手が入口を塞ぎ鍵が見える。終了は手を引き通路が開く。次は入る動作から続け、また塞がない。
サスペンス「灯と箱は静止、影が変形、研究者が察知」：側面固定で箱と影の全変形範囲を同時に見せる。正常な影を示してから原文の変化へ。反応ショットで証拠を隠さない。開始は正常な影。終了は原文の最終形状。次も既に察知した状態を保つ。
喜劇の明確な開示と間、サスペンスの可視範囲制限、人物劇の距離と視線から本作に適した方法を選ぶ。水彩や写実は外観であり物語設計ではない。
一記録は一生成区間。モデルの秒数範囲を守り、一秒の編集素材を対応する一秒生成と偽らない。区間内切替や区間をまたぐ音橋は実行確認が必要。正確な切点やミックス済みと保証しない。

## 必須：ショット間の接続表（既存 result フィールド）

再構築は現在の script を根拠にします。existing_storyboards は旧記録であり、新脚本の出来事・位置・テンポを上書きできません。有効な設計の再利用も現在の脚本との照合後に限ります。

各ショットより先に世界座標の目印、カメラ位置と軸線を固定します。画面左右と空間位置を混同せず、画面外の人物も追跡します。カットだけで人物を移動したり、反応を戻したり、貼片を他人へ移したりしません。

result の自然文の終了状態の後に、正確なマーカー `<!-- huobao-continuity:v1 -->` と `<!-- /huobao-continuity:v1 -->` で JSON を追加します。バックエンドのフィールドは追加しません。以下は構造例であり、ID・内容・言語を当該エピソードに置き換えます。

```json
{"version":1,"transition":"start","reason":"Opening establishes the room","space":"bed left, mirror right, door foreground; world landmarks fixed","camera":"door-side wide, camera stays on this side of the bed-mirror axis","start":[{"id":1,"position":"beside mirror","pose":"standing, paws down, facing mirror","appearance":"three bandages on cheek, no clothing","visible":true}],"end":[{"id":1,"position":"beside mirror","pose":"standing, paws down, facing mirror","appearance":"three bandages on cheek, no clothing","visible":true}]}
```

transition は start（最初のみ）、continuous（同カメラ・連続時間）、cut（別カメラ・連続時間）、time_cut（明示した時空の飛躍）。reason は切り替え理由と省略した出来事を記載し、矛盾を隠すために出来事を捏造しません。space は固定配置を同じ文言で、camera は位置と軸線を記載。

start/end は関連人物全員（画面外を含む）の id、position、pose、appearance、visible を追跡します。関連付けた人物を記載し、画面内の人物は素材と関連付けます。不変の値は同じ文言を使用。両端の人物集合は一致させ、退出後も画面外位置を残します。time_cut 以外では次の start の位置・姿勢・外観は前の end と一致。cut は可視性のみ変更でき、continuous は可視性とカメラも維持。description、image_prompt、video_prompt も表と一致させます。

保存は映像の接続確認ではありません。実際の前映像の終了と次の開始画像を確認する必要があります。別カメラでは再構図し、以前の終了画像を機械的に流用しません。未閲覧の映像を確認済みとしません。

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

### 人物の実際の状態とカメラ上の見え方を分ける

position、pose、appearance には、固定した室内の目印に対する位置・向き、身体の姿勢・動作段階、実際の貼付物・服装・持ち物だけを書く。「カメラに背を向ける」「顔が見えない」「初めて明瞭に見える」「まだ明かさない」などの見せ方は混ぜず、camera、description、image_prompt、video_prompt と自然言語の終了状態に必ず残す。visible は人物が画面内にいるかだけを表し、部分的な遮蔽や鏡像は画面描写で説明する。接続表のフィールドは増やさない。

例：顔に絆創膏を貼り、鏡に向かって立つ人物を背後から撮り、鏡の顔へ切り替えても、人物は向きを変えず絆創膏も変わらない。前カットの end と次の start は「右壁の鏡に向かって立つ」「顔に絆創膏」など同じ実際の状態を一字一句沿用し、顔を隠す構図と鏡で初めて見せる演出は各カットの画面フィールドに残す。見える情報の増加を状態変化とみなさない。ただし実際の姿勢、振り向き、表情、持ち物の変化には物語上の動作が必要であり、差異を一律に無視しない。保存前に時間省略のない全 end/start を対照し、視点の混入を修正する。検査を通すために time_cut に変えたり物理状態を削除したりしない。
