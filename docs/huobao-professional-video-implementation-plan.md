# Huobao 剧本与分镜能力强化：详细实施方案

日期：2026-10-04。状态：A/B 代码与配置已实施，验证结果及保留缺口见 [实施验收记录](./huobao-professional-video-implementation-results.md)。

依据：[优化方案](/Users/mubaili/Documents/Code/huobao-drama/docs/huobao-professional-video-workflow-plan.md)与当前仓库实现。本文保留实施前的修改范围与验收标准；实际执行状态以实施验收记录为准。

## 1. 本次做什么

保留现有的“剧本 → 资产、分镜 → 视频 → 合成”步骤，优先解决两个问题：剧本缺少情节、细节和衔接；分镜提示缺少有效的摄影、动作、光影和材质描述。

网页继续调用原 Huobao API；MCP 补齐对同一套 API 的封装。专业生成规则放在现有 Agent 提示词和 Skill 中，两端传入相同含义的制作要求。项目、剧本、分镜、资产、媒体和生成任务继续存放在原服务端。

### 1.1 实施范围

| 分类 | 本期范围 |
| --- | --- |
| 直接实施 | 原 Agent 提示词与 Skill 配置；原页面的制作要求、生成参数、结果检查；MCP 接口补齐；相关测试 |
| 保持原样 | 原服务端源码、数据库表结构、原有项目和制作步骤；MCP 开关不成为网页功能开关 |
| 后续评估 | 独立配音、自动转写核验、静帧预演、精细剪辑、正式的草稿/候选隔离 |
| 不建设 | 新制作服务、第二套流程引擎、扩展专属剧本库、另一套制作页面、在 MCP 内重新实现编剧业务 |

`backend/workspace/` 中的提示词和 Skill 属于已有可编辑配置，不等于修改 `backend/src/`。部署时优先通过原配置 API 更新运行中的有效配置；不能只改仓库模板就宣称生效。

### 1.2 交付顺序

| 批次 | 包含任务 | 完成标准 |
| --- | --- | --- |
| A：剧本与分镜 | T01–T05、T08 中的创作接口 | 原页面和 MCP 都能调用改进后的原 Agent；目标时长、叙事和镜头规范生效，结果写回原位置 |
| B：视频输入与检查 | T06–T07、T08–T09 的剩余项 | 两端可表达相同生成要求；能核对实际输入、识别问题并局部重做；MCP 功能覆盖差异清零或逐项明确受限原因 |
| C：声音与剪辑 | 第 9 节 | 单独确定需要的原能力增强，不计入前两批已交付功能 |

先做 A，再用文字案例验收，随后做 B 和有限样片验证。是否提升成品率要以对照结果判断，不按提示词长度或工具数量验收。

## 2. 当前代码中必须处理的事实

| 编号 | 已核实的问题 | 实施影响 |
| --- | --- | --- |
| F01 | 改写模板和 Skill 要求每场 30–60 秒；Skill 还默认对白驱动、字数增加 20–30% | 不适合一分钟档案旁白；需要按类型、目标时长和信息量改规则 |
| F02 | 分镜模板、Skill 按整篇字数估片长，默认每段 8–15 秒；提示规范固定按 3 秒分段 | 需要清理配置和前端重复指令，同时记录服务端硬编码残留 |
| F03 | `saveRaw()`、`saveScr()` 未返回并等待保存请求；`doRewrite()` 保存后立即调用 Agent | 可能读取旧原文；资产提取也存在先保存后立即读取的问题 |
| F04 | `doBreakdown()` 走分镜 Agent；`genVideoPrompt()` 走提示词 Agent；批量生成走专门接口 | 三条路径必须分别检查；不能只修改单镜头入口 |
| F05 | `onBreakdownDone()` 自动批量补缺失提示词；批量默认可能处理所有分镜 | 补缺失不能误改已有提示词；需要传入明确的缺失 ID 列表 |
| F06 | 网页参考图超过上限时会静默截断；无图的 `@名字` 可能原样保留；MCP 则要求所有绑定资产有图 | 两端素材规则不一致，可能让引用编号和主体不匹配 |
| F07 | 网页与 MCP 默认开启原生音频；Wan 适配器默认开启提示词改写 | 参数需要可见、可传递；不能让已审核内容受隐藏默认值影响 |
| F08 | 原服务端会在视频提示前注入项目风格；任务记录保存提示与参数 | 预览需区分提交前预测值、服务端记录值与厂商内部改写，不能称它们完全相同 |
| F09 | MCP 目前主要支持读写和媒体任务，未封装原改写/拆分 Agent；调用默认超时 30 秒 | 需要补原接口调用及长请求回执，不能让 Codex 自己改写成为唯一实现 |
| F10 | 改写、分镜、视频生成均可能直接更新已有数据，Agent 接口没有持久化的原生调用 ID | 不能承诺草稿隔离；超时后不能按“失败”直接重做 |

