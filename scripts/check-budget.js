#!/usr/bin/env node
// 用途：读取飞书「每日消费明细」，按分类汇总当月消费，对比预算并输出预警报告
// 参数：无（依赖环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN）
// 输出：stdout 返回预算执行报告，并推送卡片消息到飞书机器人
// 退出码：0=执行成功，1=执行失败

import axios from 'axios';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('错误：请设置环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN');
  process.exit(1);
}

// 单位：元/月（匹配你在飞书中实际使用的分类名称）
const BUDGET = {
  '吃吃吃': 1000,      // 餐饮美食
  '交通出行': 300,
  '日用': 300,         // 日用购物
  '休闲娱乐': 200,
  '衣服': 1000,        // 衣服鞋包
  '猪咪': 300,         // 宠物
  '学习成长': 200,
  '人情往来': 300,
  '医疗': 0,           // 医保覆盖
  '房租': 3800,        // 住房物业
  '转账还款': 0,       // 不计入日常消费预算
  '其他': 400,
};

const WARNING_THRESHOLD = 0.8;

async function getTenantAccessToken() {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  const res = await axios.post(url, { app_id: APP_ID, app_secret: APP_SECRET });
  if (res.data.code !== 0) throw new Error(`获取 token 失败: ${res.data.msg}`);
  return res.data.tenant_access_token;
}

async function listTables(token) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables`;
  const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
  if (res.data.code !== 0) throw new Error(`获取表格列表失败: ${res.data.msg}`);
  return res.data.data.items;
}

async function fetchAllRecords(token, tableId) {
  const records = [];
  let pageToken = null;
  while (true) {
    const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records?page_size=500${pageToken ? '&page_token=' + pageToken : ''}`;
    const res = await axios.get(url, { headers: { Authorization: `Bearer ${token}` } });
    if (res.data.code !== 0) throw new Error(`获取记录失败: ${res.data.msg}`);
    const items = res.data.data.items || [];
    records.push(...items);
    pageToken = res.data.data.page_token;
    if (!pageToken || items.length === 0) break;
  }
  return records;
}

function formatMoney(n) {
  return '¥' + (n || 0).toFixed(2).padStart(8, ' ');
}

function progressBar(pct, width = 20) {
  const filled = Math.round(pct * width);
  const empty = width - filled;
  return '█'.repeat(Math.max(0, filled)) + '░'.repeat(Math.max(0, empty));
}

