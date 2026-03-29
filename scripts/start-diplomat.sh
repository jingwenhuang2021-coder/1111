#!/bin/bash
# 用途：一键启动外交大臣完整服务（HTTP 服务器 + ngrok 隧道）
# 参数：$1=端口（默认 3000）
# 输出：启动日志和公网地址
# 退出码：0=正常退出，1=启动失败

set -e

PORT=${1:-3000}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "🎩 外交大臣 - 完整服务启动"
echo "═══════════════════════════════════════"

# 检查环境变量
if [ -z "$ANTHROPIC_API_KEY" ]; then
  echo "⚠️ 警告：未设置 ANTHROPIC_API_KEY"
  echo "外交大臣将使用离线模式（简化回复）"
  echo "如需 AI 润色，请设置: export ANTHROPIC_API_KEY=your_key"
  echo ""
fi

# 清理函数
cleanup() {
  echo ""
  echo "👋 正在关闭服务..."
  
  # 关闭 HTTP 服务器
  if [ -f .tmp/diplomat-server.pid ]; then
    kill $(cat .tmp/diplomat-server.pid) 2>/dev/null || true
    rm -f .tmp/diplomat-server.pid
    echo "   HTTP 服务器已关闭"
  fi
  
  # 关闭 ngrok
  if [ -f .tmp/ngrok.pid ]; then
    kill $(cat .tmp/ngrok.pid) 2>/dev/null || true
    rm -f .tmp/ngrok.pid
    echo "   ngrok 隧道已关闭"
  fi
  
  echo "✅ 外交大臣已退朝"
  exit 0
}

trap cleanup SIGINT SIGTERM

# 启动 HTTP 服务器
echo "🚀 启动 HTTP 服务器（端口: $PORT）..."
node scripts/diplomat-server.js $PORT > .tmp/server.log 2>&1 &
SERVER_PID=$!
echo $SERVER_PID > .tmp/diplomat-server.pid

# 等待服务器启动
sleep 2

# 检查服务器是否成功启动
if ! kill -0 $SERVER_PID 2>/dev/null; then
  echo "❌ HTTP 服务器启动失败，查看日志: .tmp/server.log"
  exit 1
fi

echo "✅ HTTP 服务器已启动"

# 检查 ngrok
if ! command -v ngrok &> /dev/null && [ ! -f "$HOME/.ngrok/bin/ngrok" ]; then
  echo ""
  echo "⚠️ ngrok 未安装，仅启动本地服务"
  echo ""
  echo "内网穿透安装方式:"
  echo "   brew install ngrok"
  echo "   ngrok config add-authtoken YOUR_TOKEN"
  echo ""
  echo "本地服务地址: http://localhost:$PORT"
  echo ""
  echo "按 Ctrl+C 停止服务"
  wait $SERVER_PID
  exit 0
fi

# 启动 ngrok
if command -v ngrok &> /dev/null; then
  NGROK_CMD="ngrok"
else
  NGROK_CMD="$HOME/.ngrok/bin/ngrok"
fi

echo "🌐 启动 ngrok 隧道..."
$NGROK_CMD http $PORT --log=stdout > .tmp/ngrok.log 2>&1 &
NGROK_PID=$!
echo $NGROK_PID > .tmp/ngrok.pid

# 等待 ngrok 启动
sleep 4

# 获取 ngrok URL
for i in {1..15}; do
  NGROK_URL=$(curl -s http://localhost:4040/api/tunnels 2>/dev/null | grep -o '"public_url":"https://[^"]*' | grep "https://" | head -1 | sed 's/"public_url":"//') || true
  
  if [ ! -z "$NGROK_URL" ]; then
    echo ""
    echo "═══════════════════════════════════════"
    echo "✅ 外交大臣服务已就绪！"
    echo "═══════════════════════════════════════"
    echo ""
    echo "🌐 公网地址: $NGROK_URL"
    echo "📋 飞书回调: $NGROK_URL/feishu/webhook"
    echo ""
    echo "═══════════════════════════════════════"
    echo "配置步骤："
    echo "1. 打开飞书开发者后台"
    echo "2. 进入你的自建应用 → 事件订阅"
    echo "3. 在「请求地址」填入:"
    echo "   $NGROK_URL/feishu/webhook"
    echo "4. 点击「验证」并保存"
    echo "5. 订阅「消息与群组 → 接收消息」事件"
    echo "═══════════════════════════════════════"
    echo ""
    echo "按 Ctrl+C 停止服务"
    break
  fi
  
  sleep 1
done

if [ -z "$NGROK_URL" ]; then
  echo "⚠️ 未能获取 ngrok URL，查看日志: .tmp/ngrok.log"
fi

# 保持运行
wait
