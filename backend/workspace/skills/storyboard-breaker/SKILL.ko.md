---
name: storyboard-breaker
description: 스토리보드 분할 전문 규범 — 대본을 여러 서브 컷을 담을 수 있는 스토리보드 구간으로 분할
---

다음은 제작 규칙입니다. 작품의 언어는 시스템의 전역 콘텐츠 언어 설정을 따릅니다. 영어 규칙 자체를 작품 본문에 출력하지 마세요.

# Storyboard direction

Break down complete events, not source word counts or fixed-length blocks. Read the episode script, description requirements and existing assets. Preserve literal speech. If it cannot fit, reorganize segments and identify needed script changes; never silently omit words or demand unintelligible speed.

Define the new information each segment gives the viewer. Use space establishment, action evidence, necessary reactions and results. No compulsory camera movement. Framing controls information; camera position respects axis and eyelines. Motion follows a subject or reveals information; otherwise a fixed camera is valid. Cut at action completion, attention shifts or revelations.

In description, specify starting positions, direction, speed changes, contact and ending state. Clarify interactions between subjects. In atmosphere, specify key-light direction, occlusion, softness, tonal separation, color tendency and visible texture. Describe observable material behavior: diffuse surfaces, wet highlights, fabric tension, illuminated dust. Do not pretend arbitrary physical constants are precise model controls. Use result as the next shot's continuity point.

Check positions, orientation, held objects, clothing and prop state, lights and action phase. Separate ordinary physics from intentional anomalies: establish a stable baseline, then specify where change begins, how it develops and where it ends. A bizarre effect must be visible, not merely called eerie.

duration is segment seconds. Speech and action can overlap; unrelated speakers should not overlap without intent. Check the total against a supplied target; otherwise label estimates. Descriptive prose is not spoken runtime. Never cut speech to meet a time limit.

Bind actual episode assets only. Pure narrators need not appear. image_prompt describes a frame; video_prompt describes change, photography, literal sound and necessary constraints. Sound-intention fields are not audio generation. Use native save tools for full rebuilding and ID-scoped updates for local edits.

Speech budget check: use approximately 3–4 Chinese characters per second or 2–3 English words per second as conservative planning estimates only, with additional breathing, action and final-sentence margin. These are not measured delivery speeds. If exact speech cannot fit, adjust this and neighboring segment budgets; do not shrink speech merely to make the total add up or silently alter approved lines. Preserve complete literal speech in the prompt; extreme speed is not a solution.

## 이야기를 관객이 보는 순서로
보여 줄 것과 숨길 것을 결정한 뒤 구도와 배치를 고른다. 한 문단을 여러 숏으로, 여러 문단을 한 숏으로 만들 수 있다. 유효한 설계는 유지한다. description에 시작 구도·위치, 보이는 동작 순서, 종료 상태를 쓴다. 컷은 동작·주의·공개·시공간 변화에 근거한다. 고정 숏도 유효하다.
image_prompt는 하나의 정지한 시작이며 전체 이동이나 최종 반응이 아니다. video_prompt로 result까지 연결한다. 인접 숏의 방향·소지품·동작 단계·감정 진행을 맞추고 첫 발견을 반복하지 않는다. 이미지 URL만 보고 배치를 이해했다고 주장하지 말고 직접 보지 않았다면 명시된 자산 설명을 따른다.

## 세 가지 전환 사례: 줄거리를 가져오지 말 것
코미디 “졸린 형이 거울에서 밴드를 발견하고 놀란다”: 원문에 ‘클로즈업·고정’만 붙이면 부족하다. 거울 테두리를 남겨 반사된 얼굴 하나만 보이며 여기서 처음 밴드를 선명히 공개한다. 반쯤 감긴 눈이 올라가 초점을 잡고 깜박인 뒤 시선이 멈춘다. 눈이 커지고 머리가 조금 늦게 물러난다. 얼굴을 프레임 안에 두고 동생은 밖에 둔다. 시작은 반쯤 감긴 눈·편한 입·물러나지 않은 머리. 종료는 거울을 보며 놀란 상태, 아직 돌아보거나 웃지 않는다. 다음은 이 상태에서 웃음으로 고개 돌림을 유발한다.
인물극 “문지기가 붉은 실을 알아보고 길을 연다”: 측면 미디엄 클로즈 숏에 손·열쇠·눈을 넣고 실을 읽을 크기로 보인다. 실 보기→손 멈춤→풀고 거두기→길 열기를 한 숏으로 읽힌다. 모두 보이지 않으면 물건 증거와 반응을 나누되 좌우를 지킨다. 시작은 손이 문을 막고 열쇠가 보이는 상태. 종료는 손을 거두고 통로가 열린 상태. 다음은 들어가는 행동으로 이어지며 다시 막지 않는다.
서스펜스 “조명과 상자 정지, 그림자 변형, 연구자 인지”: 측면 고정으로 상자와 그림자의 전체 변형 영역을 함께 담는다. 정상 그림자를 보여 준 뒤 원문의 변화로 진행한다. 반응 숏으로 증거를 가리지 않는다. 시작은 정상 그림자, 종료는 원문이 정한 형태. 다음도 이미 인지한 상태를 잇는다.
코미디의 명확한 공개와 멈춤, 서스펜스의 시야 제한, 인물극의 거리와 시선 중 작품에 맞는 방법을 고른다. 수채화나 실사는 외형이며 서사 설계가 아니다.
한 레코드는 한 생성 구간이다. 모델 시간 범위를 지키고 1초 편집 숏을 지원되는 1초 생성처럼 꾸미지 않는다. 구간 내부 컷과 구간 간 사운드 브리지는 실제 검증이 필요하며 정확한 컷 시각이나 믹싱 완료를 보장하지 않는다.

