#!/usr/bin/env node
// 用途：读取 screenshots/ 目录下的消费截图，OCR 识别后自动拆分多笔交易并同步到飞书多维表格
// 参数：无（依赖环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN）
// 输出：stdout 返回识别结果和汇总分析
// 退出码：0=执行成功，1=执行失败

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('错误：请设置环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN');
  process.exit(1);
}

const SCREENSHOTS_DIR = path.resolve('screenshots');

// 分类规则：关键词 -> 分类（匹配飞书中实际使用的口语化分类）
const CATEGORY_RULES = [
  { keywords: ['麦当劳','肯德基','星巴克','瑞幸','喜茶','奈雪','海底捞','烧烤','火锅','餐厅','外卖','美团','饿了么','便利店','盒马','山姆','买菜','水果','奶茶','咖啡','面包','蛋糕','小吃','快餐','食堂','餐饮','饭店','餐厅','牛丰盛'], category: '吃吃吃' },
  { keywords: ['地铁','公交','滴滴','打车','出租车','高铁','火车','飞机','加油','停车','高速费','共享单车','摩拜','哈啰','携程','飞猪','去哪儿'], category: '交通出行' },
  { keywords: ['淘宝','京东','拼多多','天猫','抖音商城','小红书','优衣库','无印良品','宜家','屈臣氏','万宁','盒马','山姆'], category: '日用' },
  { keywords: ['电影','影院','KTV','酒吧','剧本杀','密室','游乐园','演唱会','展览','游戏','Steam','腾讯','爱奇艺','优酷','B站','网易云','QQ音乐'], category: '休闲娱乐' },
  { keywords: ['房租','物业','水电','燃气','宽带','维修','家政','保洁','搬家'], category: '房租' },
  { keywords: ['医院','诊所','体检','牙科','眼科','药房','药店','医保','挂号'], category: '医疗' },
  { keywords: ['书店','课程','培训','考试','报名','教材','知识付费','得到','知乎','Coursera','Udemy','阿里云','云计算'], category: '学习成长' },
  { keywords: ['红包','礼金','礼物','鲜花','转账','还款','信用卡还款','花呗还款'], category: '转账还款' },
  { keywords: ['服装','衣服','鞋','包','优衣库','ZARA','H&M','耐克','阿迪'], category: '衣服' },
  { keywords: ['宠物','猫粮','狗粮','猫砂','疫苗','驱虫','伴宠','猪咪'], category: '猪咪' },
];

const PAYMENT_RULES = [
  { keywords: ['微信支付','微信','WeChat Pay'], payment: '微信支付' },
  { keywords: ['支付宝','Alipay','花呗'], payment: '支付宝' },
  { keywords: ['招商银行','招行','掌上生活','储蓄卡','信用卡'], payment: '招商银行' },
  { keywords: ['现金','Cash'], payment: '现金' },
];

function runOCR(imagePath) {
  const swiftScript = path.resolve('scripts', 'ocr-screenshot.swift');
  return execSync(`swift "${swiftScript}" "${imagePath}"`, { encoding: 'utf-8', maxBuffer: 1024 * 1024 });
}

function classifyCategory(text) {
  for (const rule of CATEGORY_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.category;
    }
  }
  return '其他';
}

function classifyPayment(text) {
  for (const rule of PAYMENT_RULES) {
    for (const kw of rule.keywords) {
      if (text.includes(kw)) return rule.payment;
    }
  }
  return '其他';
}

function parseDateLabel(label) {
  const today = new Date();
  if (label === '今天') return new Date(today);
  if (label === '昨天') {
    const d = new Date(today);
    d.setDate(d.getDate() - 1);
    return d;
  }
  // MM.DD
  const md = label.match(/(\d{1,2})\.(\d{1,2})/);
  if (md) {
    const d = new Date(today.getFullYear(), parseInt(md[1], 10) - 1, parseInt(md[2], 10));
    return d;
  }
  return today;
}

