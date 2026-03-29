#!/usr/bin/env node
// 用途：三语翻译官 - 推送翻译结果到飞书
// 参数：$1=任务ID 或 "latest"
// 输出：飞书卡片

import axios from 'axios';
import * as fs from 'fs';
import * as path from 'path';

const TMP_DIR = path.join(process.cwd(), '.tmp');

function findTask(taskId) {
  if (taskId === 'latest') {
    const files = fs.readdirSync(TMP_DIR)
      .filter(f => f.startsWith('translate-meta-'))
      .map(f => ({
        name: f,
        time: parseInt(f.match(/translate-meta-(\d+)\.json/)[1]),
        path: path.join(TMP_DIR, f)
      }))
      .sort((a, b) => b.time - a.time);
    
    if (files.length === 0) throw new Error('没有找到任务');
    taskId = files[0].time;
  }

  const metaFile = path.join(TMP_DIR, `translate-meta-${taskId}.json`);
  const responseFile = path.join(TMP_DIR, `translate-response-${taskId}.txt`);

  if (!fs.existsSync(metaFile)) throw new Error(`任务 ${taskId} 不存在`);

  return {
    taskId,
    meta: JSON.parse(fs.readFileSync(metaFile, 'utf8')),
    responseFile
  };
}

async function sendFeishuCard(content, meta) {
  const card = {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `🌍 三语翻译` },
        template: 'green'
      },
      elements: [
        {
          tag: 'div',
          text: { tag: 'lark_md', content: `**原文：** ${meta.originalInput}` }
        },
        { tag: 'hr' },
        {
          tag: 'div',
          text: { tag: 'lark_md', content: content.slice(0, 9000) }
        },
        {
          tag: 'note',
          elements: [{ tag: 'plain_text', content: '—— 三语翻译官 🤖' }]
        }
      ]
    }
  };

  try {
    await axios.post(meta.webhook, card);
    console.log('✅ 飞书卡片推送成功！');
  } catch (error) {
    console.error('❌ 推送失败:', error.message);
    throw error;
  }
}

async function main() {
  const args = process.argv.slice(2);
  const taskId = args[0] || 'latest';

  try {
    console.log(`🌍 查找翻译任务: ${taskId}`);
    const task = findTask(taskId);
    
    console.log(`✅ 找到任务: ${task.taskId}`);
    console.log(`   原文: ${task.meta.originalInput.slice(0, 50)}...`);

    if (!fs.existsSync(task.responseFile)) {
      console.log('');
      console.log('⚠️ 未找到翻译结果');
      console.log('');
      console.log('请先将 Kimi 的回复保存到：');
      console.log(task.responseFile);
      console.log('');
      console.log('或者运行：');
      console.log(`node scripts/translator-send-response.js ${task.taskId} "翻译内容"`);
      process.exit(1);
    }

    const content = fs.readFileSync(task.responseFile, 'utf8');
    
    console.log('');
    console.log('━━━━━━━━━━━━━━━━━━━━━━ 翻译内容预览 ━━━━━━━━━━━━━━━━━━━━━━');
    console.log(content.slice(0, 500));
    if (content.length > 500) console.log('...');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('');
    
    await sendFeishuCard(content, task.meta);
    
    console.log('🎉 翻译完成！飞书已收到');
    process.exit(0);
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

// 如果提供了第二个参数（回复内容），直接保存
if (process.argv.length >= 4) {
  const taskId = process.argv[2];
  const content = process.argv[3];
  const responseFile = path.join(TMP_DIR, `translate-response-${taskId}.txt`);
  fs.writeFileSync(responseFile, content, 'utf8');
  console.log('✅ 翻译内容已保存');
  process.argv = [process.argv[0], process.argv[1], taskId];
}

main();
