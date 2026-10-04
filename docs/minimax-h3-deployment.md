# MiniMax H3 视频模型部署配置调研

调研时间：2026-10-04。范围是本项目使用的 **MiniMax-H3 视频生成模型**，不是 MiniMax M 系列文本模型。以下配置以 [MiniMax 官方仓库](https://github.com/MiniMax-AI/MiniMax-H3)、[模型卡](https://huggingface.co/MiniMaxAI/MiniMax-H3)、[SGLang H3 cookbook](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3) 和 [MiniMax API 文档](https://platform.minimax.io/docs/api-reference/video-generation-v2-create) 为准。

## 结论

- **最快接入本项目**：使用 MiniMax 托管 API。现有设置页内置 `MiniMax-H3`、`https://api.minimaxi.com`；后端适配器已按 `/v2/video_generation` 创建任务、按 `/v2/query/video_generation/{task_id}` 轮询。配置 API Key 即可使用，实际调用仍需账户开通和额度。官方还提供全球站 `https://api.minimax.io`。[官方 API 创建任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)、[查询任务](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)、[官方仓库地域端点](https://github.com/MiniMax-AI/MiniMax-H3#full-2k-workflow)
- **可以本地部署，但只开放了 H3-Base**：官方发布 BF16 的 `FL2VA`（文生视频、首尾帧）和 `Ref2VA`（参考图/视频/音频）两套权重；本地目标是短边 768 像素、4–15 秒、24 FPS、32 kHz 双声道音频。完整官方 2K 效果还使用未开放的 `H3-Context-IR` 和 `H3-Regenerate-2K`，要复现需组合官方 API；不能把本地 H3-Base 等同于完整 2K API。[官方仓库：模型与开放范围](https://github.com/MiniMax-AI/MiniMax-H3#recommended-workflow)
- **本地服务不能仅改本项目的 Base URL 接入**：SGLang 用 `/v1/videos` 创建、查询与下载，且请求体是 `prompt`、`task`、`conditions`、`target`；本项目适配器使用 MiniMax 的 `/v2/video_generation`、`content[]`、`resolution` 和 `duration`。需要新增本地服务适配器或网关做协议与结果映射。[SGLang 请求示例](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#4-generate-video-and-audio)

## 托管 API 配置

| 项目 | `MiniMax-H3` | `MiniMax-H3-Max` |
| --- | --- | --- |
| 模型 ID | `MiniMax-H3` | `MiniMax-H3-Max` |
| 分辨率 | `768P`、`2K` | `480P`、`768P` |
| 时长 | 4–15 秒，整数 | 5–15 秒，整数 |
| 部署方式 | 官方 API；H3-Base 有开放权重 | 官方 API；官方开放权重仓库没有单独的 Max 权重 |

以上模型和参数取自 [MiniMax 视频创建接口](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)。文生视频必须传非空文本与具体 `ratio`（例如 `16:9`）；首尾帧图生视频由图决定比例；参考模式可用 `adaptive`。提交成功返回 `task_id`，完成后的查询结果在 `task.content.url`。请求头为 `Authorization: Bearer <API Key>` 和 `Content-Type: application/json`。[创建接口字段](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)、[查询接口](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)

```bash
curl -X POST 'https://api.minimaxi.com/v2/video_generation' \
  -H "Authorization: Bearer $MINIMAX_API_KEY" \
  -H 'Content-Type: application/json' \
  -d '{"model":"MiniMax-H3","content":[{"type":"text","text":"一只猫在窗边看雨，镜头缓缓推近，环境音自然。"}],"resolution":"768P","duration":5,"ratio":"16:9"}'

curl -H "Authorization: Bearer $MINIMAX_API_KEY" \
  'https://api.minimaxi.com/v2/query/video_generation/<task_id>'
```

中国站地址取自 [官方 H3 完整流程示例](https://github.com/MiniMax-AI/MiniMax-H3#full-2k-workflow)；上述请求格式与结果结构取自 [创建](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)和[查询](https://platform.minimax.io/docs/api-reference/video-generation-v2-query)文档。生产接入时，参考素材用公开可访问 URL；官方给出的请求体上限 64 MB，参考图最多 9 张、视频和音频各最多 3 段。[素材约束](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)

**本项目兼容性点**：`backend/src/services/adapters/minimax-video.ts` 以 `MiniMax-H3*` 前缀接受模型名，但目前统一按 H3 的 `768P/2K` 和 4–15 秒处理。若选择 H3-Max，`2K` 和 4 秒会与官方约束冲突，需要按具体模型分支校验；目前设置页也只列 `MiniMax-H3`。适配器还应注意官方文档将参考音频标为 `role=reference_audio`，而现有请求只传 `audio_url`，以及官方要求首尾帧模式与参考模式互斥。这里只记录调研发现，未修改代码。[创建接口输入组合](https://platform.minimax.io/docs/api-reference/video-generation-v2-create)

## 本地部署硬件档位

以下是 **SGLang 官方已验证方案**，不是通用最低显存承诺；输入时长、分辨率、并发数会改变显存和延迟。[SGLang H3 部署与基准](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#3-deployment-details)

| 档位 | 官方已验证配置 | 取舍 |
| --- | --- | --- |
| 单卡验证 | 1× RTX 4090 24 GB，DiT/文本编码器逐层卸载至内存，`convrot_int8`；官方测试峰值约 18 GB 显存 | 可跑 768p；严重依赖主机内存与数据搬运，50 步 BF16/FA 测试约 1008.6 秒，INT8/FA 约 718.5 秒，不适合作为高并发生产基线。 |
| 双消费卡 | 2× RTX 5090 32 GB，TP2、逐层卸载，20 个 DiT 层常驻；已验证主机 377 GiB，建议 384 GiB 级内存 | 保留 BF16/FP32 数值，主机内存要求高。 |
| 数据中心常驻 | 4× H100 80 GB：TP2 + Ulysses2；或 4× H200 141 GB：Ulysses4 | 官方测得的常驻权重配置，适合作为稳定吞吐与延迟评估起点。 |

来源：[SGLang 4090、5090、H100、H200 配方](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#3-deployment-details)、[SGLang 测量表](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#11-benchmarks)。量化、裁剪、GGUF 等社区权重可进一步改变容量与质量，不应把其结果视作官方 BF16 基线。[SGLang 权重格式说明](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#checkpoint-and-adapter-formats)

## 本地 SGLang 启动示例

官方建议 Linux NVIDIA 环境采用 [SGLang Diffusion Docker 镜像](https://docs.sglang.io/docs/sglang-diffusion/installation)，也可在 Python 3.12 虚拟环境安装 `sglang[diffusion]`；模型 ID 为 `MiniMaxAI/MiniMax-H3`。SGLang 会按 `--model-variant` 选择权重，FL2VA 和 Ref2VA 要分别起服务；不需要同时下载仓库全部格式。[MiniMax 官方启动示例](https://github.com/MiniMax-AI/MiniMax-H3#sglang-deployment)、[SGLang cookbook](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3)

```bash
# 4× H100 80 GB：文生视频 / 首尾帧
sglang serve \
  --model-path MiniMaxAI/MiniMax-H3 \
  --model-variant fl2va \
  --num-gpus 4 --tp-size 2 --ulysses-degree 2 \
  --encoder-parallel auto --performance-mode speed \
  --host 0.0.0.0 --port 30010

# 同机要支持参考图/视频/音频时，另部署 Ref2VA；需另配足够 GPU 资源
sglang serve \
  --model-path MiniMaxAI/MiniMax-H3 \
  --model-variant ref2va \
  --num-gpus 4 --tp-size 2 --ulysses-degree 2 \
  --encoder-parallel auto --performance-mode speed \
  --host 0.0.0.0 --port 30011
```

H100 启动参数依据 [SGLang 实测配置](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#3-deployment-details)；Ref2VA 参数沿用相同拓扑，但要按实际任务测显存。最简本地 T2VA 请求如下；创建后查询 `GET /v1/videos/{id}`，再下载 `GET /v1/videos/{id}/content`。[SGLang API 示例](https://docs.sglang.io/cookbook/diffusion/MiniMax/MiniMax-H3#4-generate-video-and-audio)

```bash
curl -X POST 'http://127.0.0.1:30010/v1/videos' \
  -H 'Content-Type: application/json' \
  -d '{"model":"MiniMaxAI/MiniMax-H3","prompt":"一只猫在窗边看雨，镜头缓缓推近，环境音自然。","seconds":5,"task":"t2va","conditions":[],"target":{"short_edge":768,"aspect_ratio":"16:9","duration_seconds":5.0},"num_inference_steps":50,"flow_shift":12.0,"audio_flow_shift":3.0}'
```

## 开放权重许可

H3 开放权重使用 **MiniMax H3 Community License Agreement**，不是 Apache/MIT。许可证定义的适用地域排除欧盟、英国、韩国和美国；商业产品/服务年收入超过 2000 万美元须事先取得 MiniMax 书面授权，使用 H3 的商业产品 UI 还须显著标注“MiniMax H3”。上述是**开放权重的许可证**要求，不等同于托管 API 服务条款；落地前应核对完整协议及部署/用户地域。[官方模型卡](https://huggingface.co/MiniMaxAI/MiniMax-H3)、[许可证原文](https://huggingface.co/MiniMaxAI/MiniMax-H3/blob/main/LICENSE)
