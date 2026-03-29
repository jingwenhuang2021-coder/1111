# Playbook：部署三语翻译官到云服务器

## 目的

将三语翻译官部署到云服务器，实现 24 小时在线，飞书@自动回复，无需本地电脑开机。

## 前提条件

- [ ] GitHub 账号
- [ ] 代码已推送到 GitHub 仓库
- [ ] 飞书机器人已创建

## 推荐平台

| 平台 | 免费额度 | 国内访问 | 难度 | 推荐度 |
|------|---------|---------|------|--------|
| **Railway** | $5/月 | 一般 | ⭐ 最简单 | ⭐⭐⭐ |
| **Render** | 750小时/月 | 一般 | ⭐⭐ 简单 | ⭐⭐⭐ |
| **阿里云/腾讯云** | 新用户免费 | 快 | ⭐⭐⭐⭐ 复杂 | ⭐⭐ |

**推荐 Railway**（一键部署，自动 HTTPS，免费额度够用）

---

## 方案 A：Railway 部署（推荐）

### 步骤 1：准备代码

确保代码已推送到 GitHub：

```bash
# 在 project-playbook 目录
git init
git add .
git commit -m "Initial commit: Spanish diplomat bot"
git branch -M main

# 创建 GitHub 仓库并推送
git remote add origin https://github.com/YOUR_USERNAME/spanish-translator-bot.git
git push -u origin main
```

### 步骤 2：创建 Railway 项目

1. 访问 https://railway.app
2. 用 GitHub 账号登录
3. 点击 "New Project"
4. 选择 "Deploy from GitHub repo"
5. 选择你的仓库

### 步骤 3：配置环境变量

在 Railway 项目 → Variables 中添加：

```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/1740c4ae-c0a9-4f36-8b4d-992f71b1c110
PORT=3000
```

### 步骤 4：部署

Railway 会自动检测 Dockerfile 并部署。

等待部署完成，会生成一个类似 `https://spanish-translator-bot.up.railway.app` 的域名。

### 步骤 5：配置飞书

1. 打开飞书开发者后台
2. 进入你的机器人应用 → 事件订阅
3. 请求地址填入：`https://your-app.up.railway.app/feishu/webhook`
4. 点击验证
5. 添加事件：`im.message.receive_v1`
6. 保存

### 步骤 6：测试

在飞书群里 @机器人发送：`我想请你帮个忙`

你的 Railway 项目 Logs 会显示收到消息，并输出处理步骤。

**注意**：Railway 免费版容器会休眠，首次请求可能需要 10-30 秒唤醒。

---

## 方案 B：Render 部署

### 步骤 1：创建 Render 账号

访问 https://render.com 用 GitHub 登录

### 步骤 2：创建 Web Service

1. 点击 "New +" → "Web Service"
2. 选择你的 GitHub 仓库
3. 配置：
   - **Name**: spanish-translator-bot
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
4. 点击 "Create Web Service"

### 步骤 3：配置环境变量

在 Render 面板 → Environment 中添加：

```
FEISHU_WEBHOOK_URL=https://open.feishu.cn/open-apis/bot/v2/hook/1740c4c0a9-4f36-8b4d-992f71b1c110
```

### 步骤 4：获取域名并配置飞书

Render 会分配类似 `https://spanish-translator-bot.onrender.com` 的域名。

在飞书事件订阅中填入：`https://xxx.onrender.com/feishu/webhook`

---

## 方案 C：国内云服务器（阿里云/腾讯云）

适合需要**国内快速访问**的场景。

### 步骤 1：购买服务器

- 阿里云/腾讯云新用户有免费试用
- 选择：轻量应用服务器，2核2G，Node.js 镜像

### 步骤 2：部署代码

```bash
# SSH 连接到服务器
git clone https://github.com/YOUR_USERNAME/spanish-translator-bot.git
cd spanish-translator-bot
npm install

# 使用 PM2 启动（后台运行）
npm install -g pm2
pm2 start scripts/translator-server.js --name translator-bot
pm2 save
pm2 startup
```

### 步骤 3：配置 Nginx（可选）

如果需要域名+HTTPS：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
}
```

### 步骤 4：配置飞书

使用服务器 IP 或域名配置飞书事件订阅。

---

## 验证

- [ ] 云服务器显示 "Running" 状态
- [ ] 飞书事件订阅验证通过
- [ ] 在飞书群@机器人，收到回复
- [ ] 关闭本地电脑后，仍能收到回复

## 故障排除

### Railway 部署失败

查看 Deploy Logs，常见问题：
- 缺少 package.json
- Node 版本不兼容（确保 engines.node >= 18）
- 端口未监听（确保 process.env.PORT）

### 飞书验证失败

- 检查 URL 是否完整（包含 https://）
- 检查路径是否正确（/feishu/webhook）
- 查看云服务器 Logs 是否有请求记录

### 收到消息但无回复

检查环境变量 `FEISHU_WEBHOOK_URL` 是否配置正确。

---

## 成本参考

| 平台 | 免费额度 | 超出后费用 |
|------|---------|-----------|
| Railway | $5/月 | $5/月起步 |
| Render | 750小时/月 | $7/月起 |
| 阿里云 | 新用户1年免费 | ~¥50/月 |

对于个人使用，免费额度通常够用。
