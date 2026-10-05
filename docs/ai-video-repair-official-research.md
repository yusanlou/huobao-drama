# AI 视频修整与原片编辑：官方资料核查

核查日期：2026-10-05。范围包含 Runway、Adobe、Luma、Wan，以及当前 Huobao 实现。未登录、付费调用或实测生成效果。下列产品能力来自官方文档，不能作为独立效果评测或成功率保证。本次只新增研究记录，没有实施代码改造或修改现有作品。

## 结论与使用顺序

“不满意只能重生成”过于绝对。已有可用的原片编辑产品和公开接口；但应区分三种处理方式：

| 层次 | 适用问题 | 保留和成本边界 |
| --- | --- | --- |
| 剪辑修整 | 多余停顿、坏掉的首尾几帧、切点不顺、画面可由其他素材覆盖 | 使用已有素材，不调用生成模型；可单独保留对白轨。源文件不受破坏不等于导出后文件字节完全相同。 |
| 原片生成式编辑 | 动作和构图基本可用，只需改物体、服装、背景、光照或风格 | 把现有视频作为输入，有机会保留已满意部分；仍须生成并验收，不能默认像素锁定、对白不变或更便宜。 |
| 单镜补拍／重生成 | 表演、动作、镜头设计本身不成立，或编辑多次仍不合格 | 只替换问题镜头，保留前后镜头及可用音轨；“只重抽一镜”仍不同于“修改原片”。 |