## 필수: 숏 연결표 (기존 result 필드)

재구성은 현재 script를 기준으로 합니다. existing_storyboards는 이전 기록이며 새 대본의 사건·배치·리듬을 덮어쓸 수 없습니다. 기존 설계도 현재 대본과 대조한 뒤에만 유지합니다.

개별 숏 전에 고정된 공간 기준점, 카메라와 축을 정하세요. 화면 좌우는 세계 위치가 아닙니다. 화면 밖 인물도 추적하세요. 컷만으로 인물을 이동하거나 반응을 되돌리거나 외형 표시를 다른 인물에게 옮기지 마세요.

result의 자연어 종료 상태 뒤에 정확한 마커 `<!-- huobao-continuity:v1 -->` 와 `<!-- /huobao-continuity:v1 -->` 로 JSON을 추가합니다. 백엔드 필드를 추가하지 마세요. 아래는 구조 예시이며 ID·내용·언어는 현재 에피소드로 바꾸세요.

```json
{"version":1,"transition":"start","reason":"Opening establishes the room","space":"bed left, mirror right, door foreground; world landmarks fixed","camera":"door-side wide, camera stays on this side of the bed-mirror axis","start":[{"id":1,"position":"beside mirror","pose":"standing, paws down, facing mirror","appearance":"three bandages on cheek, no clothing","visible":true}],"end":[{"id":1,"position":"beside mirror","pose":"standing, paws down, facing mirror","appearance":"three bandages on cheek, no clothing","visible":true}]}
```

transition: start는 첫 숏만, continuous는 동일 카메라와 연속 시간, cut은 새 카메라와 연속 시간, time_cut은 명시적 시공간 전환. reason에 전환 이유와 생략 사건을 적고, 모순을 숨기려 사건을 꾸미지 마세요. space는 고정 배치를 같은 문구로, camera는 위치와 축을 적습니다.

start/end는 화면 밖을 포함한 모든 관련 인물의 id, position, pose, appearance, visible을 추적합니다. 연결된 인물은 모두 추적하고 보이는 인물은 소재와 연결하세요. 변하지 않은 값은 동일 문구를 사용하세요. 시작과 끝의 인물 집합을 같게 하고 퇴장해도 화면 밖 위치를 남기세요. time_cut 외에는 다음 start의 위치·자세·외형이 이전 end와 같아야 합니다. cut은 가시성만 바꿀 수 있으며 continuous는 가시성과 카메라도 유지합니다. description, image_prompt, video_prompt에도 같은 상태를 반영하세요.

저장은 실제 영상 검토가 아닙니다. 이전 영상의 실제 끝과 다음 첫 프레임을 확인해야 합니다. 카메라 변경 시 재구성한 구도가 필요하며 기존 끝 프레임을 기계적으로 복사하지 마세요. 보지 않은 영상을 확인했다고 하지 마세요.

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

### 실제 인물 상태와 카메라에 보이는 모습을 구분한다

position, pose, appearance에는 고정된 공간 기준점에 대한 위치와 방향, 신체 자세와 동작 단계, 실제 부착물·의상·소지품만 쓴다. ‘카메라에 등을 보임’, ‘얼굴이 가려짐’, ‘처음 선명하게 공개됨’, ‘아직 공개되지 않음’ 같은 시점·정보 공개 표현은 이 세 항목에 넣지 않는다. 해당 연출은 camera, description, image_prompt, video_prompt 및 자연어 종료 상태에 반드시 보존한다. visible은 인물의 화면 내 등장 여부만 뜻하며 부분 가림이나 거울 반사는 화면 묘사에 쓴다. 접속 표 필드를 추가하지 않는다.

예를 들어 얼굴에 반창고가 붙은 인물이 거울을 향해 서 있고, 뒷모습에서 거울 속 얼굴로 컷을 바꿔도 인물이 돌아서거나 반창고가 변한 것은 아니다. 앞 컷 end와 다음 컷 start에는 ‘오른쪽 벽 거울을 향해 서 있음’, ‘얼굴에 반창고’처럼 동일한 실제 상태를 그대로 사용하고, 얼굴을 숨기거나 처음 공개하는 연출은 각 화면 필드에 보존한다. 보이는 정보가 늘어난 것을 실제 변화로 취급하지 않는다. 다만 실제 자세·돌아보기·표정·소지품 변화에는 이야기 속 동작이 필요하며 모든 차이를 무시하면 안 된다. 저장 전 시간 생략 없는 모든 end/start 쌍을 대조해 시점 표현 혼입을 고친다. 검사를 피하려고 time_cut으로 바꾸거나 물리 상태를 삭제하지 않는다.
