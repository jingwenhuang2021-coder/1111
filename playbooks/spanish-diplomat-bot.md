# Playbook：外交大臣（西班牙语外交教练机器人）

## 目的

部署一个飞书机器人，为西语 B2 水平用户提供职场级语言训练，包括三级表达润色、语音纠偏和场景突击准备，最终消除翻译腔、缩短反应时间、提升外交得体性。

## 前提条件

- [ ] 飞书开发者后台已创建机器人，命名为"外交大臣"
- [ ] Node.js 版本 >= 18
- [ ] 已安装依赖：`axios`
- [ ] ngrok（用于内网穿透）

## 两种工作模式

### 模式一：人机协作模式（⭐ 推荐，无需 API Key）

飞书消息 → 你的电脑 → **你复制给 Kimi** → 获得回复 → 推回飞书

**优点**：无需 Claude API，完全免费，由我（Kimi）亲自处理  
**缺点**：需要你手动参与（每次消息约 10-20 秒操作）

### 模式二：全自动 AI 模式（需 Claude API Key）

飞书消息 → Claude API → 自动回复

**优点**：全自动，无需人工干预  
**缺点**：需要 Claude API Key，可能有费用

---

## 步骤：人机协作模式（模式一）

### 1. 安装 ngrok

```bash
# macOS
brew install ngrok

# 配置 authtoken（免费注册 https://dashboard.ngrok.com）
ngrok config add-authtoken YOUR_AUTHTOKEN
```

### 2. 启动服务

【脚本调用】`scripts/start-diplomat.sh` — 启动 HTTP 服务器和 ngrok 隧道

```bash
bash scripts/start-diplomat.sh
```

输出示例：
```
🎩 外交大臣服务已就绪！
═══════════════════════════════════════
🌐 公网地址: https://xxxx.ngrok-free.app
📋 飞书回调: https://xxxx.ngrok-free.app/feishu/webhook
═══════════════════════════════════════
```

### 3. 配置飞书事件订阅

1. 打开 [飞书开发者后台](https://open.feishu.cn/app)
2. 进入你的自建应用 → **事件订阅**
3. 在「请求地址」填入 ngrok 输出的飞书回调地址
4. 点击「验证」
5. 订阅 `im.message.receive_v1` 事件
6. 在「权限管理」中申请 `im:message:send`
7. 发布应用并添加到群

### 4. 人机协作工作流程

**当有人在飞书@外交大臣时：**

#### 第 1 步：你的电脑终端会显示
```
🎩 外交大臣 - 人机协作模式

✅ 已收到任务，请按以下步骤操作：

━━━━━━━━━━━━━━━━━━━━━━ 步骤 1：复制下方内容 ━━━━━━━━━━━━━━━━━━━━━━

🎩 外交大臣任务：国书润色
用户输入："Quiero pedirte un favor"
...

━━━━━━━━━━━━━━━━━━━━━━ 步骤 2：粘贴给 Kimi ━━━━━━━━━━━━━━━━━━━━━━
将上方内容粘贴给 Kimi，获取外交大臣的回复

━━━━━━━━━━━━━━━━━━━━━━ 步骤 3：推送飞书 ━━━━━━━━━━━━━━━━━━━━━━
获得回复后，运行：
node scripts/diplomat-send-response.js 1234567890
```

#### 第 2 步：复制内容发给 Kimi
把终端显示的内容复制，在 Kimi Code（就是我）这里粘贴。

#### 第 3 步：获得回复并推送
**方式 A - 手动保存文件：**
```bash
# 创建回复文件（把 Kimi 的回复粘贴进去）
echo "粘贴 Kimi 的完整回复" > .tmp/diplomat-response-[任务ID].txt

# 推送
node scripts/diplomat-send-response.js [任务ID]
```

**方式 B - 直接作为参数：**
```bash
node scripts/diplomat-send-response.js [任务ID] "Kimi 的完整回复"
```

**方式 C - 使用 latest（自动找最新任务）：**
```bash
node scripts/diplomat-send-response.js latest
```

✅ 完成！飞书用户会收到外交大臣的回复卡片。

---

## 步骤：全自动 AI 模式（模式二）

### 1. 设置 Claude API Key

```bash
export ANTHROPIC_API_KEY="sk-ant-xxxxx"
```

### 2. 启动服务

```bash
bash scripts/start-diplomat.sh
```

### 3. 配置飞书（同上）

完成！之后所有消息都会自动由 Claude API 处理，无需人工干预。

---

## 可选：每日挑战推送

【脚本调用】`scripts/diplomat-daily-quest.js`

注意：此脚本需要 `ANTHROPIC_API_KEY`，或使用人机协作方式：

```bash
# 1. 生成今日挑战（无 API Key 时会输出 prompt）
node scripts/diplomat-daily-quest.js

# 2. 把输出给 Kimi，获得回复

# 3. 手动推送（修改脚本或直接用飞书 webhook）
```

---

## 验证

### 人机协作模式

- [ ] 运行 `bash scripts/start-diplomat.sh`，看到 ngrok 公网地址
- [ ] 在飞书开发者后台成功验证事件订阅地址
- [ ] 在飞书群里@机器人，电脑终端显示任务内容
- [ ] 复制给 Kimi，获得回复后运行推送脚本
- [ ] 飞书收到外交大臣的回复卡片

### 全自动模式

- [ ] 设置 `ANTHROPIC_API_KEY`
- [ ] 启动服务并完成飞书配置
- [ ] @机器人发送西语文本，自动收到回复

---

## 故障排除

### ngrok 无法启动

```bash
# 检查 ngrok 是否安装
which ngrok

# 检查 authtoken
cat ~/.config/ngrok/ngrok.yml

# 手动测试
ngrok http 3000
```

### 飞书验证失败

- 确保 URL 包含 `https://` 和 `/feishu/webhook`
- 查看 `.tmp/server.log` 是否有错误
- 确保防火墙允许 ngrok 访问

### 消息已发送但没有回复

- 检查是否订阅了 `im.message.receive_v1` 事件
- 检查机器人是否有 `im:message:send` 权限
- 查看 `.tmp/server.log` 是否收到飞书推送

### 人机协作模式无响应

- 确保终端显示任务内容（说明 HTTP 服务器工作正常）
- 检查是否正确复制给 Kimi
- 检查推送命令的任务 ID 是否正确