以上顺序是工程建议：先判断能否用已有素材完成，再对最短必要片段试编辑，最后补拍问题镜头。依据是 Premiere 的非破坏剪辑、Runway 的范围编辑，以及 Luma 对视频编辑与首帧生成的明确区分。[Adobe 剪辑](https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-in-premiere.html)、[Runway Edit Studio](https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio)、[Luma 视频编辑 API](https://docs.agents.lumalabs.ai/guides/videos/editing/)

## Runway：Aleph 2.0 / Edit Studio

- **确实修改已有视频**：Edit Studio 使用 Aleph 2.0，支持增删／替换物体、换背景等；可以用时间范围手柄限制修改区间，只对该区间收取视频生成积分。文档规格表为 2–30 秒、最高 1080p／30 FPS、最多 10 次切镜；上传说明与规格表对时长端点的表述略有差异，边界素材以实际校验为准。[官方使用说明](https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio)
- **公开 API 已有**：模型目录明确列出 `aleph2`，输入为 Video + Text/Image、输出为 Video。不能把网页范围选择能力直接推定为 API 参数，本次未进一步核查其字段。[官方 API 模型目录](https://docs.dev.runwayml.com/guides/models/)
- **保留边界**：官方提示词指南描述局部修改并保留周围内容，这是能力描述；本次未发现可据以承诺任意素材、未编辑区域逐像素不变的公开保证。[Aleph 2.0 提示词指南](https://help.runwayml.com/hc/en-us/articles/52150503729171-Aleph-2-0-Prompting-Guide)
- **音轨**：导出文档明确 ProRes 可带 PCM 音频，但没有在已核查页面中明确承诺原对白逐样本保留。不能用“输出含音频”替代“原对白无损保留”。[官方导出说明](https://help.runwayml.com/hc/en-us/articles/54396547993491-Exporting-Videos-in-ProRes-and-PNG-Sequence-Formats)
- **成本下限**：API 当前为每秒 28 credits、每次最低 56 credits，等效至少 2 秒计费。0.5 秒的问题不能直接按 0.5 秒估价；多次尝试、关键帧生成和专业导出也可能增加费用。[官方 API 计费](https://docs.dev.runwayml.com/guides/pricing/)、[Edit Studio 计费项](https://help.runwayml.com/hc/en-us/articles/51683104370451-Creating-with-Edit-Studio)

## Adobe：传统剪辑与 Generative Extend 分开看

- **剪辑修整成熟且精确**：Premiere 时间线可裁切、切开、移动和叠放片段，原始媒体不被改写。J/L cut 允许画面和声音在不同时间切换，因此可以保留原对白、调整或替换其上的画面。[剪辑说明](https://helpx.adobe.com/premiere/desktop/edit-projects/intro-to-editing/edit-video-in-premiere.html)、[J/L cut](https://helpx.adobe.com/premiere/desktop/edit-projects/trim-clips/perform-j-cuts-and-l-cuts.html)
- **Generative Extend 用于补首尾长度**：视频最多延长 2 秒、音频最多 10 秒；原始媒体保持不变。它不是任意位置的角色／动作修复工具。不能生成或延长对白；延长处理中的对白被静音，只补环境底噪、音效等。含音乐音频不支持，音频限单声道／立体声。按分辨率、帧率消耗积分；官方 FAQ 还注明中国不可用。[官方 FAQ](https://helpx.adobe.com/in/premiere/desktop/edit-projects/edit-with-generative-ai/generative-extend-faq.html)
- **实际剪辑限制**：不直接支持已调速或时间重映射片段；含音乐时可拆开音画，仅延长视频。一段素材首尾都需延长时有额外拆分／渲染步骤。[已知限制](https://helpx.adobe.com/premiere/desktop/troubleshooting/limitations-and-known-issues/generative-extend-known-issues.html)
- **API 结论有限**：确认的是 Premiere 产品功能。本次在 Firefly API 公开资料中未核到可直接调用的 Generative Extend 云端 REST 接口；Premiere UXP 有完成事件，不能把事件监听当作云端延长 API。不能据此写成“Adobe 没有任何 API”。[Firefly API 文档入口](https://developer.adobe.com/firefly-services/docs/firefly-api/)、[Premiere UXP 事件](https://developer.adobe.com/premiere-pro/uxp/ppro-reference/events/operationcompleteevent)

## Luma：Modify 产品与当前 API 不能混用版本结论

- **产品已支持原片修改**：Ray3 Modify 可用输入视频、角色参考与关键帧修改画面；强度越接近 Reimagine，越可能重解释边缘、背景与相机运动，因此不应承诺像素不变。[Ray3 Modify 指南](https://lumalabs.ai/learning-hub/ray3-modify-user-guide)
- **时长随版本变化**：Ray3 Modify FAQ 写上限 10 秒，并明确保留原音频；Ray3.14 指南则写 Modify 最长 18 秒。前者的音轨声明不能直接当作后续所有模型和 API 的保证。[Ray3 Modify FAQ](https://lumalabs.ai/learning-hub/ray3-modify-faqs)、[Ray3.14 指南](https://lumalabs.ai/learning-hub/ray314-user-guide)
- **当前公开接口**：旧 API 文档已引导至 Luma Agents。当前 `ray-3.2` 的 `type: "video_edit"` 接受已有生成、视频 URL 或内联视频；URL／内联输入上限 18 秒、200 MB，可用强度和多关键帧控制。文档明确这是重新渲染原视频，也明确首帧驱动的新生成不是编辑；已核页面未说明原音轨保留契约。[迁移入口](https://docs.lumalabs.ai/docs/modify-video)、[当前视频编辑文档](https://docs.agents.lumalabs.ai/guides/videos/editing/)
- **成本不能按“改了几帧”估算**：当前 API 为编辑单列计费，公布 5 秒／10 秒档；不能把延长、生成、编辑的价格互套。相同分辨率的编辑档可以高于新生成档。资料未明确给出所有不足 5 秒输入的计费规则，不能自行推导按实际帧数线性收费；价格页另注明正式全面开放前费率可变。[官方 API 计费](https://docs.agents.lumalabs.ai/guides/pricing/)

## 当前项目使用的 Wan 3.0

Wan 3.0 已支持传入原视频并通过指令进行元素、光线、动作及台词编辑；提示词指南还明确列出视频音频编辑，可调整人声、音乐、音效。此前把“当前网页没有便捷修复入口”说成“只能从头生成镜头”，范围过于绝对。可以继续让视频模型负责声音，但具体旁白效果及画面保留程度尚未实测。[官方能力说明](https://help.aliyun.com/zh/model-studio/wan3-video-generation-guide)、[官方提示词指南](https://help.aliyun.com/zh/model-studio/wan3-video-generation-prompt-guide)

编辑使用 `reference_video` 和编辑意图提示词，参考视频总时长最多 15 秒，输入加输出总时长最多 30 秒。不能直接把本项目整段 30 秒成片当作一个编辑输入；单镜或必要片段更合适。[官方 API](https://help.aliyun.com/zh/model-studio/wan3-video-generation-api-reference)

**编辑不是按改动像素数收费。** Wan 3.0 的输入、输出视频均按秒计费。例如 6 秒输入、6 秒输出，计费时长为 12 秒；同模型、同分辨率、不带参考视频的新生成 6 秒则为 6 秒计费。编辑的价值可能是保留已满意的表演、减少重试，而非单次更便宜。应按“达到可用结果的总成本”比较。[官方计费](https://help.aliyun.com/zh/model-studio/model-pricing)

## Huobao 已有基础与缺口（本地代码核查）

- 已能单镜生成、查看历史版本并设为主视频，不必重生成整集。见 `frontend/app/views/drama/episode.vue` 中 `genVid`、`setAsMainVideo`。
- 当前 Wan 适配器已经传递 `reference_video`，具备原片输入基础；本次没有验证真实编辑调用。见 `backend/src/services/adapters/aliyun-wan-video.ts`。
- 普通生成仍使用完整的原分镜提示词并追加接续约束，没有独立的“只改这一处”任务语义、区间裁切与回拼流程。修改声音时，原提示词的“无旁白”尤其不能原样夹带进编辑请求。见 `shared/production.mjs` 中 `inspectVideoInput`。
- 原服务端的新生成结果会自动回写主视频。要实现“先比较、确认后采用”，须专门处理候选隔离和采用操作，不能声称现成支持。参考视频还需要上游可访问的地址；当前本地素材依赖 `PUBLIC_BASE_URL` 转换或可访问的媒体 URL。见 `backend/src/services/generation.ts`。

建议在现有视频制作页补一个“修复当前镜头”入口：选择原版本、标记问题时间段、写清修改目标与保留项，比较修整／编辑／重生成的预计成本，输出候选后对比采用。网页和 MCP 调同一能力，继续复用原服务端；实施前须补足上述素材访问、候选保存和回写边界。

对于仅需画外旁白的修复，可以进一步测试“视频模型产生新音轨，核对时长后将音轨配回原画面”，以保留原视频画面。此为工程建议，当前 Huobao 尚未提供；人物口型对白不能直接照搬该做法。

## 对修复工作流的含义（工程判断）

1. 保存原片、原对白／音乐／音效轨和版本；画面编辑成功后再决定是否采用生成器返回的音频。
2. 让用户标记问题时间段和想改变的具体内容；把“保留动作、构图、对白”等要求写成验收项，不能只靠一句“其他保持不变”。
3. 预估费用应包含最小时长／档位、输入输出计费规则、候选次数和导出附加费用。先展示一次试修的范围与预算，再选择继续编辑还是补拍。
4. 不把厂商示例称为普遍成熟的自动修复保证；本次能确认的是正式文档中的能力和入口，具体短剧素材仍需小样验证。
