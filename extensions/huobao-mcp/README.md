# Huobao MCP 扩展

独立运行的标准 MCP 服务，通过现有 HTTP API 操作火宝。原服务端代码、数据库结构和生成实现不需要修改。支持 Streamable HTTP，以及连接同一实例的 stdio 桥接。Codex、Claude、Cursor 等客户端须支持相应传输和凭据配置；不依赖任何客户端的私有 API。

## 本地启动

在仓库根目录执行：

```sh
npm install --prefix extensions/huobao-mcp
npm run dev:mcp
```

保持原火宝后端及前端运行。打开网页「设置 → MCP 服务」即可查看状态、操作开关和复制连接信息，无需配对码或管理会话。重启扩展后，页面自动重新连接。

首次启动默认关闭。关闭后管理接口仍运行，拒绝新的 MCP 调用并暂停 MCP 的后续派发。原网页继续直接使用原后台，不受该开关影响。已经交给火宝的任务可能继续写入作品。重新开启不自动恢复旧运行；通过页面或工具显式恢复。

前端开发代理默认指向 `127.0.0.1:5680`。若修改端口，设置 `HUOBAO_MCP_PROXY_TARGET` 后重启前端。生产静态页面需要额外反向代理，不能仅复制页面文件就自动获得控制接口。

生产构建：

```sh
npm run build:mcp
npm --prefix extensions/huobao-mcp start
```

首次启动会创建 `.data/`，其中包含访问凭据，已加入 Git 忽略。不要将它提交或对外分享。一个数据目录只允许一个扩展进程，且绑定一个后端地址。变更后端地址必须使用另一数据目录，防止旧对象 ID 被写到另一个实例。

## 连接任意 AI 客户端

### Streamable HTTP

在网页点击「复制连接信息」，得到地址和 Authorization 请求头。示意：

```json
{
  "transport": "streamable-http",
  "url": "http://localhost:5680/mcp",
  "headers": {
    "Authorization": "Bearer <从页面获取的凭据>"
  }
}
```

这是连接参数说明，不是所有客户端共用的配置文件格式。按客户端的 MCP 配置要求填入 URL 和请求头。复制的信息包含密钥。当前是本地或受控部署使用的静态 Bearer 认证，不提供 OAuth 动态注册；只接受 OAuth 的远程客户端不能直接接入。

### stdio 桥接

只支持 stdio 的客户端也可以连接，但必须先启动上面的 HTTP 扩展并开启开关。先执行构建，再将以下参数按客户端格式填写：

```json
{
  "command": "node",
  "args": ["/绝对路径/huobao-drama/extensions/huobao-mcp/dist/stdio.js"],
  "env": {
    "HUOBAO_MCP_URL": "http://localhost:5680/mcp",
    "HUOBAO_MCP_TOKEN": "<复制信息中 Bearer 后面的凭据>"
  }
}
```

桥接仅转发协议，不维护第二套状态，无法绕过网页开关。关闭服务后已有 stdio 客户端的工具调用也会失败。日志不写入 stdio 的协议输出。

## 已实现工具

| 工具 | 用途 |
|---|---|
| `hb_find_projects` | 按名称查找项目，分页摘要 |
| `hb_get_context` | 读取制作概况、对象 ID、模型配置摘要和扩展能力 |
| `hb_read_content` | 分页读取原文、剧本、素材、分镜、任务；长剧本按字符分页 |
| `hb_create_project` | 创建项目 |
| `hb_create_episode` | 创建剧集，复用原服务端模型配置校验 |
| `hb_update_brief` | 兼容旧版的 MCP 项目备注；本集制作要求请用新的 requirements 工具 |
| `hb_write_script` | 使用上次读取的内容指纹检查后保存原文或剧本 |
| `hb_upsert_assets` | 精确新增、更新当前集素材，逐项回执 |
| `hb_write_storyboards` | 精确新增、更新分镜及当前集素材关联 |
| `hb_plan_production` | 预检并保存图片、视频或拼接计划，不开始生成 |
| `hb_start_run` | 持久化并启动计划，立即返回运行 ID |
| `hb_get_run` | 读取运行、步骤、原任务 ID、产物和失败信息 |
| `hb_control_run` | 暂停/恢复后续派发；为不明确提交绑定经过核对的原任务 ID |
| `hb_get_review` | 汇总产物、审阅意见及过期标记 |
| `hb_record_review` | 记录针对具体产物的人类审阅意见 |
| `hb_revise_production` | 按反馈为限定目标创建新计划，不自动开跑 |
| `hb_select_artifact` | 选择属于该对象的已完成历史任务产物；分镜仅支持选择视频 |