主要代码入口：[剧本页](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/views/drama/episode.vue:2641)、[Agent 路由](/Users/mubaili/Documents/Code/huobao-drama/backend/src/routes/agent.ts:32)、[批量提示生成](/Users/mubaili/Documents/Code/huobao-drama/backend/src/services/video-prompts.ts)、[分镜保存工具](/Users/mubaili/Documents/Code/huobao-drama/backend/src/agents/tools/storyboard-tools.ts:248)、[MCP 工具](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/tools.ts)、[MCP HTTP 访问](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/core.ts)。

## 3. T01：备份、规则清单与配置发布

### 3.1 改动对象

| 原配置 | 具体修改 |
| --- | --- |
| [script_rewriter.md](/Users/mubaili/Documents/Code/huobao-drama/backend/workspace/prompts/script_rewriter.md) | 改写的输入、步骤、自查和保存要求，详见 T03 |
| [script-rewriter/SKILL.md](/Users/mubaili/Documents/Code/huobao-drama/backend/workspace/skills/script-rewriter/SKILL.md) | 按内容类型改编，替换固定场长和扩字比例 |
| [storyboard_breaker.md](/Users/mubaili/Documents/Code/huobao-drama/backend/workspace/prompts/storyboard_breaker.md) | 时长预算、镜头目的、连续性及各字段职责，详见 T04 |
| [storyboard-breaker/SKILL.md](/Users/mubaili/Documents/Code/huobao-drama/backend/workspace/skills/storyboard-breaker/SKILL.md) | 场面调度、空间关系、素材绑定和估时规则 |
| [prompt_generator.md](/Users/mubaili/Documents/Code/huobao-drama/backend/workspace/prompts/prompt_generator.md) | 区分图片与视频提示要求，保留原保存工具，详见 T05 |
| [video-prompt/SKILL.md](/Users/mubaili/Documents/Code/huobao-drama/backend/workspace/skills/prompt-generator/video-prompt/SKILL.md) | 根据实际镜头事件分段，补足可见变化、准确台词和素材引用 |

上述每一项都要检查 `.en.md`、`.ja.md`、`.ko.md` 语言变体。它们存在时会优先于中文基础版，不能只更新中文就声称全部语言已升级。内容语言取原服务端全局设置，不跟随网页界面语言擅自切换。

### 3.2 执行方法

1. 读取 `/settings/content-language`、各 `/prompts/:type?lang=…`、`/skills/:id?lang=…` 的有效内容；记录配置哈希、语言和读取时间。
2. 备份实际配置及将受影响的测试项目数据；记录 `backend/src/` 文件哈希，作为“不改服务端源码”的验收基线。保留工作区已有未提交改动。
3. 为六份配置建立规则表：每条规则的原位置、新要求、影响的 Agent、验证案例。专业规则归入配置；调用方只提供本次输入和目标，不复制大段专业指令。
4. 在隔离测试实例中通过原 PUT API 部署新配置；保留现有 `name`、`model` 等非本次修改字段。Skill 通过 API 更新，使用原有缓存刷新逻辑。
5. 重新 GET 检查实际内容，再做 Agent 行为验证。配置文件存在不等于模型已遵守规则。
6. 验收后发布实际实例；配置作用于多个项目时明确记录影响范围，避免在正在执行的 Agent 请求中途切换规则。

回滚用备份内容逐项 PUT 恢复，**不使用 reset 代替恢复**：reset 可能回退到仍带旧规则的默认模板。

## 4. T02：在原页面补制作要求，保存到原数据

### 4.1 页面变化

在现有剧本区域增加可折叠的“制作要求”，分镜页可查看与修改同一组要求；不新增顶层步骤。字段如下：

| 字段 | 含义及约束 |
| --- | --- |
| `target_duration_seconds` | 目标成片秒数；正整数。未填写时显示“未指定”，不从全文字数伪造确定时长，也不把所有项目默认改为 60 秒 |
| `narrative_mode` | `archive_narration` 档案旁白、`character_drama` 人物剧情、`general` 通用；影响叙事方法，不等同于视觉风格 |
| `adaptation_scope` | 保留核心事实、允许补充表现细节的范围；不授权改变原文设定 |
| `must_keep` / `avoid` | 必须保留的信息与不希望出现的表达；允许为空 |
| `speech_mode` | 本期区分原生台词/旁白与无语音；独立 TTS 未接入前不显示为已可用选项 |

视觉风格继续使用原 `drama.style` 与风格预设；不再增加一份冲突的“项目风格”。模型和分辨率继续使用原选择控件。生成费用上限暂为调用方的执行约束，不宣称原服务端已有统一预算扣减能力。

### 4.2 存储决定

复用原 `episodes.description`，在 `<!-- huobao-production:v1 -->` 与 `<!-- /huobao-production:v1 -->` 之间存放 JSON 配置块；块外原说明逐字保留。使用原 `PUT /episodes/:id` 保存，不新增表，不写入 MCP 私有 brief，也不写入原文或剧本正文。

选择这个字段是因为原分镜上下文已经返回 `episode.description`，包括批量提示 Agent；原改写工具只读取原文，因此网页和 MCP 在发起改写时还须把这组要求放入 `message`。新增字段写在顶层请求里不会自动被原路由理解。