function parseAmount(text) {
  const m = text.match(/-?[¥￥]\s*(\d{1,6}(?:,\d{3})*(?:\.\d{1,2})?)/);
  if (m) return parseFloat(m[1].replace(/,/g, ''));
  return null;
}

function isExcluded(text) {
  return /不计入|月月存|开户起息|定期存入|理财购买|基金定投|转入余额宝|信用卡还款/.test(text);
}

function parseTransactions(ocrText) {
  const lines = ocrText.split('\n').map(l => l.trim()).filter(Boolean);
  const transactions = [];

  // 策略：识别日期标签，然后在其后找到 (商家名, 金额) 对
  let currentDateLabel = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // 日期标签
    if (/^(今天|昨天|\d{1,2}\.\d{1,2}|\d{4}\.\d{1,2}\.\d{1,2})$/.test(line)) {
      currentDateLabel = line;
      continue;
    }

    // 金额行（以 ¥ 或 ￥ 开头，通常带负号）
    const amount = parseAmount(line);
    if (amount !== null && currentDateLabel) {
      // 向前找商家名：跳过图标、卡号、时间、余额等辅助信息
      let merchant = '未知商家';
      for (let j = i - 1; j >= 0; j--) {
        const prev = lines[j];
        // 跳过日期标签、卡号时间行、余额行、纯数字时间、已用作商家的行
        if (/^(今天|昨天|\d{1,2}\.\d{1,2}|\d{4}\.\d{1,2}\.\d{1,2})$/.test(prev)) break;
        if (/储蓄卡|信用卡|余额:|交易成功|状态:|\d{2}:\d{2}$|^\d{4}$/.test(prev)) continue;
        if (parseAmount(prev) !== null) continue; // 跳过其他金额
        if (prev.length > 1 && prev.length <= 40) {
          merchant = prev;
          break;
        }
      }

      // 收集上下文用于分类和过滤
      const contextLines = lines.slice(Math.max(0, i - 4), Math.min(lines.length, i + 3));
      const context = contextLines.join(' ');

      if (isExcluded(context)) {
        console.log(`  过滤定存/转账: ${merchant} ¥${amount.toFixed(2)}`);
        continue;
      }

      const date = parseDateLabel(currentDateLabel);
      transactions.push({
        date: date.toISOString().split('T')[0],
        dateTimestamp: date.getTime(),
        merchant,
        amount,
        category: classifyCategory(merchant + ' ' + context),
        payment: classifyPayment(context),
        context,
      });
      continue;
    }
  }

  // 如果上面的策略没找到，尝试支付宝/微信的简化模式：商家 + 金额 交替出现
  if (transactions.length === 0) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const amount = parseAmount(line);
      if (amount !== null) {
        let merchant = '未知商家';
        for (let j = i - 1; j >= 0; j--) {
          const prev = lines[j];
          if (/^\d{2}:\d{2}$/.test(prev) || /交易成功|状态|余额/.test(prev)) continue;
          if (prev.length > 1 && prev.length <= 40) {
            merchant = prev;
            break;
          }
        }
        const contextLines = lines.slice(Math.max(0, i - 3), Math.min(lines.length, i + 2));
        const context = contextLines.join(' ');
        if (isExcluded(context)) continue;
        transactions.push({
          date: new Date().toISOString().split('T')[0],
          dateTimestamp: new Date().getTime(),
          merchant,
          amount,
          category: classifyCategory(merchant + ' ' + context),
          payment: classifyPayment(context),
          context,
        });
      }
    }
  }

  return transactions;
}

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

