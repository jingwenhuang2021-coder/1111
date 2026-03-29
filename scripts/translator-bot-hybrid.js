#!/usr/bin/env node
// 用途：三语翻译官 - 中西英互译（人机协作模式）
// 参数：$1=用户输入的任意语言文本
// 输出：格式化 prompt，保存到 .tmp/ 供 Kimi 处理
// 特点：自动检测输入语言，输出三语对照

import * as fs from 'fs';
import * as path from 'path';

const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/1740c4ae-c0a9-4f36-8b4d-992f71b1c110';

const TMP_DIR = path.join(process.cwd(), '.tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// 检测输入语言（简化版）
function detectLanguage(text) {
  if (/[\u4e00-\u9fa5]/.test(text)) return '中文';
  if (/[áéíóúüñ¿¡]/i.test(text)) return '西语';
  return '英语';
}

// 生成三语翻译 prompt
function generateTranslatePrompt(userInput) {
  const sourceLang = detectLanguage(userInput);
  
  return `🌍 三语翻译官任务

原文（${sourceLang}）："""${userInput}"""

请提供以下三语对照翻译：

━━━━━━━━━━━━━━━━━━━━━━
🇨🇳 中文
━━━━━━━━━━━━━━━━━━━━━━
[准确、地道的中文表达]

━━━━━━━━━━━━━━━━━━━━━━
🇪🇸 西语 (Español)
━━━━━━━━━━━━━━━━━━━━━━
[准确、地道的西班牙语表达]
• 标注关键语法点
• 标注正式/口语场合的使用建议

━━━━━━━━━━━━━━━━━━━━━━
🇬🇧 英语 (English)
━━━━━━━━━━━━━━━━━━━━━━
[准确、地道的英语表达]

━━━━━━━━━━━━━━━━━━━━━━
💡 语言小贴士
━━━━━━━━━━━━━━━━━━━━━━
• 三种语言在这个表达上的文化差异
• 使用场景建议（正式 vs 口语）`;
}

// ============ 主函数 ============
function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.error('用法: node translator-bot-hybrid.js "要翻译的文本"');
    process.exit(1);
  }

  const userInput = args.join(' ');
  const sourceLang = detectLanguage(userInput);

  const prompt = generateTranslatePrompt(userInput);

  // 保存任务
  const timestamp = Date.now();
  const requestFile = path.join(TMP_DIR, `translate-request-${timestamp}.txt`);
  const metaFile = path.join(TMP_DIR, `translate-meta-${timestamp}.json`);
  
  fs.writeFileSync(requestFile, prompt, 'utf8');
  fs.writeFileSync(metaFile, JSON.stringify({
    type: 'translate',
    originalInput: userInput,
    sourceLang: sourceLang,
    timestamp: timestamp,
    webhook: FEISHU_WEBHOOK
  }), 'utf8');

  // 输出提示
  console.log('');
  console.log('🌍 三语翻译官 - 人机协作模式');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log(`检测到输入语言：${sourceLang}`);
  console.log('');
  console.log('✅ 已收到任务，请按以下步骤操作：');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━ 步骤 1：复制下方内容 ━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(prompt);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━ 步骤 2：粘贴给 Kimi ━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('将上方内容粘贴给 Kimi，获取三语翻译');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━ 步骤 3：推送飞书 ━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`获得回复后，运行：`);
  console.log(`node scripts/translator-send-response.js ${timestamp}`);
  console.log('');
  console.log('或者使用：node scripts/translator-send-response.js latest');
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`任务 ID: ${timestamp}`);
  console.log('═══════════════════════════════════════');
  
  process.exit(0);
}

main();