示例配置体：

```json
{
  "version": 1,
  "target_duration_seconds": 54,
  "narrative_mode": "archive_narration",
  "adaptation_scope": "保留原设定，允许压缩对白和补充可见动作",
  "must_keep": ["异常现象的因果与限制"],
  "avoid": ["新增人物身世", "把制作说明写进台词"],
  "speech_mode": "native"
}
```

解析仅处理固定边界内的配置块；没有配置块则采用未设置状态。重复块、损坏 JSON 或未知版本不能自动覆盖原说明，应显示具体问题供修正。

写入前重新读取描述并合并，保存后读回核对。原接口没有原子版本检查，因此这只是尽力防冲突；不能保证网页和 MCP 同时修改时绝不丢更新。原 MCP brief 不自动迁移，因为它是项目级、可能不适用于每一集。

### 4.3 修改位置与验收

- [episode.vue](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/views/drama/episode.vue)：增加要求表单和保存状态；生成前等待要求保存成功。
- [useApi.ts](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/composables/useApi.ts)：继续使用 `episodeAPI.update`，不新增服务端路由。
- MCP 增加 `hb_get_production_requirements`、`hb_update_production_requirements`，返回同一原字段的解析值及内容哈希。
- 中文、英文、日文、韩文 UI 文案同步补齐；配置枚举保持固定，不以翻译后的显示文本存储。

验收：网页设置 54 秒，MCP 能读到；MCP 修改必须保留信息，网页刷新能看到；原文、剧本和原说明不被污染；关闭 MCP 后网页仍可读写。

## 5. T03–T05：逐项强化原生成能力

### 5.1 T03：AI 剧本改写

修改前述改写模板和 Skill，按以下要求组织原 Agent 的一次改写操作：

| 修改点 | 具体要求 | 检查方式 |
| --- | --- | --- |
| 原文理解 | 识别人物、事件、因果、异常规则及未知信息；将原文事实与允许的表现性增写分开 | 对照原文逐项检查关键事实，不能把留白补成确定结论 |
| 情节组织 | 在写正文前安排信息揭示、阻碍或异常、结果变化；每场说明为什么发生、为什么接下一场 | 检查无铺垫反转、无动机行为和跳过关键事件的问题 |
| 类型适配 | 档案旁白允许叙述主导；人物剧情强调行为与选择。取消统一“减少旁白”的要求 | 同一套规则分别通过旁白和双人对白案例 |
| 细节表达 | 用动作、反应、停顿和有作用的环境细节表达心理；删除与叙事无关的堆砌 | 每项新增细节能说明作用，不靠增加字数充实内容 |
| 时间预算 | 取消每场固定 30–60 秒、扩字 20–30% 的配置要求；按照本次目标分配对白、动作与停顿 | 台词估时与画面描写字数分开；超时先删减和重排 |
| 保存内容 | 剧本保留场景头、动作和逐字台词；规则、授权说明、制作计划等不自动插进剧本正文 | 用户读到的是可制作剧本，不是操作说明书 |
| 自查与保存 | 检查事实、动机、因果、衔接、重复信息与时长后调用原 `save_script` | 读回 `script_content`；模型回复“已完成”不能作为保存成功依据 |

提纲和自查是生成方法，可输出简短修改摘要，不要求展示内部推理，也不存入新的草稿系统。禁止为了满足时长要求直接截断台词。

**前端必须修复保存顺序：** `saveRaw()`、`saveScr()` 改为可等待且失败可感知的异步操作。`doRewrite()` 先完成原文和制作要求保存，再调用 Agent；`skipRewrite()`、`doExtract()` 等依赖保存的入口一起检查。保存失败时不显示成功、不启动后续读取。

改写仍调用：

```text
POST /api/v1/agent/script_rewriter/chat
body: drama_id、episode_id、message、model?、config_id?
```

`message` 携带本次制作要求和操作意图，专业长规则来自原配置。第一期“AI 改写”明确以原文为基础；局部修改已审核剧本继续通过原编辑保存能力完成，避免原工具优先读 `content` 而覆盖人工修订。

### 5.2 T04：分镜拆分

保留一条原分镜记录对应一个生成段落的现有模型，不新增 ShotSpec 数据库。段内子镜头可存在，但数量和切点服从剧情、台词与模型能力。

| 原字段 | 强化后的写入要求 |
| --- | --- |
| `description` | 可见主体、主要动作、开始状态、变化、结束状态；每个子镜头的准确台词和声音位置 |
| `shot_type` / `angle` / `movement` | 明确景别、角度、机位和运镜目的；没有叙事理由时不强加移动 |
| `atmosphere` | 色调、饱和度、对比、主光方向、软硬和环境质感；避免只写“恐怖、电影感” |
| `result` | 本镜结束时人物、道具、动作与信息的状态，给下一镜提供衔接依据 |
| `duration` | 当前段落秒数，结合台词、动作与停顿；与目标片长合计核对 |
| `scene_id` / `character_ids` / `prop_ids` | 绑定本集实际涉及的原资产 ID；没有图不等于没有角色，也不凭空创造 ID |
| `image_prompt` | 单帧构图、人物造型、光线、可见材质与起始姿态 |
| `video_prompt` | 从同一 `description` 生成，包含时间内发生的变化；台词一致，不增加新剧情 |
| `bgm_prompt` / `sound_effect` | 音乐与音效意图记录；明确当前字段本身不会自动生成音轨 |

