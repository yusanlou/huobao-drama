---
name: video-prompt
description: 비디오 프롬프트 규범 — 스토리보드 구간 내용을 바탕으로 시간대별로 구간을 나누고 구간 내 컷 전환이 가능한 비디오 생성 프롬프트를 생성
---

다음은 제작 규칙입니다. 작품의 언어는 시스템의 전역 콘텐츠 언어 설정을 따릅니다. 영어 규칙 자체를 작품 본문에 출력하지 마세요.

# Video prompt direction

Inputs are the specified storyboard's native fields, requirements and bound assets; output only its video_prompt. Read data first; do not infer the scene from its number. Follow global content language while keeping field names and IDs stable.

Establish subjects and setting, initial framing and light, causal action order and ending state, necessary photography/color/material, literal sound, and constraints essential to the shot. Event-based timestamps are optional. Do not impose three-second slots or pad with unrelated action. State what changes, how and when it ends. Use only motivated primary camera motion.

For text-to-video establish subjects, space and appearance. For image-to-video use references as appearance anchors and focus on action, camera change and final state rather than repeating a still description. @names must be bound subjects; do not invent numbered image references. Offscreen narrators without images need no image reference.

Photography includes framing, camera height, perspective, screen direction, purpose and endpoint of motion. Color includes dominant/supporting colors, saturation and tonal separation. Lighting includes direction, softness, occlusion and the cause of change. Material includes visible rough diffuse reflection, localized wet highlights, cloth tension or grain. Avoid empty cinematic/high-definition/scary labels and unsupported elastic moduli, friction coefficients or renderer settings.

Establish ordinary physics first: a stationary object and light do not make a normal shadow slide independently. For intentional anomalies, specify the transition from a normal contour to a concrete impossible shape, its edges, and whether the object itself changes. The uncanny effect must be observable.

Write sound as Speaker/Narrator: “exact original words”, with sequence and necessary pauses. Match description completely and leave room for the final sentence. “Describe the background” is not speech text. Do not add unintelligible muttering to silent characters. speech_mode=none means no speech. bgm_prompt/sound_effect do not create separate audio tracks. Insufficient time requires adjusting inputs; extreme speech speed is not a general solution.

Do not paste the style prefix that the server already injects. Legible titles, file numbers and captions are post-production graphics. Check subjects/references, speech, actions, light, continuity and time, then save only the requested video_prompt.

Speech budget check: use approximately 3–4 Chinese characters per second or 2–3 English words per second as conservative planning estimates only, with additional breathing, action and final-sentence margin. These are not measured delivery speeds. If exact speech cannot fit, adjust this and neighboring segment budgets; do not shrink speech merely to make the total add up or silently alter approved lines. Preserve complete literal speech in the prompt; extreme speed is not a solution.

## 연기 과정과 정보 순서 보존
시작 화면, description 동작, result를 교차 확인한다. 필수 구도·위치·가시 범위·소리 계기를 video_prompt에 포함한다. 영상 모델이 다른 업무 필드를 자동으로 읽는다고 생각하지 않는다. 주된 연기 하나와 보이는 변화 순서를 쓴다. 초는 계획이며 프레임 단위 보장이 아니다.
반례: 시작부터 눈을 크게 뜨고 머리를 뺀 얼굴인데 졸림에서 놀람으로 바꾸라고 한다.
정례: 반쯤 감긴 눈·편한 입·빼지 않은 머리→초점과 짧은 멈춤→눈이 커지고 몸이 뒤따름→거울을 보는 상태로 종료. image_prompt가 최종 표정이면 그 필드의 충돌을 알린다. video_prompt만 수정 허용이면 이미지 항목을 바꾸거나 모호한 문장으로 감추지 않는다.
완료된 첫 발견을 반복하지 않고 소품·위치를 이어 준다. 화면 밖 인물을 임의로 먼저 공개하지 않는다. 기본 캐릭터 이미지는 정체성을 정하고 임시 밴드·소지품·표정은 승인된 이야기 상태를 따른다. 깨끗한 기본 이미지를 전체 작품의 변화 금지로 해석하지 않는다.
새 줄거리·농담·대사·허용되지 않은 편집을 추가하지 않는다. 해결 불가능한 충돌은 구체적 수정안과 보고한다. 저장 성공은 품질 승인이 아니다.