function buildFeishuCard(currentMonth, totalSpent, totalBudget, rows, warnings, overs, adviceLines) {
  const overallPct = totalBudget > 0 ? totalSpent / totalBudget : 0;
  let headerColor = 'green';
  if (overallPct > 1) headerColor = 'red';
  else if (overallPct > 0.8) headerColor = 'orange';
  else if (warnings.length > 0 || overs.length > 0) headerColor = 'orange';

  const elements = [];

  // 总览数据 - 3列
  elements.push({
    tag: 'column_set',
    flex_mode: 'stretch',
    background_style: 'grey',
    columns: [
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        elements: [
          { tag: 'div', text: { tag: 'lark_md', content: `**本月总消费**\n<font color='${overallPct > 1 ? 'red' : 'black'}'>¥${totalSpent.toFixed(2)}</font>` } }
        ]
      },
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        elements: [
          { tag: 'div', text: { tag: 'lark_md', content: `**月度总预算**\n¥${totalBudget.toFixed(2)}` } }
        ]
      },
      {
        tag: 'column',
        width: 'weighted',
        weight: 1,
        elements: [
          { tag: 'div', text: { tag: 'lark_md', content: `**总进度**\n<font color='${headerColor}'>${(overallPct * 100).toFixed(0)}%</font>` } }
        ]
      }
    ]
  });

  elements.push({ tag: 'hr' });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**📋 分类明细**' } });

  // 分类列表
  for (const row of rows) {
    const { cat, spent, budget, statusText, statusColor } = row;
    const pct = budget > 0 ? spent / budget : 0;
    const bar = '█'.repeat(Math.round(Math.min(pct, 1) * 10)) + '░'.repeat(Math.round((1 - Math.min(pct, 1)) * 10));

    let leftContent;
    if (budget > 0) {
      leftContent = `**${cat}**\n¥${spent.toFixed(2)} / ¥${budget.toFixed(2)}  剩余 ¥${(budget - spent).toFixed(2)}\n\`${bar}\` ${(pct * 100).toFixed(0)}%`;
    } else {
      leftContent = `**${cat}**\n¥${spent.toFixed(2)}  （无预算）`;
    }

    elements.push({
      tag: 'div',
      fields: [
        { is_short: true, text: { tag: 'lark_md', content: leftContent } },
        { is_short: true, text: { tag: 'lark_md', content: `<font color='${statusColor}'>${statusText}</font>` } }
      ]
    });
  }

  // 预警区
  if (warnings.length > 0 || overs.length > 0) {
    elements.push({ tag: 'hr' });
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**⚠️ 预警与超支**' } });

    for (const w of warnings) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `⚠️ **${w.cat}** 已用 **${(w.pct * 100).toFixed(0)}%**（¥${w.spent.toFixed(2)} / ¥${w.budget}），剩余 ¥${w.remaining.toFixed(2)}`
        }
      });
    }
    for (const o of overs) {
      elements.push({
        tag: 'div',
        text: {
          tag: 'lark_md',
          content: `🚨 **${o.cat}** 已超支 **¥${Math.abs(o.remaining).toFixed(2)}**（¥${o.spent.toFixed(2)} / ¥${o.budget}）`
        }
      });
    }
  }

  // 理财建议
  elements.push({ tag: 'hr' });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**💡 理财建议**' } });
  for (const line of adviceLines) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `• ${line}` } });
  }

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: {
          tag: 'plain_text',
          content: `📊 本月预算执行报告（${currentMonth + 1}月）`
        },
        template: headerColor
      },
      elements
    }
  };
}