具体规则修改：

1. 移除可配置部分的“整篇字数 ÷ 500”片长公式，不将环境说明和提示词计入配音字数。
2. 有目标时长时核对全部 `duration` 之和；无目标时长时给出估计并注明未实测。不要把原 `episode.duration` 的分钟汇总当作精确秒数。
3. 检查相邻镜头的站位、视线、运动方向、持物手、灯位和动作阶段。普通物理关系与剧情刻意发生的异常分开描述。
4. 台词过长时先调整段落或改写表达，不按固定 3 秒机械切断语句。多镜头段落也要保留可理解的动作顺序。
5. “拆分整集”与“修改某镜”分开：后者用原 `update_storyboard`/PUT，不调用会清空旧分镜的拆分工具。
6. 分镜重拆有覆盖现有记录的副作用。网页在原操作处说明影响，MCP 工具也必须明确调用范围；已有用户明确重拆指令时不重复索要批准。

对应前端修改：`doBreakdown()` 等待当前剧本保存；只传本集 ID、制作要求、已选模型及已有素材信息；专业规则不重复粘贴到页面。`onBreakdownDone()` 只对确实缺少 `video_prompt` 的 ID 发起补全，不能让默认批量范围覆盖人工修改过的提示。

### 5.3 T05：视频提示词生成

修改 `prompt_generator.md` 中的视频部分及视频 Skill。保留图片资产提示的原保存工具与范围，去掉“所有提示词必须单段”与视频时间分段要求的冲突。

建议视频提示结构：

```text
本镜主体与场景：使用本镜实际绑定的资产名称。
起始画面：主体位置、机位、主光方向及动作起点。
动作顺序：先发生什么，随后如何变化，最后停在哪里。
摄影与外观：必要的运镜、色彩、光影和可见材质行为。
声音：说话人逐字台词；无语音时明确无语音。
关键限制：只列直接影响本镜成立的要求。
```

具体要求：

- 文生视频补足主体、空间与外观；图生视频重点写动作、运镜和变化，不重复整段关键帧描述。
- 按动作事件分段，需要时标时间；不把固定 3 秒当作通用导演规则。服务端批量路径的残留限制见第 8 节。
- 材质写可见效果，例如潮湿反光、粗糙漫反射、布料受力变化；不把任意物理数值当成 API 能精确控制的参数。
- 台词必须取自分镜原文，注明说话人、先后和停顿；不能用“讲述项目来历”代替要说的文字。
- 无需说话的角色不增加喃喃声；字幕、档案编号等要求清晰文字的内容标为后期排版，不要求视频模型画准字。
- 单镜生成提示只更新该分镜 `video_prompt`；读回检查目标字段及范围，不能因为调用完成就假定保存正确。
- 项目风格仍由原服务端注入，生成器不重复拼接。发现风格与本镜要求冲突时先改相应输入，不堆更多相反形容词。

前端同时检查 `genVideoPrompt()`、`batchVideoPrompts()` 和分镜拆分直接产出提示三条入口。保留原批量 API，不为了避开限制另建一套批量编排系统；单镜与批量的验收结果分开记录。

## 6. T06–T07：原视频页面的输入和结果检查

### 6.1 T06：参数与素材

主要修改 [episode.vue](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/views/drama/episode.vue:3036)、[useApi.ts](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/composables/useApi.ts) 以及 [MCP production.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/production.ts)。

| 修改项 | 具体行为 |
| --- | --- |
| 原生音频 | 把固定 `generate_audio: true` 改为明确选项；有台词但关闭音轨时说明本次视频不会包含该台词，不能暗示自动补配音 |
| 提示词改写 | 对支持的模型开放 `prompt_extend`；保留旧项目默认行为，已审核提示可显式关闭。文件/链接模式不允许提交不兼容组合 |
| 生成模式 | 区分文生视频、素材参考、首帧、首尾帧；只展示当前适配器支持的模式，模式切换时清理不兼容字段 |
| 参考素材 | 按最终提交清单排序、去重并生成引用编号；超限直接提示待调整项，不静默丢掉后面的资产 |
| 缺少图片 | 文生视频可无图，但不能留下伪造的 `@图片N`；参考模式缺关键素材时列明对象。纯旁白角色不强制生成肖像 |
| `@名字` | 重名歧义、未绑定对象和无法解析的引用需明确处理；通过一致的参考顺序验证网页和 MCP 请求 |
| 时长和尺寸 | 显示请求值与适配器可能转换后的值；先按当前仓库适配器能力校验，不靠服务端静默收敛掩盖错误 |
| 请求范围 | 批量只处理所选分镜；复用同一参数整理逻辑，不让单次和批量各有默认值 |

