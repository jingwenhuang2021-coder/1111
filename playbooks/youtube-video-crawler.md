# Playbook：YouTube 视频爬虫（antigravity A1 / Avata360）

## 目的
生成一份按西班牙语和意大利语分类的 Excel 文件，包含 YouTube 上与 `antigravity A1` 和 `Avata360` 相关的视频链接及对应 YouTuber 的频道链接。

## 前提条件
- 已安装 Node.js 和 npm
- 已设置环境变量 `YOUTUBE_API_KEY`（YouTube Data API v3 的 API Key）
- 项目依赖已安装（`googleapis`、`xlsx`）

## 步骤
1. 【脚本调用】`node scripts/fetch-youtube-videos.js` — 无需参数，读取 `YOUTUBE_API_KEY`，输出 `.tmp/youtube-videos-[timestamp].xlsx`
2. 【判断】若脚本报错配额不足，减少 `MAX_RESULTS_PER_QUERY` 后重试；若报错 API Key 无效，检查环境变量或 Google Cloud Console 配置

## 判断标准
- 遇到 "quotaExceeded" 错误时，将 `MAX_RESULTS_PER_QUERY` 从 50 降至 25 或 10，理由是 YouTube Data API 每日搜索配额为 100 单位/次，降低数量可控制总消耗。
- 遇到 "badRequest" 或 "invalidKey" 时，优先检查 `YOUTUBE_API_KEY` 是否正确导出，而非直接修改脚本逻辑。
- 本流程线性执行，无需预定义其他判断标准。

## 验证
- 检查 `.tmp/` 目录下是否生成了新的 `.xlsx` 文件
- 打开 Excel 文件，确认包含以下列：关键词、语言分类、视频标题、视频链接、频道名称、频道链接、发布日期、视频描述、API语言标记
- 确认西班牙语和意大利语分类下均有数据（若关键词在对应语言下无结果，可能为空）
