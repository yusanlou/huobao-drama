# AI 视频制作工作流：第一方研究笔记

检索日期：2026-10-04。用途：为 Huobao 专业制作流程方案提供证据；本笔记未运行生成模型，不代表本项目已接入下述能力。厂商、模型、版本、地域、输入模式应分别记录，不能把同一品牌不同版本的能力合并。

## 按优先级排列的 10 项结论

1. **先改编为可表演的剧本，再编排镜头。** Adobe 将剧本区分为场景时空、动作、对白，并强调目标观众、情绪目标与多轮修订。[剧本资料](https://www.adobe.com/in/creativecloud/video/discover/video-script.html) 因此建议为每场保存“角色目标—阻碍—行为—结果变化”，把小说心理描写转成可见行为、对白或必要旁白；标记原文依据、保留信息、压缩与增写。这个字段设计是本项目建议，不是 Adobe 规定。不要按原文字数等分场景。

2. **分镜是对叙事信息与情绪的视觉规划。** Adobe 说明建立镜头、特写和人物构图承担不同叙事作用，镜头清单需要覆盖剪辑所需素材。[分镜资料](https://www.adobe.com/creativecloud/video/discover/storyboarding.html)、[镜头清单](https://www.adobe.com/uk/creativecloud/video/discover/shot-list.html) 建议每镜只保留明确的叙事任务：观众新增知道什么、人物情绪如何变化、为什么在此切镜；字段包含镜号、场景、景别、角度、运镜、动作和声音。不要把运镜术语数量当作专业程度。

3. **连续性同时包含造型与空间/动作关系。** Adobe 明确覆盖服装道具、视线、180 度轴线与动作衔接。[连续性剪辑](https://www.adobe.com/creativecloud/video/hub/ideas/what-is-continuity-editing-in-film.html) 项目应维护人物/服装/道具版本，以及每镜开始和结束时的站位、朝向、视线、持物手和动作阶段。跨镜人物相似度高，仍可能出现空间关系或因果错误；需要看相邻镜头连播。

4. **把参考图当作已审核的视觉输入，避免每镜重新发明角色。** Runway Gen-4.5 图生视频指南说明首图提供构图、人物、光线和风格，文本主要负责动作与时间演进；脸和手的输入瑕疵可能被放大。[Runway 图生视频指南](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide) 建议先审核角色定妆图、场景图和关键帧，再发起视频任务；图像内容与动作提示矛盾时，先修图或修提示。

5. **首尾帧、参考素材和视频延长是不同模式。** Wan 3.0 API 支持首帧、首尾帧和多模态参考；首尾帧示例仅传 `first_frame` 与 `last_frame`。Veo 3.1 提供 `image`、`lastFrame`、最多三张 `referenceImages`，并支持用既有生成视频延长，但 Lite 的参考/延长能力不同。[Wan API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)、[Veo API](https://ai.google.dev/gemini-api/docs/veo) 由上一段尾帧继续生成，可改善接缝但不保证中间动作合理；仍需检查边界和整段。该风险判断是工作流推论。

6. **时长属于模型能力约束；镜头切分属于叙事决策。** Wan 3.0 的无视频输入生成时长为 2–30 秒整数；有视频输入时输入与输出合计不超过 30 秒。Veo 3.1 支持 4/6/8 秒，参考图及高分辨率有 8 秒限制。[Wan API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)、[Veo API](https://ai.google.dev/gemini-api/docs/veo) Wan 3.0 Prompt 指南的单段 2–5 秒是多镜头写作建议，不是通用剧本规律。[Wan 3.0 提示指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide) 建议先按表演/对白需要估时，再适配合法生成长度、预留剪辑余量；不能为凑 3 秒截断一句对白。

7. **参数、参考素材与提示词应分开保存。** 模型、尺寸、时长、音轨开关是接口字段；焦距感、光位、表演强度、时间戳等通常是自然语言指导，不能承诺物理数值精确执行。Runway API 示例将 `model`、`ratio`、`duration` 与 `promptText`、`promptImage` 分开。[Runway API 入门](https://docs.dev.runwayml.com/guides/using-the-api/) Wan 的 `prompt_extend` 默认开启，可能改写提示词，文件/网页输入要求开启；应保存原始提示、最终提交内容和该开关，已审核提示可在允许的输入模式下关闭改写做对照。相同 seed 也不保证完全一致。[Wan API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)

8. **对白有原生音画生成和独立配音两条制作路线。** Wan 3.0 支持按说话人标注台词、引用音色参考和要求口型同步；这些是提示写法，不是逐字逐帧验收保证。[Wan 3.0 提示指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide) Veo 原生音频始终开启；其文档仅明确英语经过完整支持，其他语言未充分评估，应对中文实测。[Veo API](https://ai.google.dev/gemini-api/docs/veo) 对严格台词，建议先确定配音/录音、测量真实长度，再剪画面并单独处理口型；这是制作建议，独立 TTS 本身不会自动同步嘴型。对白、环境、音效、音乐分别留轨。Wan `audio=false` 不输出音轨，但价格相同，不能据此宣称省钱。[Wan API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)

9. **用可定位问题的质量门槛，避免只给总体美观分。** VBench 将视频质量拆成主体一致性、背景一致性、闪烁、运动平滑、动态程度等维度；VBench-2.0 增加物理、常识、人体与控制等关注点。[VBench 原论文](https://openaccess.thecvf.com/content/CVPR2024/html/Huang_VBench_Comprehensive_Benchmark_Suite_for_Video_Generative_Models_CVPR_2024_paper.html)、[VBench-2.0](https://arxiv.org/abs/2503.21755) 建议分别验收：剧本因果/角色动机；分镜信息覆盖/空间关系；静帧身份/造型/手脸；视频动作/闪烁/连续性；音频台词/说话人/口型；成片节奏/声音衔接。自动检测辅助找异常，人审负责戏剧与情绪是否成立；不把学术基准分直接当上线阈值。

10. **采用短镜头试制、单变量修订和分阶段批准。** Runway 建议从关键动作开始，逐步增加细节；多次失败可检查输入图中的隐含运动，静止镜头仍可能需要后期稳定。[Runway 图生视频指南](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide) 项目可先制作一个包含对话、情绪反应、跨镜动作的小样，用统一评分比较候选；通过剧本、资产、分镜预演、样片四道门槛后再批量生产。每次保留候选、失败原因、实际费用/耗时与修改点，超出重试预算交人工改编。

## 来源适用范围与时效性

| 来源 | 本笔记采用的证据 | 版本/日期与不确定性 |
| --- | --- | --- |
| [Adobe：Video scripts](https://www.adobe.com/in/creativecloud/video/discover/video-script.html) | 剧本格式、动作/对白、协作修订 | 页面未见明确发布时间；通用影视方法，不证明某个 AI 工作流成功率 |
| [Adobe：Storyboarding](https://www.adobe.com/creativecloud/video/discover/storyboarding.html) | 分镜如何传达信息和情绪 | 页面未见明确发布时间；同上 |
| [Adobe：Shot list](https://www.adobe.com/uk/creativecloud/video/discover/shot-list.html) | 镜头字段、剪辑覆盖 | 页面未见明确发布时间；同上 |
| [Adobe：Continuity editing](https://www.adobe.com/creativecloud/video/hub/ideas/what-is-continuity-editing-in-film.html) | 空间、视线、动作、道具连续性 | 页面未见明确发布时间；规则可因明确艺术意图而调整 |
| [Wan 3.0 API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference) | 实际字段、时长、输入模式、音轨、改写开关 | `wan3.0-video` / `wan3.0-video-prime`；中文版更新时间未在抓取中显示；调用前再验地域/账户可用性 |
| [Wan 3.0 Prompt](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide) | 多镜头结构、素材引用、台词格式 | 专属于 3.0 的写作建议；不能直接套到 2.1/2.2/2.6 |
| [Veo API](https://ai.google.dev/gemini-api/docs/veo) | 参考输入、原生音频、时长限制 | 3.1 / Fast / Lite 在页面中为 Preview，能力矩阵不同；同页个别矩阵对旧版本信息并不完全一致，本笔记仅采用明确的 3.1 描述 |
| [Runway 图生视频](https://help.runwayml.com/hc/en-us/articles/48324313115155-Image-to-Video-Prompting-Guide) | 图与提示分工、简单提示、迭代与后期 | 页面声明针对 Gen-4.5 优化，未见明确更新时间；示例不代表确定性控制 |
| [Runway API 入门](https://docs.dev.runwayml.com/guides/using-the-api/) | 参数与文本分离 | 示例模型 `gen4.5`，API version header `2024-11-06`；本笔记不将平台其他视频模型能力归给 Gen-4.5 |
| [VBench](https://openaccess.thecvf.com/content/CVPR2024/html/Huang_VBench_Comprehensive_Benchmark_Suite_for_Video_Generative_Models_CVPR_2024_paper.html)、[VBench-2.0](https://arxiv.org/abs/2503.21755) | 分维度评价的依据 | CVPR 2024；2.0 初稿 2025-03-27；支持评价方法，不用于断言 2026 某模型最好 |

## 必须保留的能力边界

- **Sora 不应列为当前接入候选。** OpenAI 官方列出的 Sora API 关闭日期为 2026-09-24；早于本笔记检索日期。其 2026-03-12 Cookbook 已标记归档，仅可作历史方法参考。[关闭说明](https://help.openai.com/en/articles/20001152-what-to-know-about-the-sora-discontinuation)、[归档提示指南](https://developers.openai.com/cookbook/examples/sora/sora2_prompting_guide)
- Wan 英文综合提示指南（页面标注 2026-09-28）同时存在“参考模式台词保持”和“精确词语口型不可靠”的表述，也同时包含多镜头方法与单连续镜头建议。应以具体版本 API 判定输入是否合法、以实测判定质量，不把泛化提示文章当作能力保证。[英文综合指南](https://www.alibabacloud.com/help/en/model-studio/text-to-video-prompt)
- 本次检索不足以证明任何模型可以稳定逐字复现长对白、严格执行焦距/光圈/物理轨迹，或一次生成完整长剧。建议使用“生成目标”“验收项”，避免“保证一致”“精确控制”等措辞。

## 可直接落到方案的最小质量记录（项目建议）

每个镜头保留：叙事目的、剧本版本、角色/场景资产版本、开始/结束状态、计划时长、对白与音频版本、模型/输入模式、实际请求参数、生成候选、失败分类、通过证据和人工修改。先在分镜预演中验证节奏，再消耗视频生成预算；剪辑验收必须连续播放上下镜，不能只验单段截图。