原 `/tasks` 已接受的相关字段包括 `first_frame_url`、`last_frame_url`、`reference_image_urls`、`reference_video_urls`、`reference_audio_urls`、`generate_audio`、`duration`、`aspect_ratio`、`resolution`、`seed`、`prompt_extend`、`watermark`。字段被路由接受，不代表所有 Provider 都支持；能力表以当前适配器逐项核验。请求显式模型配置与剧集配置、分辨率之间的优先关系也须按原路由处理。

生成选项本期随本次请求提交；历史实际值从原任务记录读取。不要仅存浏览器本地却声称跨端同步。若需要持久化默认选项，可加到 T02 的原描述配置块中，但必须区分默认值与每次任务实际值。

### 6.2 T07：在原页面增加检查信息

在现有分镜/视频区域增加折叠信息，不新增“专业工作台”：

| 检查项 | 数据与展示方式 |
| --- | --- |
| 时长预算 | 目标秒数、分镜秒数合计、差值；配音估时与实测值分开，不显示假的精确值 |
| 台词一致性 | 比较分镜中的明确台词与提示中的台词；无法可靠解析时提示人工核对，不自动判错或改写 |
| 连续性 | 展示前镜结束、本镜动作、后镜开头及相关素材，便于对照；不承诺纯规则能判断全部物理合理性 |
| 生成前预览 | 当前项目风格、解析引用后的本镜提示、参考清单、请求参数；标为“提交预览” |
| 生成后记录 | 读取原任务 `prompt`、`params` 的允许字段，显示服务端保存的请求信息；厂商内部改写或未记录的默认转换不能伪装成已知 |
| 结果与返工 | 在原历史视频和设为主视频能力上补失败分类：台词、风格、动作、连续性；调整具体输入后再重做 |

原视频生成会自动回写当前视频，本期保留这一行为并在重做时说明；没有新增候选隔离机制。纯文字规则检查可以两端复用同一字段规范与测试样例，不能把程序检查通过称为人审通过。

## 7. T08–T09：MCP 补齐同一能力

### 7.1 T08：首先补创作接口

以下为拟新增工具名，实施时统一命名即可，不改原 HTTP 路由：

| MCP 工具 | 核心参数 | 原接口与结果 |
| --- | --- | --- |
| `hb_get_production_requirements` | 项目 ID、剧集 ID | 读取原项目中的该集描述配置块，返回配置与哈希 |
| `hb_update_production_requirements` | 上述 ID、要求、旧哈希、`request_key` | `PUT /episodes/:id`；合并保留原说明，读回核对 |
| `hb_rewrite_script` | 上述 ID、原文哈希、文本模型配置可选、`request_key` | 调用原 `script_rewriter`；保存位置仍为原 `script_content` |
| `hb_breakdown_storyboards` | 上述 ID、剧本哈希、明确的重拆范围、模型配置可选、`request_key` | 调用原 `storyboard_breaker`；明确已有分镜可能被覆盖 |
| `hb_generate_video_prompts` | 上述 ID、分镜 ID 列表、单镜/原批量模式、模型配置可选、`request_key` | 单镜调用原提示 Agent；批量调用原集批量接口并查原状态 |
| `hb_get_call` | MCP 调用回执 ID | 查询长请求的结果或不明确状态，不生成新内容 |
| `hb_inspect_video_input` | 上述 ID、分镜 ID、本次选项 | 只读返回提示、素材和参数预览；不启动视频 |

`hb_write_script`、`hb_write_storyboards` 等直接编辑工具保留，用于用户明确要求的人工/AI 编辑。常规“AI 改写、AI 拆分”默认调用原 Agent，不在工具内部再次调用另一套文本模型。

### 7.2 长请求与不明确结果

改写 Agent 是同步 HTTP 接口，可能执行数分钟，而且没有原生持久化操作 ID。MCP 不能沿用普通读请求的 30 秒超时后自动重试。

具体修改 [core.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/core.ts)、[tools.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/tools.ts) 和必要的 HTTP 生命周期处理：

1. 给原 Agent 调用设置独立、可配置的等待时限，建议初始为 300 秒，普通查询保持原 30 秒超时；实际值通过样例调整。网页侧也显示仍在等待，不伪造 Agent 内部阶段进度。
2. MCP 使用现有请求回执存储登记调用，先返回回执 ID，由扩展等待原请求；`hb_get_call` 查询结果。这个 ID 只表示一次 MCP 请求，不是一套新的制作任务或内容状态，网页仍直接访问原 Agent。
3. 同一 `request_key` 和相同参数返回原回执，不再次发送。不同参数复用同一 key 报冲突。登记、实际派发、接收结果分别落盘。
4. 网络超时、进程重启或丢失响应标为“不明确”，保留请求前内容哈希和范围；先读取原剧本/分镜核对，不自动补发。数据变化只能作为核查证据，不能证明这一次 Agent 已完整成功。
5. 原批量提示接口已有进度查询，优先使用它，不额外造一套批量任务；服务端重启后进度丢失须如实呈现。
6. 输入、输出与错误按字段白名单整理；不要把原始配置密钥、整个工具调试结果或 Provider 错误正文写入 MCP 回执。