建议客户端操作顺序：查找项目 → 获取上下文 → 读取/保存本集制作要求 → 调用原改写/拆分 Agent → 读回原正文核对 → 预检制作计划 → 在用户授权范围内启动 → 查询运行 → 呈现产物供用户审阅 → 局部修改。

所有产生原生写入的工具要求稳定的 `request_key`。重复调用使用原来的 key 和完全相同的参数；不要因为响应超时换 key 再试。批量返回 `succeeded/failed/partially_created/unknown/not_started`，不会假装原子成功，也不会回滚已经保存的用户数据。

`hb_write_script` 的 `expected_hash` 从 `hb_read_content` 获得，是整个字段的指纹，与分页位置无关。它只能尽力检测并发修改，不能替代原服务端不具备的 CAS 锁。

## 0.2 新增工具与原生调用

| 工具 | 原能力 / 范围 |
| --- | --- |
| `hb_get_production_requirements` / `hb_update_production_requirements` | 读写原集 description 的版本化配置块，保留块外说明，写前检查指纹并读回 |
| `hb_rewrite_script` / `hb_breakdown_storyboards` | 调用原改写/拆分 Agent；重写/重拆会覆盖原内容 |
| `hb_generate_video_prompts` | 单镜调用原 Agent；整批复用原批量接口，必须给出明确 ID |
| `hb_get_call` | 查询原同步 Agent 的 MCP 请求回执；不是新的业务任务 |
| `hb_inspect_video_input` | 生成前检查提示、素材、音轨、首尾帧、参数及风格预测，不启动生成 |
| `hb_project_action` / `hb_episode_action` | 原项目/剧集详情、修改、删除、提取与进度、生成/合成历史 |
| `hb_asset_action` / `hb_storyboard_action` | 原资产/分镜读取、删除、媒体绑定、资产最终提示生成 |
| `hb_task_action` | 精确查询历史任务、安全提交参数、删除记录（不取消生成） |
| `hb_style_action` | 风格预设管理；影响所有绑定该预设的项目 |
| `hb_prompt_action` / `hb_skill_action` | 原 Agent 配置与语言变体管理；使用内容哈希检查冲突 |
| `hb_model_config_action` | 原模型配置查改、删除与连通性测试；凭据仅写入、掩码返回 |
| `hb_application_action` | 原内容语言、存储信息、引导设置、服务端版本检查/更新 |
| `hb_capabilities` | 能力与限制说明 |
| `hb_upload_begin/chunk/finish/abort` | 客户端文件分块传输，再调用原 multipart 上传接口 |

共 39 个工具。网页与 MCP 使用 `shared/production.mjs` 中同一组纯函数进行制作要求解析、请求文本整理和视频参数检查；这不是一个新增的运行服务。专业创作规则仍在原 Agent 配置中。

Agent 工具立即返回 `call_id`，用 `hb_get_call` 查询。`response_received` 只代表原请求已返回，仍需检查原 `script_content`、分镜或最终提示。超时、原 Agent HTTP 400（可能已经局部写入）、进程重启均保留不明确状态，禁止自动重发。相同 key 返回原回执。关闭扩展会中止等待并把已派发调用标成不明确；原后台仍可能继续执行。

