#!/usr/bin/env node
// 用途：理财机器人 - 读取飞书理财表格，生成毒舌财务管家诊断报告并推送卡片
// 参数：无（依赖环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN）
// 输出：stdout 返回报告，并推送卡片到飞书机器人
// 退出码：0=执行成功，1=执行失败

import axios from 'axios';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('错误：请设置环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN');
  process.exit(1);
}

const WEBHOOK = process.env.FEISHU_WEBHOOK_URL || 'https://open.feishu.cn/open-apis/bot/v2/hook/124e7cb8-8d4b-4fa1-92ff-bb6c4aa99079';

// 预算配置
const BUDGET = {
  '吃吃吃': 1000,
  '交通出行': 300,
  '日用': 300,
  '休闲娱乐': 200,
  '衣服': 1000,
  '猪咪': 300,
  '学习成长': 200,
  '人情往来': 300,
  '医疗': 0,
  '房租': 3800,
  '转账还款': 0,
  '其他': 400,
};

const MONTHLY_TOTAL_BUDGET = Object.values(BUDGET).reduce((a, b) => a + b, 0); // 6500
const TARGET_AMOUNT = 100000;
const TARGET_NAME = '总资产 10万';

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

function formatDate(ts) {
  if (!ts) return '';
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function getMonthKey(ts) {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function buildCard(data) {
  const { currentMonth, currentDay, totalAssets, remainingToTarget, avgMonthlySurplus, estimatedDays, delayDays, delayText, liquidity, monthlySpent, survivalMode, selfImprovementPct, appearancePct, moodAnalysis, noSpendDays, bigSpends, savingsRate, rentRatio, nextMonthAdvice, headerColor, roastLines } = data;

  const elements = [];

  // 1. 目标倒计时
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**🎯 目标倒计时**' } });
  elements.push({
    tag: 'column_set',
    flex_mode: 'stretch',
    background_style: 'grey',
    columns: [
      { tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'div', text: { tag: 'lark_md', content: `**当前总资产**\n¥${totalAssets.toLocaleString()}` } }] },
      { tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'div', text: { tag: 'lark_md', content: `**距离 100K**\n¥${remainingToTarget.toLocaleString()}` } }] },
      { tag: 'column', width: 'weighted', weight: 1, elements: [{ tag: 'div', text: { tag: 'lark_md', content: `**预计达成**\n${estimatedDays > 999 ? '∞' : estimatedDays + ' 天后'}` } }] }
    ]
  });
  if (delayText) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `<font color='red'>${delayText}</font>` } });
  }
  elements.push({ tag: 'hr' });

  // 2. 生存模式
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**🚨 生存模式检查**' } });
  if (survivalMode.triggered) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `<font color='red'>🚨 ${survivalMode.reason}</font>` } });
  } else {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `✅ 流动资金 ¥${liquidity.toLocaleString()}，本月支出 ¥${monthlySpent.toFixed(2)} / ¥${MONTHLY_TOTAL_BUDGET}，财务状况尚可。` } });
  }
  elements.push({ tag: 'hr' });

  // 3. 消费性格画像
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**🎭 消费性格画像**' } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `• 自我提升（学习成长）：${selfImprovementPct.toFixed(1)}%\n• 外在美（衣服）：${appearancePct.toFixed(1)}%` } });
  for (const line of roastLines) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `💬 ${line}` } });
  }
  if (moodAnalysis) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: `🧠 情绪洞察：${moodAnalysis}` } });
  }
  elements.push({ tag: 'hr' });

  // 4. 极简主义挑战
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**🎮 极简主义挑战**' } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `🏅 本月无消费日：**${noSpendDays} 天** ${noSpendDays >= 10 ? '→ 获得「理财忍者」勋章！' : noSpendDays >= 5 ? '→ 获得「省钱学徒」勋章！' : '→ 继续努力！'}` } });
  if (bigSpends.length > 0) {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**大额非必要支出换算：**' } });
    for (const bs of bigSpends) {
      elements.push({ tag: 'div', text: { tag: 'lark_md', content: `• ${bs.merchant} ¥${bs.amount.toFixed(2)} ≈ ${bs.targetPct}% 的 100K 目标 ≈ ${bs.books} 本书` } });
    }
  } else {
    elements.push({ tag: 'div', text: { tag: 'lark_md', content: '• 本月暂无单笔 > ¥1,000 的非必要支出，钱包表示很欣慰。' } });
  }
  elements.push({ tag: 'hr' });

  // 5. 定期体检报告
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: '**🏥 定期体检报告**' } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `• 储蓄率（定存/到手）：**${(savingsRate * 100).toFixed(0)}%** ${savingsRate >= 0.33 ? '✅ 及格线以上' : '⚠️ 低于 33% 及格线'}` } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `• 房租收入占比：**${(rentRatio * 100).toFixed(0)}%** ${rentRatio <= 0.35 ? '✅ 合理' : '⚠️ 偏高'}` } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `• 定存雷区：**¥4,000 神圣不可侵犯** 🚫` } });
  elements.push({ tag: 'div', text: { tag: 'lark_md', content: `🔮 下月前瞻：${nextMonthAdvice}` } });

  return {
    msg_type: 'interactive',
    card: {
      config: { wide_screen_mode: true },
      header: {
        title: { tag: 'plain_text', content: `🤖 毒舌财务管家 · ${currentMonth + 1}月${currentDay}日诊断报告` },
        template: headerColor
      },
      elements
    }
  };
}