扩展关闭时停止新派发，未收到响应的已派发请求保留不明确状态；后台回调不得在存储锁释放后继续写旧实例。MCP 内同集冲突调用可拒绝并提示在途请求，但这不能锁住原网页或提供跨入口事务。

现有 `sanitize()` 会丢弃 `params`、`settings` 等字段。为任务预览和配置管理增加专用的安全字段映射，不直接移除全局过滤，也不把所有原响应无差别透传。

### 7.3 T09：完整功能覆盖清单

“能力只多不少”按下表逐项验收，不能只增加三个创作工具就宣布完成。MCP 可用分组工具和结构化参数表达，不必为每个按钮创建一个工具。

| 业务范围 | 原 API | 现有 MCP 情况与要补的内容 |
| --- | --- | --- |
| 项目、剧集 | `/dramas`、`/episodes` | 已有查找/创建和部分写入；补齐字段修改、删除、详细读取，严格区分项目和集范围 |
| 剧本与制作要求 | `/episodes/:id`、`/agent/script_rewriter/chat` | 已有直接写入；补 T02、T03 和原 Agent 调用 |
| 分镜与提示 | `/episodes/:id/storyboards`、`/storyboards/:id`、原 Agent/批量提示 API | 已有新增/更新；补原 AI 拆分、提示生成、状态查询、删除与明确重建范围 |
| 资产提取与编辑 | `/episodes/:id/extract`、`extract-status`、角色/场景/道具 CRUD | 已有部分 CRUD；补提取、状态、删除及网页可编辑字段 |
| 资产最终提示 | 各资产 `generate-prompt` 接口 | 补生成、强制重生成选项和结果读取，复用原服务端风格注入 |
| 图片与视频生成 | 资产 `generate-image`、`/tasks` | 已有计划和执行；补网页可用的媒体参数、参考模式、批量范围及一致预检 |
| 上传与绑定 | `/upload/image`、`/upload/video`、`/upload/audio`、资产/分镜 PUT | 补文件传输和原地址绑定；视频 50 MB、音频 20 MB 按原限制处理 |
| 任务和历史结果 | `/tasks`、`/episodes/:id/generation-tasks` | 补精确查询、允许的参数读取和任务记录删除；删除记录不等于取消 Provider 任务 |
| 主视频与合成 | 分镜 PUT、`/merge/episodes/:id/*` | 已有部分选择/合成；补合成状态、历史、成片访问地址，与网页同一记录 |
| 风格预设 | `/style-presets`、项目 `style` | 补查改与项目绑定；避免无意修改所有使用同一风格的项目 |
| Agent 配置 | `/prompts`、`/skills` | 补读取、保存、重置/删除等现有操作；作用范围和语言明确，不能把正文视为客户端执行指令 |
| 模型与应用设置 | `/ai-configs`、`/settings/content-language`、`/storage` | 补原页面可用操作；密钥写入后只返回掩码，已有密钥不回显给模型 |
| 服务端版本管理 | `/server-update/*` | 列入覆盖，检查与应用更新分开；应用更新可能重启服务，不用于当前制作任务自动修复 |
| 桌面专属能力 | `window.huobaoDesktop` 的迁移、桌面更新 | 无原 HTTP 接口，列为独立缺口；不能假称上述服务端更新 API 等价于桌面更新 |

媒体上传不能把几十 MB 的 base64 塞进现有 1 MiB MCP 请求体。实施时使用有大小上限的分块上传调用，扩展临时组装后转为原 multipart 上传；返回原媒体地址并清理临时文件。临时传输文件不是新的媒体资产库。仅接受服务器本地路径不能覆盖其他设备上的 MCP 客户端。

各工具使用明确动作枚举与字段校验，不开放任意 HTTP 路径代理。桌面迁移等没有原 API 的功能需要单独设计桌面接入，在补齐前如实标记，不作为影视质量改进已完成的证据。

## 8. 原服务端源码保持不动时的限制与最小后续修改点

本表是边界清单，**不是本期修改授权**。其余任务可以先做，但受限功能不能写进“已完整支持”。

