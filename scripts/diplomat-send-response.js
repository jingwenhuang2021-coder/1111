#!/usr/bin/env node
// 用途：外交大臣 - 推送 Kimi 的回复到飞书
// 参数：$1=任务ID（时间戳）或 "latest"
// 输出：推送飞书卡片
// 退出码：0=推送成功，1=失败
// Known Issues：如果 .tmp 目录被清理，历史任务会丢失

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = path.join(process.cwd(), '.tmp');

// ============ 查找任务 ============
function findTask(taskId) {
  if (taskId === 'latest') {
    // 查找最新的 meta 文件
    const files = fs.readdirSync(TMP_DIR)
      .filter(f => f.startsWith('diplomat-meta-'))
      .map(f => ({
        name: f,
        time: parseInt(f.match(/diplomat-meta-(\d+)\.json/)[1]),
        path: path.join(TMP_DIR, f)
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length === 0) {
      throw new Error('没有找到任务文件');
    }
    taskId = files[0].time;
  }

  const metaFile = path.join(TMP_DIR, `diplomat-meta-${taskId}.json`);
  const requestFile = path.join(TMP_DIR, `diplomat-request-${taskId}.txt`);
  const responseFile = path.join(TMP_DIR, `diplomat-response-${taskId}.txt`);

  if (!fs.existsSync(metaFile)) {
    throw new Error(`任务 ${taskId} 不存在`);
  }

  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  
  return {
    taskId,
    meta,
    requestFile,
    responseFile
  };
}

// ============ 发送飞书卡片 ============
async function sendFeishuCard(content, messageType, webhook) {
  const typeEmoji = {
    polish: '📜',
    speech: '🎙️',
    memo: '📋',
    text: '📜'
  };

  const typeTitle = {
    polish: '国书润色完成',
    speech: '御前演练报告',
    memo: '外交备忘录',
    text: '国书润色完成'
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
            content: content.slice(0, 9000)
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
    await axios.post(webhook, card);
    console.log('✅ 飞书卡片推送成功！');
  } catch (error) {
    console.error('❌ 飞书推送失败:', error.message);
    throw error;
  }
}

// ============ 主函数 ============
async function main() {
  const args = process.argv.slice(2);
  const taskId = args[0] || 'latest';

  try {
    console.log(`🎩 查找任务: ${taskId}`);
    const task = findTask(taskId);
    
    console.log(`✅ 找到任务: ${task.taskId}`);
    console.log(`   类型: ${task.meta.type}`);
    console.log(`   原文: ${task.meta.originalInput.slice(0, 50)}...`);
    
    // 检查是否有响应文件
    if (!fs.existsSync(task.responseFile)) {
      console.log('');
      console.log('⚠️ 未找到回复文件，需要手动输入回复内容');
      console.log('');
      console.log('请将 Kimi 的回复粘贴到以下文件：');
      console.log(task.responseFile);
      console.log('');
      console.log('或者直接将回复内容作为参数传入：');
      console.log(`node scripts/diplomat-send-response.js ${task.taskId} "你的回复内容"`);
      process.exit(1);
    }

    const responseContent = fs.readFileSync(task.responseFile, 'utf8');
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━ 回复内容预览 ━━━━━━━━━━━━━━━━━━━━━━');
    console.log(responseContent.slice(0, 500));
    if (responseContent.length > 500) {
      console.log('... (内容已截断)');
    }
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    await sendFeishuCard(responseContent, task.meta.type, task.meta.webhook);
    
    console.log('');
    console.log('🎉 任务完成！飞书已收到外交大臣的回复');
    
    // 可选：清理文件
    // fs.unlinkSync(task.requestFile);
    // fs.unlinkSync(task.metaFile);
    // fs.unlinkSync(task.responseFile);
    
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 如果提供了第二个参数（回复内容），保存到文件
if (process.argv.length >= 4) {
  const taskId = process.argv[2];
  const responseContent = process.argv[3];
  const responseFile = path.join(TMP_DIR, `diplomat-response-${taskId}.txt`);
  
  fs.writeFileSync(responseFile, responseContent, 'utf8');
  console.log('✅ 回复内容已保存');
  
  // 重新运行推送
  process.argv = [process.argv[0], process.argv[1], taskId];
}

main();