async function batchCreateRecords(token, tableId, records) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/batch_create`;
  const res = await axios.post(
    url,
    { records },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  if (res.data.code !== 0) throw new Error(`批量写入失败: ${res.data.msg}`);
  return res.data.data;
}

async function main() {
  if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
    console.log(`已创建截图目录: ${SCREENSHOTS_DIR}`);
    console.log('请将消费截图放入该目录后重新运行脚本。');
    return;
  }

  const files = fs
    .readdirSync(SCREENSHOTS_DIR)
    .filter((f) => /\.(png|jpg|jpeg|heic)$/i.test(f))
    .sort();

  if (files.length === 0) {
    console.log(`截图目录为空: ${SCREENSHOTS_DIR}`);
    console.log('请放入消费截图后重新运行。');
    return;
  }

  console.log(`发现 ${files.length} 张截图，开始 OCR 识别...\n`);

  const allTransactions = [];

  for (const file of files) {
    const imagePath = path.join(SCREENSHOTS_DIR, file);
    console.log(`处理: ${file}`);
    let ocrText;
    try {
      ocrText = runOCR(imagePath);
    } catch (err) {
      console.error(`  -> OCR 失败: ${err.message}`);
      continue;
    }

    const transactions = parseTransactions(ocrText);
    console.log(`  识别到 ${transactions.length} 笔交易`);
    for (const t of transactions) {
      console.log(`    ${t.date} | ${t.merchant} | ¥${t.amount.toFixed(2)} | ${t.category} | ${t.payment}`);
    }
    console.log('');

    for (const t of transactions) {
      allTransactions.push({
        file,
        fields: {
          日期: t.dateTimestamp,
          '消费场景/商家': t.merchant,
          金额: t.amount,
          币种: 'CNY',
          分类: t.category,
          支付方式: t.payment,
          原始截图: file,
          OCR原文: t.context.substring(0, 500),
          备注: '',
        },
      });
    }
  }

  if (allTransactions.length === 0) {
    console.log('没有成功识别的交易记录。');
    return;
  }

  // 写入飞书
  const token = await getTenantAccessToken();
  const tables = await listTables(token);
  const targetTable = tables.find((t) => t.name === '每日消费明细');
  if (!targetTable) {
    console.error('错误：未找到「每日消费明细」表');
    process.exit(1);
  }

  const recordsToCreate = allTransactions.map((r) => ({ fields: r.fields }));
  await batchCreateRecords(token, targetTable.table_id, recordsToCreate);
  console.log(`✅ 已同步 ${recordsToCreate.length} 条记录到飞书「每日消费明细」\n`);

  // 汇总分析
  const total = allTransactions.reduce((sum, r) => sum + (r.fields.金额 || 0), 0);
  const categoryMap = {};
  for (const r of allTransactions) {
    const c = r.fields.分类;
    categoryMap[c] = (categoryMap[c] || 0) + (r.fields.金额 || 0);
  }

  console.log('=== 本次消费汇总 ===');
  console.log(`总消费: ¥${total.toFixed(2)} (${allTransactions.length} 笔)`);
  console.log('分类 breakdown:');
  for (const [cat, amt] of Object.entries(categoryMap).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat}: ¥${amt.toFixed(2)}`);
  }

  // 简单理财建议
  console.log('\n=== 理财建议 ===');
  const dailyBudget = 100; // 日均日常消费预算
  const days = new Set(allTransactions.map(r => r.fields.日期)).size || 1;
  const dailyAvg = total / days;
  const projectedMonthly = dailyAvg * 30;
  console.log(`日均消费: ¥${dailyAvg.toFixed(2)}`);
  console.log(`按此推算月日常消费: ¥${projectedMonthly.toFixed(2)}`);
  if (projectedMonthly > 3000) {
    console.log(`⚠️  推算月日常消费 ¥${projectedMonthly.toFixed(2)} 较高，建议关注 ${Object.entries(categoryMap).sort((a,b)=>b[1]-a[1])[0][0]} 类支出。`);
  } else {
    console.log(`✅ 消费控制良好，推算月日常消费在预算范围内。`);
  }
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  if (err.response?.data) {
    console.error('飞书 API 返回:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