| 限制 | 所在位置 | 本期处理 | 若后续允许改源码，最小修改方向 |
| --- | --- | --- | --- |
| 改写工具返回固定每场 30–60 秒；优先读取原文 | [script-tools.ts](/Users/mubaili/Documents/Code/huobao-drama/backend/src/agents/tools/script-tools.ts) | 配置以 `read_episode_script` 为主要读取入口；验证遗留指令是否仍影响结果。局部编辑不复用原文重写入口 | 删除固定创作规则；明确源文本/当前剧本读取模式 |
| 批量提示硬编码 3 秒；不接收新增创作上下文 | [video-prompts.ts](/Users/mubaili/Documents/Code/huobao-drama/backend/src/services/video-prompts.ts) | 从原集描述读取要求，验证新 Skill 的行为；批量路径未通过灵活时长测试时不标为完全支持，也不新建替代服务 | 请求只指定目标和范围；创作规则统一来自配置，并传递明确的本次要求 |
| 批量“成功”仅检查提示非空，旧值也可能被算成功；进度在内存 | 同上 | 调用前后读取目标内容，对照范围和结果；旧值相同不能单凭哈希判失败或判成功 | 保存操作关联信息和校验结果；若需要恢复，使用原任务设施 |
| 分镜保存工具描述要求首批清空；重拆非原子 | [storyboard-tools.ts](/Users/mubaili/Documents/Code/huobao-drama/backend/src/agents/tools/storyboard-tools.ts:248) | 仅明确整集重拆时调用；局部编辑走原 PUT；不承诺保存前审批隔离 | 明确重建/增量模式及覆盖范围；按实际需要补事务或版本能力 |
| Agent 同步调用，无持久化调用 ID | [agent.ts](/Users/mubaili/Documents/Code/huobao-drama/backend/src/routes/agent.ts:32) | MCP 保存请求回执，异常后核对数据；网页不假装能恢复一次丢失的响应 | 在原 Agent 调用上增加任务化接口，复用原服务端而非扩展另建编剧业务 |
| 原生生成完成后自动更新当前视频 | [generation.ts](/Users/mubaili/Documents/Code/huobao-drama/backend/src/services/generation.ts:461) | 保留原历史与主视频选择，重做前说明影响 | 若用户需要，给原生成增加候选/采用行为；不在扩展维护另一份主视频真相 |
| 原合成没有独立音轨与精细时间线输入 | [ffmpeg-merge.ts](/Users/mubaili/Documents/Code/huobao-drama/backend/src/services/ffmpeg-merge.ts) | 继续使用原合成，不能将关闭原生音频误称为已完成后期配音 | 在原声音/合成能力中补音轨与剪辑参数，详见第 9 节 |

因此，本期可以显著改善创作输入、规则和可检查性；**在完全不改服务端源码的约束下，不能预先保证所有旧入口完全消除规则冲突，也不能保证严格逐字配音和精确成片时长。** 是否必须处理表中某项，由对应验收结果决定。

## 9. 后续声音与剪辑增强，先明确接口再实施

这些是原视频/合成步骤的能力补充，不重建制作流程。需要单独确定允许修改的原服务端范围后再执行。

| 能力 | 需要明确的最小接口/数据 | 接入现有哪里 |
| --- | --- | --- |
| 独立配音 | 逐字文本、说话人/音色、音频文件、实际时长与对应分镜关系 | 原视频制作区域及原任务/媒体存储；网页可试听，MCP 可查询和重做 |
| 台词核验 | 批准文本、转写结果、差异和末尾完整性 | 原生成结果检查；检查不等于自动批准 |
| 精细裁切与混音 | 每段采用文件、入出点、音频起点/增益、字幕和最终目标时长 | 原合成请求与历史结果；网页和 MCP 提交同一种参数 |
| 静帧预演 | 已有分镜图、时长和音轨 | 作为原预览能力，验证节奏后再生成视频 |

若服务端仍保持完全不可改，这些项目保留为未解决缺口，不在 MCP 中单独接一套 TTS/剪辑系统伪装成网页已有能力。

## 10. 文件级改动清单

现有文件的职责和修改位置如下；提议新增的文件只做原功能所需的配置处理、检查或接口封装。

| 文件/位置 | 修改内容 |
| --- | --- |
| 第 3 节六组配置及语言变体 | 专业创作规则、时长、台词和字段职责；通过原配置接口部署 |
| [episode.vue](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/views/drama/episode.vue) | 制作要求；等待保存；改写/拆分/补提示范围；视频参数、素材清单与检查展示 |
| [useAgent.ts](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/composables/useAgent.ts) | 明确等待/失败状态，按需返回 Agent 响应以供核验；不把模型回复当落库事实 |
| [useApi.ts](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/composables/useApi.ts) | 原接口参数类型与调用封装，保留原 API 地址 |
| [settings.vue](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/pages/settings.vue) | 如需调整，仅补有效配置、作用范围与恢复提示；不增加流程中心 |
| [中文文案](/Users/mubaili/Documents/Code/huobao-drama/frontend/app/locales/zh.json)及对应 en/ja/ko | 新字段、失败原因、范围说明、检查结果 |
| [tools.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/tools.ts) | 新接口工具、参数契约、操作范围及能力发现；保留原工具兼容 |
| [production.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/production.ts) | 生成参数、引用顺序、模型差异与计划预检；继续复用原任务 |
| [core.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/core.ts) | 请求超时选项、长调用回执恢复、安全字段映射与 multipart 访问 |
| [server.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/server.ts)、[stdio.ts](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/stdio.ts) | 长请求及文件分块的协议边界、服务关闭行为；不创建新的网页业务 API |
| [MCP README](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/README.md) | 新工具、原生写入副作用、覆盖清单、超时核查方法；移除与实际新能力不符的旧说明 |
| [集成测试](/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/tests/integration.test.ts)和前端测试目录 | 新接口、跨入口读回、重复请求、参数与关键交互验证；保留原通过项 |

拟新增的小文件可采用以下位置（尚未创建）：

