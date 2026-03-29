# Playbooks 目录

此目录存放所有的 Playbook（协调层文件）。

## Playbook 列表

- [youtube-video-crawler.md](./youtube-video-crawler.md) — YouTube 视频爬虫流程（antigravity A1 / Avata360）
- [spanish-diplomat-bot.md](./spanish-diplomat-bot.md) — 🎩 外交大臣：西班牙语外交教练机器人部署流程
- [deploy-to-cloud.md](./deploy-to-cloud.md) — 🌍 部署三语翻译官到云服务器（Railway/Render/阿里云）

### 示例模板

创建新文件时，参考以下结构：

```markdown
# Playbook：[任务名称]

## 目的
[简述执行完成后的预期结果]

## 前提条件
- [依赖项 1]
- [依赖项 2]

## 步骤
1. 【脚本调用】`scripts/xxx` — 说明输入输出
2. 【判断】基于条件做决策

## 判断标准
本流程线性执行，无需预定义判断标准。

## 验证
- [验证完成的方法]
```

## 更新日志

- [2026-03-29] 项目初始化完成
