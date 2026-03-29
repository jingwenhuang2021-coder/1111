# Scripts 目录

此目录存放所有的 Script（执行层文件），这些脚本应当是确定性的、可独立运行的。

## 脚本编写规范

### 模板

```bash
#!/bin/bash
# 用途：[说明脚本的单一功能]
# 参数：[输入参数的说明，例如：$1=输入文件路径]
# 输出：[输出到 stdout 的内容结构]
# 退出码：0=执行成功，1=执行失败
# Known Issues：[已知的边界情况]

set -e  # 遇到错误立即退出

# [脚本主体]
```

### 关键原则

1. **单一职责**：一个脚本只做一件事
2. **确定性**：相同输入必须产生相同输出
3. **独立性**：可单独在命令行执行
4. **明确的 I/O**：参数接收输入，stdout 返回结果，exit code 表示成败

## 脚本列表

新建脚本时，请在此列出：

- `fetch-youtube-videos.js` — 抓取 YouTube 视频并按语言分类输出 Excel
- `setup-finance-bitable.js` — 在飞书多维表格中创建理财计划数据表
- `setup-daily-expense-table.js` — 在飞书多维表格中创建「每日消费明细」表
- `ocr-screenshot.swift` — 使用 macOS Vision 对截图进行 OCR
- `parse-receipts.js` — 读取消费截图，OCR 识别后自动分类并同步到飞书
- `check-budget.js` — 读取当月消费数据，生成预算执行报告和预警
- `finance-bot.js` — 理财机器人，生成毒舌财务诊断报告并推送飞书卡片

### 🎩 外交大臣（西班牙语外交教练机器人）

- `diplomat-bot.js` — 核心服务（需 Claude API），提供三级表达润色、语音纠偏、场景突击
  - 用法: `node diplomat-bot.js [text|speech|memo] "用户输入"`
  - 自动检测消息类型（场景/语音/文本）
  - 支持飞书卡片推送
- `diplomat-bot-hybrid.js` — 人机协作模式（无需 API，需人工参与）
  - 用法: `node diplomat-bot-hybrid.js [text|speech|memo] "用户输入"`
  - 输出格式化 prompt，等待用户复制给 Kimi 处理
  - 配合 `diplomat-send-response.js` 使用
- `diplomat-send-response.js` — 推送 Kimi 的回复到飞书
  - 用法: `node diplomat-send-response.js [任务ID|latest]`
  - 任务 ID 从 `diplomat-bot-hybrid.js` 输出获取
- `diplomat-daily-quest.js` — 每日外交挑战推送
  - 用法: `node diplomat-daily-quest.js`
  - 适合配置 cron 定时任务（建议每天 9:00）
- `diplomat-server.js` — HTTP 服务器，接收飞书事件推送
  - 用法: `node diplomat-server.js [端口]`
  - 端点: `/feishu/webhook` 接收飞书消息，`/health` 健康检查
  - 自动检测是否有 Claude API Key，选择 AI 模式或人机协作模式
- `start-diplomat.sh` — 一键启动完整服务（HTTP 服务器 + ngrok 隧道）
  - 用法: `bash start-diplomat.sh [端口]`
  - 自动生成公网 URL 并显示飞书配置指引
- `start-diplomat-ngrok.sh` — 仅启动 ngrok 隧道
  - 用法: `bash start-diplomat-ngrok.sh [端口]`

### 🌍 三语翻译官（中西英互译）

- `translator-bot-hybrid.js` — 人机协作翻译（无需 API）
  - 用法: `node translator-bot-hybrid.js "要翻译的文本"`
  - 自动检测输入语言（中/西/英）
  - 输出格式化 prompt，复制给 Kimi 后推送飞书
- `translator-send-response.js` — 推送翻译结果到飞书
  - 用法: `node translator-send-response.js [任务ID|latest]`
- `translator-server.js` — HTTP 服务器，接收飞书消息
  - 用法: `node translator-server.js [端口]`
  - 适合云服务器部署（Railway/Render）

### 示例

- `check-deps.sh` — 检查依赖是否已安装
- `validate-input.sh` — 验证输入文件格式

## 更新日志

- [2026-03-29] 项目初始化完成
- [2026-03-29] 新增三语翻译官 Bot，支持云部署
