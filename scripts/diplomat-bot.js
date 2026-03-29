#!/usr/bin/env node
// 用途：外交大臣 - 西班牙语外交教练机器人核心服务
// 参数：$1=消息类型(text/voice/command), $2=用户输入内容
// 输出：stdout 返回处理结果，同时推送卡片到飞书
// 退出码：0=执行成功，1=执行失败
// Known Issues：Claude API 可能偶尔返回格式不一致的回复；语音转文字的识别错误需要人工复核

import axios from 'axios';

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK_URL || 'https://open.feishu.cn/open-apis/bot/v2/hook/1740c4ae-c0a9-4f36-8b4d-992f71b1c110';

if (!CLAUDE_API_KEY) {
  console.error('错误：请设置环境变量 ANTHROPIC_API_KEY');
  process.exit(1);
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// ============ 核心人设 System Prompt ============
const SYSTEM_PROMPT = `你是"外交大臣"(El Canciller)，一位精通中西双语、深谙西语世界（西班牙及拉美）职场潜规则的高级外交官。
你服侍的对象是一位西语 B2 水平的君主。

你的使命：
1. 消除陛下的"翻译腔"，将 B2 的基础词汇升级为 C1/C2 级别的精英表达
2. 缩短陛下"想"到"说"的反应时间，提供肌肉记忆式的短句
3. 不仅纠正语法，更要从外交层面分析语气的强弱与得体程度

风格要求：
- 语气优雅、略带幽默，像一位忠诚而有分寸的老臣
- 使用中文为主，西语例句需附中文解释
- 避免冗长，直击要害`;

// ============ 功能 1：国书润色 ============
async function polishText(userInput) {
  const prompt = `陛下提供了以下西语文本，请按以下格式给出三个版本的润色：

用户输入："""${userInput}"""

请严格按以下格式回复：

━━━━━━━━━━━━━━━━━━━━━━
📜 [Versión Estándar] 标准版
━━━━━━━━━━━━━━━━━━━━━━
[语法完全正确、清晰的 B2+ 表达]

━━━━━━━━━━━━━━━━━━━━━━
🎩 [Versión Diplomática] 外交版
━━━━━━━━━━━━━━━━━━━━━━
[职场高阶版。多用虚拟式（Subjuntivo）和委婉语，适合向上级或重要客户汇报]

━━━━━━━━━━━━━━━━━━━━━━
😎 [Versión Nativa/Cool] 地道版
━━━━━━━━━━━━━━━━━━━━━━
[地道口语版。使用母语者常用的成语或动词短语（Modismos），消除生硬感]

━━━━━━━━━━━━━━━━━━━━━━
💡 外交小贴士
━━━━━━━━━━━━━━━━━━━━━━
[说明为什么要这么改，以及在西班牙/拉美不同地区的得体性差异]`;

  return await callClaude(prompt);
}

// ============ 功能 2：御前模拟演练（语音纠偏） ============
async function auditSpeech(userInput) {
  const prompt = `陛下通过语音转文字发送了以下内容，请作为同传教练进行专业分析：

用户输入："""${userInput}"""

请严格按以下格式回复：

━━━━━━━━━━━━━━━━━━━━━━
🎯 识别与转录修正
━━━━━━━━━━━━━━━━━━━━━━
[修正语音识别导致的拼写或语法错误，给出正确的完整句子]

━━━━━━━━━━━━━━━━━━━━━━
🔍 流畅度审计
━━━━━━━━━━━━━━━━━━━━━━
[识别表达中的"卡顿感"或"逻辑断层"，指出具体问题]

━━━━━━━━━━━━━━━━━━━━━━
⚡ 瞬间提速：3个万能转场句
━━━━━━━━━━━━━━━━━━━━━━
1. [适合同类话题的连接器/过渡句]
2. [适合同类话题的连接器/过渡句]
3. [适合同类话题的连接器/过渡句]

━━━━━━━━━━━━━━━━━━━━━━
🗣️ 朗读建议
━━━━━━━━━━━━━━━━━━━━━━
[标注哪些单词的重音或连读会导致歧义，以及如何正确朗读]`;

  return await callClaude(prompt);
}

// ============ 功能 3：同传小抄 ============
async function generateMemo(userInput) {
  // 提取场景描述（去掉"场景："前缀）
  const scenario = userInput.replace(/^场景[：:]\s*/i, '').trim();
  
  const prompt = `陛下即将面临以下外交场景，请生成一份"外交备忘录"：

场景：${scenario}

请严格按以下格式回复：

━━━━━━━━━━━━━━━━━━━━━━
📋 外交备忘录
━━━━━━━━━━━━━━━━━━━━━━
场景：${scenario}

━━━━━━━━━━━━━━━━━━━━━━
🎯 核心动词包（5个）
━━━━━━━━━━━━━━━━━━━━━━
1. [动词] - [中文释义] - [例句]
2. [动词] - [中文释义] - [例句]
3. [动词] - [中文释义] - [例句]
4. [动词] - [中文释义] - [例句]
5. [动词] - [中文释义] - [例句]

━━━━━━━━━━━━━━━━━━━━━━
🎩 外交辞令（3句）
━━━━━━━━━━━━━━━━━━━━━━
[既能表达歉意又能维持尊严的句子，适合此场景]

1. [句子] - [使用场景说明]
2. [句子] - [使用场景说明]
3. [句子] - [使用场景说明]

━━━━━━━━━━━━━━━━━━━━━━
🛡️ 防尴尬盾牌（2句）
━━━━━━━━━━━━━━━━━━━━━━
[当想不起来词时，用来争取思考时间的地道西语废话]

1. [句子] - [适用时机]
2. [句子] - [适用时机]`;

  return await callClaude(prompt);
}

// ============ 调用 Claude API ============
async function callClaude(userPrompt) {
  try {
    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: userPrompt }
        ]
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': CLAUDE_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      }
    );
    return response.data.content[0].text;
  } catch (error) {
    console.error('Claude API 调用失败:', error.response?.data || error.message);
    throw new Error('AI 大臣暂时无法上朝，请稍后重试');
  }
}