- `/Users/mubaili/Documents/Code/huobao-drama/frontend/app/composables/useProductionRequirements.ts`：原描述配置块的页面读写。
- `/Users/mubaili/Documents/Code/huobao-drama/frontend/app/components/ProductionRequirements.vue`：嵌入原页面的表单。
- `/Users/mubaili/Documents/Code/huobao-drama/extensions/huobao-mcp/src/agent-calls.ts`：原 Agent 的 MCP 调用回执，不包含剧本生成规则。
- `/Users/mubaili/Documents/Code/huobao-drama/docs/fixtures/production-contracts.json`：两端使用同一组输入/输出契约样例。

若实现规模不需要拆文件，可留在现有模块；不以抽象层数量作为目标。两端可以有各自的 UI/协议代码，但专业长规则只维护在原 Agent 配置中。

## 11. 验证与上线顺序

### 11.1 必须通过的技术验收

| 用例 | 预期 |
| --- | --- |
| 原文保存延迟/失败后点击改写 | 保存成功前不调用 Agent；失败后不显示已生成 |
| 制作要求跨入口读写 | 网页与 MCP 读同一集描述；保留原说明，拒绝覆盖损坏配置；不污染正文 |
| 同一原文、要求、模型配置 | 两端命中同一原 Agent 和有效配置；不要求随机生成文本逐字相同 |
| 单镜生成、批量生成、拆分时生成 | 分别核验台词、镜头范围和时长规则；记录批量硬编码限制 |
| 自动补缺失提示 | 只传缺失 ID；已存在提示不被重做 |
| 多镜与长台词 | 台词完整，时间段总和正确，无机械截句；估时不是实测 |
| 素材去重、缺图、同名、超过上限 | 两端给出一致处理；编号对应实际清单，无静默截断 |
| 音轨/改写开关、模式切换 | 支持的参数真正到达原 `/tasks`；不兼容组合在调用前提示 |
| 提交预览和任务记录 | 明确区分预览与保存值；风格只注入一次；不泄露敏感配置 |
| MCP 同 key 重复调用、超时、重启 | 不重复执行改写/拆分；不明确提交可查询，不能自动重发 |
| 网页 → MCP → 网页接手 | 同一项目和分镜 ID，刷新可见修改；不用导入第二套数据 |
| MCP 关闭及扩展停止 | 原网页仍能调用原后台改写、拆分和生成；不把 MCP 队列暂停误当全局取消 |
| 配置回滚及多语言 | 恢复实际旧内容；各语言变体生效可验证，不意外回退到旧默认 |
| 服务端源码约束 | `backend/src/` 与实施前基线一致，保留已有修改；无数据库结构变更 |

测试优先覆盖行为和副作用，不只用“文件里出现某段字符串”的结构测试证明功能正确。格式和纯配置修改用规则检查与实际案例验证；请求去重、保存先后、参数整理和超时恢复使用有意义的模拟集成测试。

计划运行的现有检查命令（执行时按实际改动范围选择）：

```sh
npm --prefix extensions/huobao-mcp run typecheck
npm --prefix extensions/huobao-mcp test
npm --prefix extensions/huobao-mcp run build
node --test frontend/tests/*.test.mjs
npm --prefix frontend run generate
git diff --check
```

实际网页还需验证制作要求保存、生成范围、参数预览及刷新读回。SDK 握手通过不等于网页交互通过，也不等于所有 AI 客户端均已实测。

### 11.2 内容质量验收

先保留当前案例的原文、旧剧本和旧分镜作基线，使用测试项目进行对照，不覆盖现有作品。文字阶段至少覆盖：档案旁白、人物对白、动作、道具交接、空间切换、情绪反应、连续动作和异常现象。

逐项记录：原文事实是否保留、因果是否成立、前后镜是否接得上、台词是否完整、摄影和材质细节是否有实际作用、时长是否有依据。比较的是有效改善，不是字数增加。

文字通过后，先用 2–3 个代表镜头做视频小样，在明确的生成预算内比较。记录首次可用比例、可用成片费用、重试次数和人工修改时间；没有实测结果前，不宣称成品率已提高到某个百分比。

### 11.3 发布与回滚

1. 保存源码、配置及测试数据基线；完成 T01 的规则清单。
2. 开发制作要求与前端保存顺序，补对应 MCP 调用；先用模拟上游验证接口。
3. 更新测试实例的改写/分镜/提示配置，跑文字案例；逐项确认第 8 节限制是否影响验收。
4. 接通视频参数和检查展示，完成 MCP 覆盖清单；再做受控样片。
5. 部署配置、前端和扩展，检查两端读取同一结果；最后核对原服务端源码基线。
6. 若回滚，恢复本次配置和前端/扩展版本；描述中的制作要求保留且旧版可忽略，不自动删除用户内容。已生成的剧本和媒体不会因代码回滚自动恢复，需按事先备份和用户选择处理。

本期结束时应交付：代码与配置修改、实际生效配置清单、网页/MCP 能力覆盖表、技术验收记录、内容对照样例，以及仍受服务端约束的未完成项。**强化完成了哪些现有能力，要逐项可核对。**