视频计划的 `storyboard_video` 动作支持 `video_options`，与只读预览的 `options` 相同：

```json
{"kind":"storyboard_video","target_id":123,"video_options":{"mode":"reference","generate_audio":true,"prompt_extend":false}}
```

支持 `text/reference/first_frame/first_last`，以选定适配器为准。Wan 支持音轨、提示改写、随机种子与水印；Seedance 不支持首尾帧且只有 4–15 秒；MiniMax 的音轨开关无效，因此不接受关闭音轨的请求。图像外观、动作和台词能否准确实现仍取决于模型。

上传先声明 `kind/filename/size_bytes/sha256`，每块最多 256 KiB，传标准 base64 和准确 offset；最后 finish 返回原媒体地址。视频最大 50 MiB、音频和图片最大 20 MiB（图片是扩展自身的上限）。最多四个未完成传输，一小时过期或重启后失效。传输临时文件不是素材库，完成后删除；绑定到具体资产/分镜需要明确调用。所有分块各自使用稳定 request_key。

配置发布与回滚使用仓库脚本，完整备份保存在被 Git 忽略的 `.local-backups/`：

```sh
node scripts/deploy-production-config.mjs --apply
node scripts/deploy-production-config.mjs --restore .local-backups/旧配置快照.json
```

脚本对 24 份配置逐项通过原 API 保存并读回；不使用 reset。原批量生成提示仍含服务端固定三秒指令，不能宣称已完全消除。日文/韩文配置保留语言指令并使用相同英文专业规则，生成语言仍由全局内容语言控制。

## 制作和恢复边界

- 支持角色图、场景图、道具图、分镜图、分镜视频、剧集拼接。所有模型请求、文件下载和媒体处理由原火宝执行。
- 计划使用当前已经具备的输入，执行前再次检查内容是否变化。初版不自动创建任意依赖图：资产图完成后，再规划依赖这些图片的视频；视频完成后，再规划拼接。同一对象的连续改写建议分计划执行。
- 视频参考图按场景、角色、道具顺序整理并去重。Wan 图片/视频/音频上限为 10/5/5（合计 20），Seedance 为 9/3/3，MiniMax 为 9/3/3（含帧合计 12）。不截断素材。未引用的无图资产仅提示；引用了无图对象则阻止提交，文生视频可去掉图片标记。视频能力来自本仓库适配器，详见 hb_inspect_video_input。
- 原生生成会自动回写当前图片或视频。计划明确展示 `overwrites_current`。本扩展不能将原服务端的生成改造成候选稿隔离。
- 扩展一次观察到一个在途生产任务时不再派发另一个；它无法限制网页派发或判断不明确提交是否仍在上游运行，因此不是全系统并发限制。
- 扩展重启后运行暂停，不自动继续生产；已知任务 ID 可以继续只读跟踪。原后端重启丢失的任务状态无法由扩展恢复。
- 网络断开、超时、5xx 或无可追踪 ID 的生成结果标记为 `submission_unknown`，不自动重复派发。先读取原任务列表核对，再用 `hb_control_run` 的 `reconcile`、`step_index`、`upstream_id` 绑定匹配的任务。工具会检查项目、对象及媒体类型，但具体是否属于那一次提交仍需调用方核对时间和内容。
- 失败步骤不自动重试；检查原因后仅对未完成目标建立新计划。暂停不取消已经提交的任务，删除任务记录也不作为取消手段。
- 原生项目、内容、素材及产物刷新网页即可看到；本集制作要求也使用原 episode.description，网页和 MCP 相互可见；旧版 brief、MCP 请求计划和审阅回执只保留为兼容数据。网页 MCP 面板显示近期运行，详细审阅通过工具读取。
- 提供明确作用范围的项目/剧集删除、原 Agent 整集重拆和模型配置管理；密钥只写不回显。没有任意 HTTP 路径代理、跨集强制挂载或扩展私有内容库。桌面迁移/更新没有原 HTTP API，仍是明确缺口。
- 当前面向个人/受控环境，一个 MCP 凭据可访问绑定实例的全部项目。未实现多租户项目权限、OAuth、Electron 打包整合、跨主机自动发现和自动升级。
- 扩展使用同步原子 JSON 检查点，适合当前单进程规模。历史记录未自动清理；使用前应确认数据目录持久化并定期备份。不要在生产中删除请求记录来处理超时。