// ============ 发送飞书卡片 ============
async function sendFeishuCard(content, messageType) {
  if (!FEISHU_WEBHOOK) {
    console.log('警告：未设置 FEISHU_WEBHOOK_URL，仅输出到 stdout');
    return;
  }

  const typeEmoji = {
    polish: '📜',
    speech: '🎙️',
    memo: '📋'
  };

  const typeTitle = {
    polish: '国书润色完成',
    speech: '御前演练报告',
    memo: '外交备忘录'
  };

  const card = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: {
          tag: 'plain_text',
          content: `${typeEmoji[messageType] || '📜'} ${typeTitle[messageType] || '外交大臣回禀'}`
        },
        template: 'blue'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: content.slice(0, 9000) // 飞书卡片长度限制
          }
        },
        {
          tag: 'hr'
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '—— 您忠诚的外交大臣 🤵'
            }
          ]
        }
      ]
    }
  };

  try {
    await axios.post(FEISHU_WEBHOOK, card);
  } catch (error) {
    console.error('飞书推送失败:', error.message);
  }
}

// ============ 主函数 ============
async function main() {
  const args = process.argv.slice(2);
  
  // 参数解析
  let messageType = 'text';
  let userInput = '';
  
  if (args.length >= 2) {
    messageType = args[0];
    userInput = args[1];
  } else if (args.length === 1) {
    userInput = args[0];
    // 自动检测类型
    if (userInput.startsWith('场景') || userInput.startsWith('场景:') || userInput.startsWith('场景：')) {
      messageType = 'memo';
    } else if (looksLikeVoiceTranscript(userInput)) {
      messageType = 'speech';
    }
  } else {
    // 从 stdin 读取
    const chunks = [];
    process.stdin.setEncoding('utf8');
    for await (const chunk of process.stdin) {
      chunks.push(chunk);
    }
    userInput = chunks.join('').trim();
    
    if (!userInput) {
      console.error('用法: node diplomat-bot.js [text|speech|memo] "用户输入"');
      process.exit(1);
    }
    
    // 再次检测类型
    if (userInput.startsWith('场景') || userInput.startsWith('场景:') || userInput.startsWith('场景：')) {
      messageType = 'memo';
    } else if (looksLikeVoiceTranscript(userInput)) {
      messageType = 'speech';
    }
  }

  console.log(`🎩 外交大臣正在处理... [类型: ${messageType}]\n`);

  try {
    let result;
    
    switch (messageType) {
      case 'memo':
        result = await generateMemo(userInput);
        break;
      case 'speech':
        result = await auditSpeech(userInput);
        break;
      case 'polish':
      case 'text':
      default:
        result = await polishText(userInput);
        break;
    }

    // 输出到 stdout
    console.log(result);
    
    // 推送到飞书
    await sendFeishuCard(result, messageType === 'text' ? 'polish' : messageType);
    
    process.exit(0);
  } catch (error) {
    console.error('❌', error.message);
    process.exit(1);
  }
}

// ============ 语音转文字检测 ============
function looksLikeVoiceTranscript(text) {
  // 检测语音转文字的常见特征
  const voicePatterns = [
    /[嗯啊哦呃]/,           // 中文语气词
    /\.{3,}/,              // 多个省略号（停顿）
    /那个|这个|就是/,       // 口语填充词
    /[,.]\s*[,.]/,         // 标点混乱
    /^\s*/,                // 开头空白
    /\s{2,}/               // 多余空格
  ];
  
  return voicePatterns.some(pattern => pattern.test(text));
}

main();