async function main() {
  const token = await getTenantAccessToken();
  const tables = await listTables(token);

  const tableMap = {};
  for (const t of tables) tableMap[t.name] = t.table_id;

  // 读取数据
  const assets = await fetchAllRecords(token, tableMap['资产负债表']);
  const cashflows = await fetchAllRecords(token, tableMap['月度收支流水']);
  const goals = await fetchAllRecords(token, tableMap['理财目标追踪']);
  const expenses = await fetchAllRecords(token, tableMap['每日消费明细']);

  const now = new Date();
  const currentMonth = now.getMonth();
  const currentDay = now.getDate();
  const currentMonthKey = `${now.getFullYear()}-${String(currentMonth + 1).padStart(2, '0')}`;

  // === 1. 计算总资产 ===
  let totalAssets = 0;
  let liquidity = 0;
  for (const r of assets) {
    const amt = Number(r.fields['折合人民币']) || 0;
    totalAssets += amt;
    if (r.fields['资产类型'] === '流动') liquidity += amt;
  }

  // === 2. 计算目标相关 ===
  const targetGoal = goals.find(g => g.fields['目标名称']?.includes('10万'));
  const currentProgress = targetGoal ? Number(targetGoal.fields['当前进度']) || totalAssets : totalAssets;
  const remainingToTarget = Math.max(0, TARGET_AMOUNT - currentProgress);

  // === 3. 最近3个月收支 ===
  const sortedCashflows = cashflows
    .map(r => ({
      month: r.fields['月份'],
      income: Number(r.fields['到手收入']) || 0,
      rent: Number(r.fields['房租支出']) || 0,
      hard: Number(r.fields['硬性支出']) || 0,
      savings: Number(r.fields['定存']) || 0,
      surplus: Number(r.fields['月度结余']) || 0,
      // 真实支出 = 房租 + 硬性支出（定存是储蓄，不是支出）
      realExpense: (Number(r.fields['房租支出']) || 0) + (Number(r.fields['硬性支出']) || 0),
    }))
    .sort((a, b) => b.month.localeCompare(a.month));

  // 如果只有1个月数据，用预算推算平均支出
  const recent3 = sortedCashflows.slice(0, 3);
  const avgIncome = recent3.length > 0 ? recent3.reduce((s, r) => s + r.income, 0) / recent3.length : 12000;
  const avgExpense = recent3.length > 0 ? recent3.reduce((s, r) => s + r.realExpense, 0) / recent3.length : MONTHLY_TOTAL_BUDGET;
  const avgMonthlySurplus = avgIncome - avgExpense;

  // === 4. 本月实际支出（从每日消费明细）===
  const monthlyExpenses = expenses.filter(r => {
    const ts = r.fields.日期;
    if (!ts) return false;
    return getMonthKey(ts) === currentMonthKey;
  });

  const monthlySpent = monthlyExpenses.reduce((s, r) => s + (Number(r.fields.金额) || 0), 0);

  // === 5. 目标倒计时 ===
  const dailySurplus = avgMonthlySurplus / 30;
  const estimatedDays = dailySurplus > 0 ? Math.ceil(remainingToTarget / dailySurplus) : 99999;

  let delayDays = 0;
  let delayText = '';
  if (monthlySpent > MONTHLY_TOTAL_BUDGET && dailySurplus > 0) {
    const overspend = monthlySpent - MONTHLY_TOTAL_BUDGET;
    delayDays = Math.ceil(overspend / dailySurplus);
    const originalDate = new Date();
    originalDate.setDate(originalDate.getDate() + estimatedDays);
    const delayedDate = new Date();
    delayedDate.setDate(delayedDate.getDate() + estimatedDays + delayDays);
    delayText = `🚨 由于本月超支 ¥${overspend.toFixed(2)}，你的 10K 包包已离你远去。达成时间从 ${originalDate.getMonth() + 1}月 推迟到了 ${delayedDate.getMonth() + 1}月，延迟 ${delayDays} 天。`;
  }

  // === 6. 生存模式 ===
  const survivalMode = { triggered: false, reason: '' };
  const budgetPct = monthlySpent / MONTHLY_TOTAL_BUDGET;
  if (currentDay <= 15 && budgetPct >= 0.8) {
    survivalMode.triggered = true;
    survivalMode.reason = `本月才过 ${currentDay} 天，支出已达总预算的 ${(budgetPct * 100).toFixed(0)}%！请立刻开启「生存模式」，停止一切非必要消费。`;
  } else if (liquidity < 5000) {
    survivalMode.triggered = true;
    survivalMode.reason = `流动资金仅剩 ¥${liquidity.toLocaleString()}，低于 5,000 元安全线。建议暂停所有非必要支出，先保命。`;
  }

  // === 7. 消费性格画像 ===
  const selfImprovement = monthlyExpenses.filter(r => r.fields.分类 === '学习成长').reduce((s, r) => s + (Number(r.fields.金额) || 0), 0);
  const appearance = monthlyExpenses.filter(r => r.fields.分类 === '衣服').reduce((s, r) => s + (Number(r.fields.金额) || 0), 0);
  const selfImprovementPct = monthlySpent > 0 ? (selfImprovement / monthlySpent) * 100 : 0;
  const appearancePct = monthlySpent > 0 ? (appearance / monthlySpent) * 100 : 0;

  const roastLines = [];
  if (selfImprovementPct < 5 && monthlySpent > 0) {
    roastLines.push(`你为皮囊花了 ¥${appearance.toFixed(2)}，为大脑花了 ¥${selfImprovement.toFixed(2)}。建议给大脑也穿件新衣服，不然 100K 目标会嫌弃你没内涵。`);
  }
  if (appearance > selfImprovement * 3 && monthlySpent > 0) {
    roastLines.push(`外在美支出是自我提升的 ${(appearance / Math.max(selfImprovement, 1)).toFixed(1)} 倍。钱包在哭泣，而你的大脑在裸奔。`);
  }
  if (roastLines.length === 0 && monthlySpent > 0) {
    roastLines.push(`本月消费结构还算均衡，继续保持，你的包包正在向你招手。`);
  }

  // 心情分析
  const moodRecords = monthlyExpenses.filter(r => r.fields['心情评分'] !== undefined && r.fields['心情评分'] !== null && r.fields['心情评分'] !== '');
  let moodAnalysis = '';
  if (moodRecords.length >= 3) {
    const badMoodDays = moodRecords.filter(r => Number(r.fields['心情评分']) <= 2);
    const badMoodSpending = badMoodDays.reduce((s, r) => s + (Number(r.fields.金额) || 0), 0);
    const avgMoodSpending = moodRecords.reduce((s, r) => s + (Number(r.fields.金额) || 0), 0) / moodRecords.length;
    if (badMoodDays.length > 0 && badMoodSpending > avgMoodSpending * 1.5) {
      moodAnalysis = `检测到 ${badMoodDays.length} 天心情低落时消费激增，情绪化消费正在偷走你的 100K。建议心情不好时去跑步，而不是跑向购物车。`;
    } else {
      moodAnalysis = `心情与消费关联性不大，你是个理性的消费者。`;
    }
  } else {
    moodAnalysis = `心情评分数据不足（仅 ${moodRecords.length} 条），建议后续记账时顺手打个分，让我更好地揪出你的情绪化消费。`;
  }

  // === 8. 极简主义挑战 ===
  const expenseDates = new Set(monthlyExpenses.map(r => formatDate(r.fields.日期)));
  const noSpendDays = currentDay - expenseDates.size;

  const bigSpends = monthlyExpenses
    .filter(r => {
      const amt = Number(r.fields.金额) || 0;
      const cat = r.fields.分类;
      const necessary = r.fields['是否必要'];
      return amt > 1000 && cat !== '房租' && cat !== '转账还款' && cat !== '医疗' && necessary !== '必要';
    })
    .map(r => {
      const amt = Number(r.fields.金额) || 0;
      return {
        merchant: r.fields['消费场景/商家'] || '未知商家',
        amount: amt,
        targetPct: ((amt / TARGET_AMOUNT) * 100).toFixed(2),
        books: Math.floor(amt / 30),
      };
    });

  // === 9. 定期体检 ===
  const currentMonthFlow = sortedCashflows.find(r => r.month === currentMonthKey);
  const savingsRate = currentMonthFlow ? currentMonthFlow.savings / currentMonthFlow.income : (4000 / 12000);
  const rentRatio = currentMonthFlow ? currentMonthFlow.rent / currentMonthFlow.income : (3800 / 12000);

  // 下月前瞻
  const nextMonth = currentMonth + 2; // 因为 currentMonth 是 0-based，+2 才是下下个月？不对
  // currentMonth = 2 (3月)，下月是 4月
  const nextMonthNum = currentMonth + 2; // 显示用月份
  let nextMonthAdvice = '';
  if (nextMonthNum === 4) {
    nextMonthAdvice = '4月有清明节小长假，建议提前预留 ¥500-800 出行/聚餐预算，严禁动用定存。';
  } else if (nextMonthNum === 5) {
    nextMonthAdvice = '5月劳动节假期较长，旅游冲动会飙升，建议把旅行预算控制在 ¥1,500 以内。';
  } else if (nextMonthNum === 6) {
    nextMonthAdvice = '6月 618 大促来袭，请提前列好购物清单，非必要不囤货，守住钱包底线。';
  } else if (nextMonthNum === 10) {
    nextMonthAdvice = '10月国庆长假，人情往来和出行支出会激增，建议提前预留 ¥1,000。';
  } else if (nextMonthNum === 11) {
    nextMonthAdvice = '11月双 11，你的购物车正在磨刀霍霍。建议只买清单内的必需品。';
  } else if (nextMonthNum === 12 || nextMonthNum === 1) {
    nextMonthAdvice = '年末聚会和礼物季，人情往来预算可能吃紧，建议提前规划。';
  } else {
    nextMonthAdvice = '下月暂无大型节假日，是存钱的好时机，建议继续保持储蓄节奏。';
  }

  // Header 颜色
  let headerColor = 'green';
  if (survivalMode.triggered || delayDays > 0 || savingsRate < 0.33) headerColor = 'red';
  else if (bigSpends.length > 0 || budgetPct > 0.7) headerColor = 'orange';

  const data = {
    currentMonth,
    currentDay,
    totalAssets,
    remainingToTarget,
    avgMonthlySurplus,
    estimatedDays,
    delayDays,
    delayText,
    liquidity,
    monthlySpent,
    survivalMode,
    selfImprovementPct,
    appearancePct,
    moodAnalysis,
    noSpendDays,
    bigSpends,
    savingsRate,
    rentRatio,
    nextMonthAdvice,
    headerColor,
    roastLines,
  };

  // Terminal 输出
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`        🤖 毒舌财务管家 · ${currentMonth + 1}月${currentDay}日诊断报告`);
  console.log('═══════════════════════════════════════════════════════════════');
  console.log(`💰 当前总资产: ¥${totalAssets.toLocaleString()}`);
  console.log(`🎯 距离 100K:  ¥${remainingToTarget.toLocaleString()}`);
  console.log(`📅 预计达成:   ${estimatedDays > 999 ? '∞' : estimatedDays + ' 天后'}`);
  if (delayText) console.log(delayText);
  console.log(`🏦 流动资金:   ¥${liquidity.toLocaleString()}`);
  console.log(`💸 本月支出:   ¥${monthlySpent.toFixed(2)} / ¥${MONTHLY_TOTAL_BUDGET}`);
  if (survivalMode.triggered) console.log(`🚨 ${survivalMode.reason}`);
  console.log(`🎭 自我提升:   ${selfImprovementPct.toFixed(1)}% | 外在美: ${appearancePct.toFixed(1)}%`);
  console.log(`🏅 无消费日:   ${noSpendDays} 天`);
  console.log(`📊 储蓄率:     ${(savingsRate * 100).toFixed(0)}% | 房租占比: ${(rentRatio * 100).toFixed(0)}%`);
  console.log('═══════════════════════════════════════════════════════════════');

  // 推送飞书
  try {
    const cardPayload = buildCard(data);
    await axios.post(WEBHOOK, cardPayload);
    console.log('\n✅ 理财机器人卡片已推送到飞书');
  } catch (err) {
    console.error('\n飞书推送失败:', err.message);
    if (err.response?.data) console.error(JSON.stringify(err.response.data, null, 2));
  }
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  if (err.response?.data) {
    console.error('飞书 API 返回:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
