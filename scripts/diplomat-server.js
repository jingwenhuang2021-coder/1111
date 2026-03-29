#!/usr/bin/env node
// 用途：外交大臣 - HTTP 服务器，接收飞书事件推送并回复
// 参数：$1=端口（默认 3000）
// 输出：本地 HTTP 服务，接收飞书事件推送
// 退出码：0=正常退出，1=启动失败
// Known Issues：飞书事件推送可能需要 1-2 秒处理时间；消息去重依赖 message_id

import http from 'http';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

const PORT = process.argv[2] || 3000;

// 简单的消息去重缓存（保留最近 100 条 message_id）
const processedMessages = new Set();
const MAX_CACHE_SIZE = 100;

// 清理过期消息缓存
function addProcessedMessage(messageId) {
  if (processedMessages.size >= MAX_CACHE_SIZE) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }
  processedMessages.add(messageId);
}

// 解析请求体
function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        resolve(JSON.parse(body));
      } catch (e) {
        resolve({});
      }
    });
    req.on('error', reject);
  });
}

// 调用 diplomat-bot 处理消息
async function processMessage(userInput) {
  // 检测是否有 Claude API Key，有则用 AI 模式，否则用人机协作模式
  const hasClaudeKey = !!process.env.ANTHROPIC_API_KEY;
  const botScript = hasClaudeKey ? 'diplomat-bot.js' : 'diplomat-bot-hybrid.js';
  
  return new Promise((resolve, reject) => {
    const botPath = path.join(process.cwd(), 'scripts', botScript);
    const child = spawn('node', [botPath, 'text', userInput], {
      env: process.env,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let output = '';
    let error = '';

    child.stdout.on('data', (data) => {
      output += data.toString();
    });

    child.stderr.on('data', (data) => {
      error += data.toString();
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve(output);
      } else {
        reject(new Error(error || 'Bot process failed'));
      }
    });
  });
}

// 创建 HTTP 服务器
const server = http.createServer(async (req, res) => {
  // 设置 CORS 头
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://localhost:${PORT}`);

  // 健康检查
  if (url.pathname === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }));
    return;
  }

  // 飞书事件回调
  if (url.pathname === '/feishu/webhook') {
    const body = await parseBody(req);

    // URL 验证（飞书首次配置时需要）
    if (body.challenge) {
      console.log('🔔 收到飞书 URL 验证请求');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ challenge: body.challenge }));
      return;
    }

    // 处理消息事件
    if (body.event && body.event.message) {
      const message = body.event.message;
      const messageId = message.message_id;

      // 去重检查
      if (processedMessages.has(messageId)) {
        res.writeHead(200);
        res.end('{"status":"duplicate"}');
        return;
      }
      addProcessedMessage(messageId);

      // 只处理文本消息
      if (message.message_type === 'text') {
        try {
          const content = JSON.parse(message.content);
          const userInput = content.text || '';

          console.log(`📩 收到消息: ${userInput.slice(0, 50)}...`);

          // 异步处理消息（不阻塞响应）
          processMessage(userInput).then(result => {
            console.log('✅ 消息处理完成，已推送飞书卡片');
          }).catch(err => {
            console.error('❌ 消息处理失败:', err.message);
          });
        } catch (e) {
          console.error('解析消息内容失败:', e.message);
        }
      }

      // 立即返回成功响应（飞书要求 3 秒内响应）
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(200);
    res.end('{"status":"ignored"}');
    return;
  }

  // 404
  res.writeHead(404);
  res.end('Not Found');
});

// 启动服务器
server.listen(PORT, () => {
  console.log('');
  console.log('🎩 外交大臣 HTTP 服务器已启动');
  console.log('═══════════════════════════════════════');
  console.log(`本地地址: http://localhost:${PORT}`);
  console.log(`健康检查: http://localhost:${PORT}/health`);
  console.log(`飞书回调: http://localhost:${PORT}/feishu/webhook`);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('下一步：');
  console.log('1. 运行: npx ngrok http ' + PORT);
  console.log('2. 将 https URL 配置到飞书事件订阅');
  console.log('');
});

// 优雅退出
process.on('SIGINT', () => {
  console.log('\n\n👋 外交大臣服务器已关闭');
  server.close(() => {
    process.exit(0);
  });
});
