#!/usr/bin/env node
// 用途：在飞书多维表格中创建「每日消费明细」表
// 参数：无（依赖环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN）

import axios from 'axios';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('错误：请设置环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN');
  process.exit(1);
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

async function createTable(token, name, fields) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables`;
  const res = await axios.post(
    url,
    { table: { name, fields } },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  if (res.data.code !== 0) throw new Error(`创建表 "${name}" 失败: ${res.data.msg}`);
  return res.data.data;
}

function opt(name, color = 0) {
  return { name, color };
}

async function main() {
  const token = await getTenantAccessToken();
  const tables = await listTables(token);
  const existing = tables.find((t) => t.name === '每日消费明细');
  if (existing) {
    console.log(`表 "每日消费明细" 已存在: ${existing.table_id}`);
    return;
  }

  const created = await createTable(token, '每日消费明细', [
    { field_name: '日期', type: 5 },
    { field_name: '消费场景/商家', type: 1 },
    { field_name: '金额', type: 2 },
    { field_name: '币种', type: 3, property: { options: [opt('CNY', 1), opt('HKD', 2), opt('USD', 3)] } },
    { field_name: '分类', type: 3, property: { options: [
      opt('餐饮美食', 1), opt('交通出行', 2), opt('日用购物', 3),
      opt('休闲娱乐', 4), opt('住房物业', 5), opt('医疗健康', 6),
      opt('学习成长', 7), opt('人情往来', 8), opt('转账还款', 9), opt('其他', 10)
    ] } },
    { field_name: '支付方式', type: 3, property: { options: [
      opt('微信支付', 1), opt('支付宝', 2), opt('招商银行', 3), opt('现金', 4), opt('其他', 5)
    ] } },
    { field_name: '原始截图', type: 1 },
    { field_name: 'OCR原文', type: 1 },
    { field_name: '备注', type: 1 },
  ]);

  console.log(`✅ 创建表 "每日消费明细": ${created.table_id}`);
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  if (err.response?.data) {
    console.error('飞书 API 返回:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