보충 데이터 handoff.plan의 고정 배치·카메라·인물 위치·자세·외형·화면 밖 상태를 video_prompt에 반영하세요. handoff.issues가 있으면 충돌을 알리고 프롬프트만으로 수정할 수 없다면 저장을 멈추세요. 등장·이동·외형 변화를 꾸미거나 검사를 통과하려고 result를 수정하지 마세요.

## 대본 정보를 영상 표현으로 보존하기

기존 스토리보드만 보지 말고 현재 script 전체를 읽는다. 사실과 인과, 행동 과정과 속도, 표정과 신체 반응, 공간과 소품 상태, 색·빛·재질과 변화, 소리의 계기, 정보 공개 순서, 명시적 생략과 금지를 확인 가능한 단위로 나눈다. must_keep는 추가 요구이며 보존할 정보의 전부가 아니다.

관객의 이해, 감정, 화면 가독성에 도움이 되는 정보는 보존한다. 문구, 구도, 샷 수는 바꾸거나 근거 있는 동등한 표현으로 옮길 수 있으며 문장 복사는 필요 없다. 독립적인 역할이 없는 반복 수사와 무관한 설명만 삭제한다. 동기나 감정에 중요한 내면은 보이는 행동이나 소리로 옮기고 촬영할 수 없다는 이유로 버리지 않는다. 원문에서 명시적으로 생략한 사건을 추가하거나 숨겨진 상태를 일찍 공개하지 않는다.

기존 분해 단계 안에서 원문 짧은 인용→기능→대상 샷과 보이거나 들리는 표현→보존/동등한 표현/타당한 생략/미해결로 대조한다. 한 단위가 여러 샷에 걸치거나 여러 단위가 한 샷에 들어가도 된다. 동등한 표현과 생략이 정보나 표현력을 잃지 않는 이유를 설명한다. 짧게 쓰기, 시간 부족, 연결표의 존재는 유용한 세부 사항을 조용히 지울 이유가 아니다. 원문이 모호하면 해석임을 밝히고 선택 가능한 연출을 필수 사건으로 단정하지 않는다.

대본 전체→description/image_prompt/result, 이어서 샷→video_prompt와 실제 제출할 첫 프레임·참고 자료를 역으로 확인한다. 확인하고 제출한 이미지가 정적 외형을 담을 수 있지만 보지 않거나 제출하지 않은 URL은 근거가 아니다. 호흡 움직임, 걸음걸이, 표정 변화, 빛의 변화, 소리의 타이밍은 동적 프롬프트에 필요하다. 업무 필드나 같은 단어의 존재만으로 의미 보존을 증명하지 않는다. 구도, 가림, 시간을 고려하고 넓은 샷의 작은 얼굴에 표정을 적었다고 읽힌다고 가정하지 않는다.

호흡에 따라 이불이 들썩이는 것은 잠이나 숨소리만으로 보존되지 않는다. 살금살금 걷기는 단순 이동이 아니며 어깨를 떨고 눈을 접어 웃는 것은 단순히 웃음을 참는 것과 다르다. 서서히 밝아지는 것은 이미 밝은 아침과 다르다. 다만 새 아침 장면의 밝아진 빛은 상태 설명일 수도 있으므로 타임랩스가 필수라고 단정하지 않는다. 밤에서 아침으로 변하는 과정을 보여 달라는 명확한 요구가 있다면 눈에 보이는 변화가 필요하다. 예시 줄거리를 복사하지 않는다.

시간이 부족하면 가능한 동시 행동, 중복 표현 통합, 시간 재배분으로 해결하고 남은 충돌을 보고한다. 정보를 몰래 삭제하거나 알아볼 수 없는 속도로 밀어 넣지 않는다. 위치 연결과 정보 보존을 별도로 확인하고 위치 오류 방지만을 위해 모든 구도를 고정하거나 반응을 지우지 않는다.

실제로 읽은 저장 결과로 원문 요점·샷 ID/번호와 구체 표현·처리 결과의 짧은 대조표를 제공한다. 모든 생략, 약해진 유용한 표현, 미해결 항목을 적고 반환되지 않은 필드는 미확인으로 표시한다. 이는 결과의 근거이지 내부 추론이 아니며 대본이나 연기 본문에는 넣지 않는다. video_prompt만 수정할 때 상위 누락은 해당 필드와 함께 보고하고 다른 필드를 임의 수정하거나 이후 공개를 현재 샷에 넣지 않는다. AI 자체 점검은 의미의 완전성이나 생성 영상 품질의 보증이 아니다.

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
