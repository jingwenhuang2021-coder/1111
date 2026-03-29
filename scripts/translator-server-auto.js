#!/usr/bin/env node
// 用途：三语翻译官 - 全自动版（免费翻译 API，无需 Key）

import http from 'http';
import axios from 'axios';

const PORT = process.env.PORT || 3000;
const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/1740c4ae-c0a9-4f36-8b4d-992f71b1c110';

// MyMemory 免费翻译 API（无需 Key，每日限制 50 次/小时）
async function translateMyMemory(text, from, to) {
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${from}|${to}`;
    const res = await axios.get(url, { timeout: 10000 });
    if (res.data.responseStatus === 200) {
      return res.data.responseData.translatedText;
    }
    throw new Error(res.data.responseDetails);
  } catch (e) {
    // 备用：直接返回原文+提示
    return `[翻译失败: ${from}->${to}]`;
  }
}

// 检测语言
function detectLang(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return 'zh';
  if (/[áéíóúüñ¿¡]/i.test(text)) return 'es';
  return 'en';
}

// 翻译主函数
async function doTranslate(text) {
  const source = detectLang(text);
  let zh = '', es = '', en = '';
  
  if (source === 'zh') {
    zh = text;
    [es, en] = await Promise.all([
      translateMyMemory(text, 'zh-CN', 'es'),
      translateMyMemory(text, 'zh-CN', 'en')
    ]);
  } else if (source === 'es') {
    es = text;
    [zh, en] = await Promise.all([
      translateMyMemory(text, 'es', 'zh'),
      translateMyMemory(text, 'es', 'en')
    ]);
  } else {
    en = text;
    [zh, es] = await Promise.all([
      translateMyMemory(text, 'en', 'zh'),
      translateMyMemory(text, 'en', 'es')
    ]);
  }
  
  return { zh, es, en, source };
}

// 推送到飞书
async function sendToFeishu(result, original) {
  const content = `🌍 **三语翻译**

📝 **原文**: ${original}

🇨🇳 **中文**: ${result.zh}
🇪🇸 **西语**: ${result.es}
🇬🇧 **英语**: ${result.en}

---
💡 提示：${result.source === 'zh' ? '中→西/英' : result.source === 'es' ? '西→中/英' : '英→中/西'}`;

  const card = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: '🌍 三语翻译官' },
        template: 'green'
      },
      elements: [
        { tag: 'div', text: { tag: 'lark_md', content: content } }
      ]
    }
  };

  try {
    await axios.post(FEISHU_WEBHOOK, card);
    console.log('✅ 已推送到飞书');
  } catch (e) {
    console.error('❌ 推送失败:', e.message);
  }
}

// HTTP 服务器
const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // 健康检查
  if (req.url === '/' || req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ status: 'ok', service: 'translator-auto' }));
    return;
  }

  // 飞书 webhook
  if (req.url === '/feishu/webhook') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', async () => {
      try {
        const data = JSON.parse(body);
        
        // URL 验证
        if (data.challenge) {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ challenge: data.challenge }));
          return;
        }

        // 处理消息
        if (data.event?.message?.message_type === 'text') {
          const content = JSON.parse(data.event.message.content);
          const text = content.text?.replace(/@_user_\d+/g, '').trim();
          
          if (text) {
            console.log('📩 翻译:', text);
            const result = await doTranslate(text);
            await sendToFeishu(result, text);
          }
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'ok' }));
      } catch (e) {
        console.error('Error:', e.message);
        res.writeHead(200);
        res.end('{"status":"error"}');
      }
    });
    return;
  }

  res.writeHead(404);
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🌍 三语翻译官已启动，端口: ${PORT}`);
});
