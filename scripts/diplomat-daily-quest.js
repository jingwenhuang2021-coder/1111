#!/usr/bin/env node
// 用途：外交大臣 - 每日外交挑战推送
// 参数：无（依赖环境变量 ANTHROPIC_API_KEY、FEISHU_WEBHOOK_URL）
// 输出：推送每日挑战卡片到飞书
// 退出码：0=执行成功，1=执行失败
// Known Issues：Claude API 偶尔可能生成重复的头条；新闻时效性依赖于 API 训练数据

import axios from 'axios';

const CLAUDE_API_KEY = process.env.ANTHROPIC_API_KEY;
const FEISHU_WEBHOOK = process.env.FEISHU_WEBHOOK_URL || 'https://open.feishu.cn/open-apis/bot/v2/hook/1740c4ae-c0a9-4f36-8b4d-992f71b1c110';

if (!CLAUDE_API_KEY) {
  console.error('错误：请设置环境变量 ANTHROPIC_API_KEY');
  process.exit(1);
}

const CLAUDE_API_URL = 'https://api.anthropic.com/v1/messages';

// 每日挑战模板
const SCENARIOS = [
  '在商务晚宴上敬酒致辞',
  '向客户解释项目延期',
  '面试时回答"你的缺点是什么"',
  '在会议上打断冗长的发言',
  '礼貌地拒绝一个请求',
  '向上级汇报坏消息',
  '祝贺同事升职',
  '在电梯里和 CEO 闲聊',
  '向陌生人介绍自己的工作',
  '请求别人帮忙',
];

async function generateDailyQuest() {
  const today = new Date();
  const dateStr = today.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric', weekday: 'long' });
  
  // 随机选择一个场景
  const todayScenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
  
  const prompt = `作为外交大臣，请为陛下生成今日的"外交挑战"。

今日日期：${dateStr}
今日场景：${todayScenario}

请按以下格式生成：

━━━━━━━━━━━━━━━━━━━━━━
📰 今日头条金句（来自西班牙主流媒体风格）
━━━━━━━━━━━━━━━━━━━━━━
[一句适合今日场景的地道西语表达，类似于 ABC 或 El Mundo 的风格，C1/C2 级别]

中文释义：[中文翻译]

━━━━━━━━━━━━━━━━━━━━━━
🎯 今日任务
━━━━━━━━━━━━━━━━━━━━━━
场景：${todayScenario}

请陛下：
1. 用语音朗读上方金句
2. 尝试用这个句式描述您今天遇到的一个情况

━━━━━━━━━━━━━━━━━━━━━━
💡 大臣提示
━━━━━━━━━━━━━━━━━━━━━━
[这个表达在西班牙 vs 拉美地区的使用差异，以及使用时的注意事项]

━━━━━━━━━━━━━━━━━━━━━━
⚔️ 进阶挑战（可选）
━━━━━━━━━━━━━━━━━━━━━━
[一个更难的变体句式或相关成语]`;

  try {
    const response = await axios.post(
      CLAUDE_API_URL,
      {
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2048,
        messages: [
          {
            role: 'system',
            content: '你是一位精通中西双语的西班牙语外交教练，语气优雅幽默，像一位忠诚的老臣。'
          },
          { role: 'user', content: prompt }
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
    
    return {
      date: dateStr,
      content: response.data.content[0].text,
      scenario: todayScenario
    };
  } catch (error) {
    console.error('Claude API 调用失败:', error.message);
    throw error;
  }
}

async function sendDailyQuestCard(quest) {
  const card = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: {
          tag: 'plain_text',
          content: `📅 ${quest.date} | 每日外交挑战`
        },
        template: 'orange'
      },
      elements: [
        {
          tag: 'div',
          text: {
            tag: 'lark_md',
            content: quest.content.slice(0, 8000)
          }
        },
        {
          tag: 'hr'
        },
        {
          tag: 'action',
          actions: [
            {
              tag: 'button',
              text: {
                tag: 'plain_text',
                content: '🎙️ 我已完成语音挑战'
              },
              type: 'primary',
              value: {
                action: 'daily_quest_complete',
                scenario: quest.scenario
              }
            }
          ]
        },
        {
          tag: 'note',
          elements: [
            {
              tag: 'plain_text',
              content: '—— 您忠诚的外交大臣 🤵 | 坚持每日一练，早日成为西语外交高手！'
            }
          ]
        }
      ]
    }
  };

  await axios.post(FEISHU_WEBHOOK, card);
}

async function main() {
  console.log('🎩 外交大臣正在准备今日挑战...');
  
  try {
    const quest = await generateDailyQuest();
    await sendDailyQuestCard(quest);
    console.log('✅ 每日挑战推送成功！');
    console.log(`\n${quest.content}`);
    process.exit(0);
  } catch (error) {
    console.error('❌ 推送失败:', error.message);
    process.exit(1);
  }
}

main();
