#!/usr/bin/env node
// 用途：三语翻译官 HTTP 服务器 - 接收飞书消息

import http from 'http';
import { spawn } from 'child_process';
import * as path from 'path';

const PORT = process.env.PORT || 3000;

console.log('Starting server...');
console.log('PORT:', PORT);

const processedMessages = new Set();

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try { resolve(JSON.parse(body)); } 
      catch (e) { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

const server = http.createServer(async (req, res) => {
  console.log(`${req.method} ${req.url}`);
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 根路径 - 健康检查
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      service: 'translator-bot',
      timestamp: new Date().toISOString() 
    }));
    return;
  }

  // 飞书 webhook
  if (req.url === '/feishu/webhook') {
    const body = await parseBody(req);

    if (body.challenge) {
      console.log('Challenge received:', body.challenge);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ challenge: body.challenge }));
      return;
    }

    if (body.event?.message) {
      const msg = body.event.message;
      
      if (processedMessages.has(msg.message_id)) {
        res.writeHead(200);
        res.end('{"status":"duplicate"}');
        return;
      }
      processedMessages.add(msg.message_id);

      if (msg.message_type === 'text') {
        try {
          const content = JSON.parse(msg.content);
          const text = content.text?.trim() || '';
          const cleanText = text.replace(/@_user_\d+/g, '').trim();
          
          if (cleanText) {
            console.log('');
            console.log('═══════════════════════════════════════');
            console.log(`📩 新消息: ${cleanText}`);
            console.log('═══════════════════════════════════════');
            
            // 调用翻译脚本
            const botPath = path.join(process.cwd(), 'scripts', 'translator-bot-hybrid.js');
            const child = spawn('node', [botPath, cleanText], {
              env: process.env,
              stdio: 'inherit'
            });
            
            child.on('error', (err) => {
              console.error('Spawn error:', err);
            });
          }
        } catch (e) {
          console.error('Parse error:', e.message);
        }
      }

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

server.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('🌍 三语翻译官 HTTP 服务器已启动');
  console.log('═══════════════════════════════════════');
  console.log(`Port: ${PORT}`);
  console.log(`Health: http://0.0.0.0:${PORT}/health`);
  console.log(`Webhook: http://0.0.0.0:${PORT}/feishu/webhook`);
  console.log('═══════════════════════════════════════');
});

server.on('error', (err) => {
  console.error('Server error:', err);
});