async function main() {
  const token = await getTenantAccessToken();
  const tables = await listTables(token);
  const targetTable = tables.find((t) => t.name === '每日消费明细');
  if (!targetTable) {
    console.error('错误：未找到「每日消费明细」表');
    process.exit(1);
  }

  const records = await fetchAllRecords(token, targetTable.table_id);
  console.log(`已读取 ${records.length} 条消费记录\n`);

  // 过滤当月
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  const monthlyRecords = records.filter((r) => {
    const ts = r.fields.日期;
    if (!ts) return false;
    const d = new Date(ts);
    return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
  });

  // 按分类汇总
  const spentByCategory = {};
  let totalSpent = 0;
  for (const r of monthlyRecords) {
    const cat = r.fields.分类 || '其他';
    const amt = Number(r.fields.金额) || 0;
    spentByCategory[cat] = (spentByCategory[cat] || 0) + amt;
    totalSpent += amt;
  }

  // 合并所有预算分类（包括没消费的）
  const allCategories = Array.from(new Set([...Object.keys(BUDGET), ...Object.keys(spentByCategory)]));

  // 生成 Terminal 纯文本报告
  const lines = [];
  lines.push('╔══════════════════════════════════════════════════════════════╗');
  lines.push('║           📊 本月预算执行报告 (' + (currentMonth + 1) + '月)                     ║');
  lines.push('╠══════════════════════════════════════════════════════════════╣');
  lines.push(`║  本月总消费: ${formatMoney(totalSpent)}                                    ║`);
  lines.push('╠══════════════════════════════════════════════════════════════╣');
  lines.push('║  分类          已花费      预算        剩余      进度        ║');
  lines.push('╠══════════════════════════════════════════════════════════════╣');

  const warnings = [];
  const overs = [];
  const feishuRows = [];

  for (const cat of allCategories.sort((a, b) => (BUDGET[b] || 0) - (BUDGET[a] || 0))) {
    const spent = spentByCategory[cat] || 0;
    const budget = BUDGET[cat] || 0;
    const remaining = budget - spent;
    const pct = budget > 0 ? spent / budget : (spent > 0 ? 1 : 0);
    const bar = progressBar(Math.min(pct, 1));
    let status = '✅';
    let statusText = '正常';
    let statusColor = 'green';
    if (budget > 0 && pct >= 1) {
      status = '🚨';
      statusText = '超支';
      statusColor = 'red';
      overs.push({ cat, spent, budget, remaining });
    } else if (budget > 0 && pct >= WARNING_THRESHOLD) {
      status = '⚠️ ';
      statusText = '预警';
      statusColor = 'orange';
      warnings.push({ cat, spent, budget, remaining, pct });
    }

    const catStr = cat.padEnd(8, ' ');
    const spentStr = formatMoney(spent);
    const budgetStr = budget > 0 ? formatMoney(budget) : '     —';
    const remainStr = budget > 0 ? formatMoney(remaining) : '     —';
    lines.push(`║ ${status} ${catStr} ${spentStr} ${budgetStr} ${remainStr} ${bar} ║`);

    feishuRows.push({ cat, spent, budget, statusText, statusColor });
  }

  lines.push('╚══════════════════════════════════════════════════════════════╝');

  // 预警区
  if (warnings.length > 0 || overs.length > 0) {
    lines.push('\n⚠️  预警与超支：');
    for (const w of warnings) {
      lines.push(`  ⚠️  ${w.cat} 已用 ${(w.pct * 100).toFixed(0)}%（${w.spent.toFixed(2)} / ${w.budget}），剩余 ${w.remaining.toFixed(2)} 元`);
    }
    for (const o of overs) {
      lines.push(`  🚨 ${o.cat} 已超支 ${Math.abs(o.remaining).toFixed(2)} 元（${o.spent.toFixed(2)} / ${o.budget}）`);
    }
  } else {
    lines.push('\n✅ 所有有预算的分类均未达到 80% 预警线，消费控制良好！');
  }

  // 理财建议
  lines.push('\n💡 理财建议：');
  const totalBudget = Object.values(BUDGET).reduce((a, b) => a + b, 0);
  const overallPct = totalBudget > 0 ? totalSpent / totalBudget : 0;
  const adviceLines = [];
  if (overallPct > 1) {
    adviceLines.push(`本月总支出已超出月度规划 ${formatMoney(totalSpent - totalBudget)}，建议下月压缩非必要开支。`);
  } else if (overallPct > 0.8) {
    adviceLines.push(`本月总支出已达规划的 ${(overallPct * 100).toFixed(0)}%，剩余时间请谨慎消费。`);
  } else {
    adviceLines.push(`本月总支出为规划的 ${(overallPct * 100).toFixed(0)}%，财务状况健康。`);
  }

  if (overs.some(o => o.cat === '衣服')) {
    adviceLines.push('👕 衣服类已超支，建议暂停本月服饰购买。');
  }
  if (overs.some(o => o.cat === '猪咪')) {
    adviceLines.push('🐕 宠物类已超支，建议检查是否为一次性医疗/用品支出。');
  }

  for (const al of adviceLines) lines.push(`  ${al}`);

  const report = lines.join('\n');
  console.log(report);

  // 发送到飞书 webhook（卡片消息）
  const webhook = process.env.FEISHU_WEBHOOK_URL || 'https://open.feishu.cn/open-apis/bot/v2/hook/124e7cb8-8d4b-4fa1-92ff-bb6c4aa99079';
  try {
    const cardPayload = buildFeishuCard(currentMonth, totalSpent, totalBudget, feishuRows, warnings, overs, adviceLines);
    await axios.post(webhook, cardPayload);
    console.log('\n✅ 卡片报告已推送到飞书');
  } catch (err) {
    console.error('\n飞书推送失败:', err.message);
    if (err.response?.data) {
      console.error(JSON.stringify(err.response.data, null, 2));
    }
  }
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  if (err.response?.data) {
    console.error('飞书 API 返回:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
