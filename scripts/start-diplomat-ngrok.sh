#!/bin/bash
# 用途：启动外交大臣 ngrok 隧道
# 参数：$1=本地端口（默认 3000）
# 输出：ngrok 公网 URL
# 退出码：0=启动成功，1=启动失败

set -e

PORT=${1:-3000}

echo "🎩 外交大臣内网穿透启动器"
echo "═══════════════════════════════════════"

# 检查 ngrok
check_ngrok() {
  if command -v ngrok &> /dev/null; then
    echo "✅ ngrok 已安装"
    return 0
  fi
  
  if [ -f "$HOME/.ngrok/bin/ngrok" ]; then
    echo "✅ ngrok 已安装（本地）"
    export PATH="$HOME/.ngrok/bin:$PATH"
    return 0
  fi
  
  echo "❌ ngrok 未安装"
  echo ""
  echo "安装方式："
  echo "1. 官网下载: https://ngrok.com/download"
  echo "2. 或使用 Homebrew: brew install ngrok"
  echo "3. 或使用 npm: npm install -g ngrok"
  echo ""
  echo "安装后需要配置 authtoken:"
  echo "ngrok config add-authtoken YOUR_TOKEN"
  return 1
}

# 检查 authtoken
check_authtoken() {
  if [ -f "$HOME/.config/ngrok/ngrok.yml" ] || [ -f "$HOME/.ngrok2/ngrok.yml" ]; then
    echo "✅ ngrok 配置已存在"
    return 0
  fi
  
  echo "⚠️ ngrok authtoken 未配置"
  echo ""
  echo "请执行:"
  echo "ngrok config add-authtoken YOUR_AUTHTOKEN"
  echo ""
  echo "获取 token: https://dashboard.ngrok.com/get-started/your-authtoken"
  return 1
}

# 启动 ngrok
start_ngrok() {
  echo ""
  echo "🚀 正在启动 ngrok 隧道..."
  echo "   本地端口: $PORT"
  echo ""
  
  # 检查端口是否被占用
  if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null 2>&1; then
    echo "⚠️ 端口 $PORT 已被占用，请先关闭占用该端口的程序"
    exit 1
  fi
  
  # 在后台启动 ngrok 并捕获输出
  ngrok http $PORT --log=stdout > .tmp/ngrok.log 2>&1 &
  NGROK_PID=$!
  
  # 保存 PID
  echo $NGROK_PID > .tmp/ngrok.pid
  
  # 等待 ngrok 启动
  echo "⏳ 等待 ngrok 启动..."
  sleep 3
  
  # 获取公网 URL
  for i in {1..10}; do
    NGROK_URL=$(curl -s http://localhost:4040/api/tunnels | grep -o '"public_url":"https://[^"]*' | grep "https://" | head -1 | sed 's/"public_url":"//')
    
    if [ ! -z "$NGROK_URL" ]; then
      echo ""
      echo "✅ ngrok 隧道已建立！"
      echo "═══════════════════════════════════════"
      echo "🌐 公网地址: $NGROK_URL"
      echo "📋 飞书回调: $NGURG_URL/feishu/webhook"
      echo "═══════════════════════════════════════"
      echo ""
      echo "👉 复制上方飞书回调地址，配置到飞书后台："
      echo "   事件订阅 → 请求地址"
      echo ""
      echo "按 Ctrl+C 停止 ngrok"
      
      # 等待 ngrok 进程
      wait $NGROK_PID
      return 0
    fi
    
    sleep 1
  done
  
  echo "❌ 获取 ngrok URL 失败，查看日志: .tmp/ngrok.log"
  kill $NGROK_PID 2>/dev/null || true
  return 1
}

# 清理函数
cleanup() {
  echo ""
  echo "👋 正在关闭 ngrok..."
  if [ -f .tmp/ngrok.pid ]; then
    kill $(cat .tmp/ngrok.pid) 2>/dev/null || true
    rm -f .tmp/ngrok.pid
  fi
  exit 0
}

trap cleanup SIGINT SIGTERM

# 主流程
mkdir -p .tmp
check_ngrok
check_authtoken
start_ngrok
