#!/usr/bin/env node
// 用途：外交大臣 - 人机协作模式（无 Claude API，使用 Kimi Code）
// 参数：$1=消息类型(text/speech/memo), $2=用户输入
// 输出：stdout 显示格式化 prompt，保存到 .tmp/ 供 Kimi 处理
// 退出码：0=准备完成，1=失败
// Known Issues：需要用户手动复制输出给 Kimi，再运行推送脚本

import * as fs from 'fs';
import * as path from 'path';

const FEISHU_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/1740c4ae-c0a9-4f36-8b4d-992f71b1c110';

// 确保 .tmp 目录存在
const TMP_DIR = path.join(process.cwd(), '.tmp');
if (!fs.existsSync(TMP_DIR)) {
  fs.mkdirSync(TMP_DIR, { recursive: true });
}

// ============ 生成 Prompt ============
function generatePolishPrompt(userInput) {
  return `🎩 外交大臣任务：国书润色

用户输入："""${userInput}"""

请作为外交大臣，给出以下三个版本的润色：

━━━━━━━━━━━━━━━━━━━━━━
📜 [Versión Estándar] 标准版
━━━━━━━━━━━━━━━━━━━━━━
[语法完全正确、清晰的 B2+ 表达]

━━━━━━━━━━━━━━━━━━━━━━
🎩 [Versión Diplomática] 外交版
━━━━━━━━━━━━━━━━━━━━━━
[职场高阶版。多用虚拟式（Subjuntivo）和委婉语]

━━━━━━━━━━━━━━━━━━━━━━
😎 [Versión Nativa/Cool] 地道版
━━━━━━━━━━━━━━━━━━━━━━
[地道口语版。使用母语者常用的成语或动词短语]

━━━━━━━━━━━━━━━━━━━━━━
💡 外交小贴士
━━━━━━━━━━━━━━━━━━━━━━
[说明为什么要这么改，以及在西班牙/拉美不同地区的得体性差异]`;
}

function generateSpeechPrompt(userInput) {
  return `🎩 外交大臣任务：御前模拟演练

用户语音输入："""${userInput}"""

请作为同传教练，进行专业分析：

━━━━━━━━━━━━━━━━━━━━━━
🎯 识别与转录修正
━━━━━━━━━━━━━━━━━━━━━━
[修正语音识别导致的拼写或语法错误]

━━━━━━━━━━━━━━━━━━━━━━
🔍 流畅度审计
━━━━━━━━━━━━━━━━━━━━━━
[识别表达中的"卡顿感"或"逻辑断层"]

━━━━━━━━━━━━━━━━━━━━━━
⚡ 瞬间提速：3个万能转场句
━━━━━━━━━━━━━━━━━━━━━━
[给出3个适合此类话题的连接器/过渡句]

━━━━━━━━━━━━━━━━━━━━━━
🗣️ 朗读建议
━━━━━━━━━━━━━━━━━━━━━━
[标注哪些单词的重音或连读会导致歧义]`;
}

function generateMemoPrompt(userInput) {
  const scenario = userInput.replace(/^场景[：:]\s*/i, '').trim();
  return `🎩 外交大臣任务：同传小抄

场景：${scenario}

请生成一份"外交备忘录"：

━━━━━━━━━━━━━━━━━━━━━━
🎯 核心动词包（5个）
━━━━━━━━━━━━━━━━━━━━━━
[该场景最高频、最显专业的动词及例句]

━━━━━━━━━━━━━━━━━━━━━━
🎩 外交辞令（3句）
━━━━━━━━━━━━━━━━━━━━━━
[既能表达歉意又能维持尊严的句子]

━━━━━━━━━━━━━━━━━━━━━━
🛡️ 防尴尬盾牌（2句）
━━━━━━━━━━━━━━━━━━━━━━
[想不起来词时，争取思考时间的地道表达]`;
}

// ============ 主函数 ============
function main() {
  const args = process.argv.slice(2);
  
  let messageType = 'text';
  let userInput = '';
  
  if (args.length >= 2) {
    messageType = args[0];
    userInput = args[1];
  } else if (args.length === 1) {
    userInput = args[0];
    if (userInput.startsWith('场景') || userInput.startsWith('场景:') || userInput.startsWith('场景：')) {
      messageType = 'memo';
    } else if (looksLikeVoiceTranscript(userInput)) {
      messageType = 'speech';
    }
  } else {
    console.error('用法: node diplomat-bot-hybrid.js [text|speech|memo] "用户输入"');
    process.exit(1);
  }

  // 生成 prompt
  let prompt;
  switch (messageType) {
    case 'memo': prompt = generateMemoPrompt(userInput); break;
    case 'speech': prompt = generateSpeechPrompt(userInput); break;
    default: prompt = generatePolishPrompt(userInput);
  }

  // 保存到文件
  const timestamp = Date.now();
  const requestFile = path.join(TMP_DIR, `diplomat-request-${timestamp}.txt`);
  const metaFile = path.join(TMP_DIR, `diplomat-meta-${timestamp}.json`);
  
  fs.writeFileSync(requestFile, prompt, 'utf8');
  fs.writeFileSync(metaFile, JSON.stringify({
    type: messageType,
    originalInput: userInput,
    timestamp: timestamp,
    webhook: FEISHU_WEBHOOK
  }), 'utf8');

  // 输出提示
  console.log('');
  console.log('🎩 外交大臣 - 人机协作模式');
  console.log('═══════════════════════════════════════');
  console.log('');
  console.log('✅ 已收到任务，请按以下步骤操作：');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━ 步骤 1：复制下方内容 ━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(prompt);
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━ 步骤 2：粘贴给 Kimi ━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log('将上方内容粘贴给 Kimi，获取外交大臣的回复');
  console.log('');
  console.log('━━━━━━━━━━━━━━━━━━━━━━ 步骤 3：推送飞书 ━━━━━━━━━━━━━━━━━━━━━━');
  console.log('');
  console.log(`获得回复后，运行：`);
  console.log(`node scripts/diplomat-send-response.js ${timestamp}`);
  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(`任务 ID: ${timestamp}`);
  console.log('═══════════════════════════════════════');
  
  process.exit(0);
}

function looksLikeVoiceTranscript(text) {
  const voicePatterns = [
    /[嗯啊哦呃]/, /\.{3,}/, /那个|这个|就是/, /[,.]\s*[,.]/, /\s{2,}/
  ];
  return voicePatterns.some(pattern => pattern.test(text));
}

main();