## 配置与部署

| 环境变量 | 默认值/含义 |
|---|---|
| `HUOBAO_API_BASE_URL` | `http://localhost:5679/api/v1`，必须指向网页使用的后端 |
| `HUOBAO_MCP_HOST` | `127.0.0.1`，默认仅本机访问；容器内使用 `0.0.0.0` |
| `HUOBAO_MCP_PORT` | `5680` |
| `HUOBAO_MCP_AGENT_TIMEOUT_MS` | `300000`，原 Agent 等待时限；普通查询仍为 30 秒 |
| `HUOBAO_MCP_DATA_DIR` | 扩展目录下 `.data/` |
| `HUOBAO_MCP_PUBLIC_URL` | `http://localhost:5680/mcp`，供客户端使用的真实入口 |
| `HUOBAO_MCP_ORIGINS` | 默认 localhost 的 3013、5679 和扩展端口；逗号分隔精确 Origin |
| `HUOBAO_MCP_PROXY_TARGET` | 前端开发代理目标；修改后重启前端 |

可选容器：仓库根目录执行 `docker compose -f deploy/mcp/compose.yaml up --build -d`，然后打开网页 MCP 设置面板。此容器配置未在本次本机验证中实际构建运行。

静态网页部署参考 `deploy/mcp/nginx-location.conf`，设置公网 MCP URL 为 `https://你的域名/mcp-extension/mcp`，Origins 为同源网页地址。控制面不设登录或会话认证，保留 Host 和网页 Origin 检查；这些检查不替代身份认证。远程部署如需限制管理访问，由外部网关处理。原 API 和静态媒体入口如需鉴权，应由外部网关一起保护；仅保护 MCP 不会改变原服务端的访问控制。扩展输出按安全字段整理：任务只透出允许的提交参数，模型配置只返回密钥掩码，Provider 错误正文不进入回执。测试已有模型配置时，凭据仅在内存中送回原配置测试 API。

## 验证

```sh
npm --prefix extensions/huobao-mcp run typecheck
npm run test:mcp
npm --prefix extensions/huobao-mcp run test:backend
npm run build:mcp
npm run build:frontend
```

`test:backend` 需要原后端依赖已安装，且运行时 Node 主版本应与安装原后端原生依赖时一致（本机验证使用 Node 22）。它启动未修改的原后端，使用临时端口、临时数据库和假模型配置，通过 MCP 写入，再从网页使用的原接口读回；完成后清理，不访问付费模型或现有作品。

当前已验证标准 SDK 的 HTTP 客户端、stdio 桥接、真实网页免配对连接/开关/复制，以及原后端内容写入。尚未逐一实测 Codex、Claude、Cursor 产品自身的设置流程，不将协议通过等同于所有客户端验证完成。真实 Provider 的付费图片/视频及 FFmpeg 成片生成尚未实测，相关编排在模拟上游中验证。

0.2.0 验收：17 项 MCP 测试、8 项新增前端测试、原后端隔离联通及配置恢复、前端静态构建均通过。原前端全量测试保留 24 项既有失败，与干净基线一致。原文字 Agent 已用两个隔离样例实测，视频样片按用户选择未生成。完整结果、已知限制及配置备份见[实施验收记录](../../docs/huobao-professional-video-implementation-results.md)。
