#!/usr/bin/env node
// 用途：三语翻译官 HTTP 服务器 - 接收飞书消息，触发人机协作流程
// 参数：$1=端口（默认 3000）

import http from 'http';
import { spawn } from 'child_process';
import * as path from 'path';

const PORT = process.env.PORT || process.argv[2] || 3000;

// 简单的消息去重
const processedMessages = new Set();
const MAX_CACHE = 100;

function addProcessed(id) {
  if (processedMessages.size >= MAX_CACHE) {
    const first = processedMessages.values().next().value;
    processedMessages.delete(first);
  }
  processedMessages.add(id);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } 
      catch (e) { resolve({}); }
    });
    req.on('error', reject);
  });
}

// 处理消息（调用 translator-bot-hybrid.js）
async function processMessage(userInput) {
  return new Promise((resolve, reject) => {
    const botPath = path.join(process.cwd(), 'scripts', 'translator-bot-hybrid.js');
    const child = spawn('node', [botPath, userInput], {
      env: process.env,
      stdio: 'inherit'  // 直接输出到当前终端
    });

    child.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error('Bot failed'));
    });
  });
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
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

    // URL 验证
    if (body.challenge) {
      console.log('🔔 飞书 URL 验证');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ challenge: body.challenge }));
      return;
    }

    // 处理消息
    if (body.event?.message) {
      const msg = body.event.message;
      
      // 去重
      if (processedMessages.has(msg.message_id)) {
        res.writeHead(200);
        res.end('{"status":"duplicate"}');
        return;
      }
      addProcessed(msg.message_id);

      if (msg.message_type === 'text') {
        try {
          const content = JSON.parse(msg.content);
          const text = content.text?.trim() || '';
          
          // 去掉 @机器人的部分
          const cleanText = text.replace(/@_user_\d+/g, '').trim();
          
          if (cleanText) {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log(`📩 新消息: ${cleanText.slice(0, 50)}...`);
            console.log('═══════════════════════════════════════');
            
            // 异步处理（不阻塞响应）
            processMessage(cleanText).catch(console.error);
          }
        } catch (e) {
          console.error('解析消息失败:', e.message);
        }
      }

      // 立即响应飞书
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok' }));
      return;
    }

    res.writeHead(200);
    res.end('{"status":"ignored"}');
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, () => {
  console.log('');
  console.log('🌍 三语翻译官 HTTP 服务器已启动');
  console.log('═══════════════════════════════════════');
  console.log(`本地地址: http://localhost:${PORT}`);
  console.log(`飞书回调: http://localhost:${PORT}/feishu/webhook`);
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('💡 使用流程：');
  console.log('1. 配置 ngrok: npx ngrok http ' + PORT);
  console.log('2. 将 https URL 配置到飞书事件订阅');
  console.log('3. @机器人发送消息');
  console.log('4. 按终端提示操作（复制给 Kimi → 推送）');
  console.log('');
});

process.on('SIGINT', () => {
  console.log('\n\n👋 服务器已关闭');
  server.close(() => process.exit(0));
});
