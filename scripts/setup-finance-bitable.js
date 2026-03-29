#!/usr/bin/env node
// 用途：在飞书多维表格中创建理财计划所需的 4 张数据表，并填入初始数据
// 参数：无（依赖环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN）
// 输出：stdout 返回创建结果
// 退出码：0=执行成功，1=执行失败

import axios from 'axios';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('错误：请设置环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN');
  process.exit(1);
}

// 汇率（估算值，可在表格中手动更新）
const RATES = { CNY: 1, HKD: 0.92, USD: 7.20 };

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

async function getOrCreateTable(token, name, fields) {
  const tables = await listTables(token);
  const existing = tables.find((t) => t.name === name);
  if (existing) {
    console.log(`表 "${name}" 已存在: ${existing.table_id}`);
    return existing;
  }
  const created = await createTable(token, name, fields);
  console.log(`创建表 "${name}": ${created.table_id}`);
  return created;
}

async function batchCreateRecords(token, tableId, records) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/batch_create`;
  console.log('POST', url);
  const res = await axios.post(
    url,
    { records },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  console.log('Response:', JSON.stringify(res.data, null, 2));
  if (res.data.code !== 0) throw new Error(`批量写入失败: ${res.data.msg}`);
  return res.data.data;
}

function opt(name, color = 0) {
  return { name, color };
}

async function main() {
  const token = await getTenantAccessToken();
  console.log('成功获取 tenant_access_token\n');

  const now = Date.now();

  // ================== 表 1：资产负债表 ==================
  const table1 = await getOrCreateTable(token, '资产负债表', [
    { field_name: '资产名称', type: 1 },
    { field_name: '币种', type: 3, property: { options: [opt('CNY', 1), opt('HKD', 2), opt('USD', 3)] } },
    { field_name: '金额', type: 2 },
    { field_name: '折合人民币', type: 2 },
    { field_name: '资产类型', type: 3, property: { options: [opt('流动', 4), opt('投资', 5), opt('锁定', 6)] } },
    { field_name: '账户位置', type: 1 },
    { field_name: '更新日期', type: 5 },
  ]);

  const records1 = [
    { fields: { '资产名称': '港币现金', '币种': 'HKD', '金额': 3000, '折合人民币': Math.round(3000 * RATES.HKD), '资产类型': '流动', '账户位置': '现金/钱包', '更新日期': now } },
    { fields: { '资产名称': '美股账户', '币种': 'USD', '金额': 1330, '折合人民币': Math.round(1330 * RATES.USD), '资产类型': '投资', '账户位置': '美股券商', '更新日期': now } },
    { fields: { '资产名称': '微信零钱', '币种': 'CNY', '金额': 770, '折合人民币': 770, '资产类型': '流动', '账户位置': '微信支付', '更新日期': now } },
    { fields: { '资产名称': '招行活期', '币种': 'CNY', '金额': 5115, '折合人民币': 5115, '资产类型': '流动', '账户位置': '招商银行', '更新日期': now } },
    { fields: { '资产名称': '招行定存', '币种': 'CNY', '金额': 4000, '折合人民币': 4000, '资产类型': '锁定', '账户位置': '招商银行', '更新日期': now } },
  ];
  console.log('写入资产负债表:', JSON.stringify(records1, null, 2));
  await batchCreateRecords(token, table1.table_id, records1);
  console.log('  -> 已写入 5 条资产记录\n');

  // ================== 表 2：月度收支流水 ==================
  const table2 = await getOrCreateTable(token, '月度收支流水', [
    { field_name: '月份', type: 1 },
    { field_name: '工资收入', type: 2 },
    { field_name: '到手收入', type: 2 },
    { field_name: '房租支出', type: 2 },
    { field_name: '硬性支出', type: 2 },
    { field_name: '定存', type: 2 },
    { field_name: '月度结余', type: 2 },
    { field_name: '备注', type: 1 },
  ]);

  await batchCreateRecords(token, table2.table_id, [
    { fields: { '月份': '2026-03', '工资收入': 14000, '到手收入': 12000, '房租支出': 3800, '硬性支出': 3000, '定存': 4000, '月度结余': 1200, '备注': '初始数据' } },
  ]);
  console.log('  -> 已写入 1 条月度记录\n');

  // ================== 表 3：理财目标追踪 ==================
  const table3 = await getOrCreateTable(token, '理财目标追踪', [
    { field_name: '目标名称', type: 1 },
    { field_name: '目标金额', type: 2 },
    { field_name: '当前进度', type: 2 },
    { field_name: '预计完成时间', type: 5 },
    { field_name: '状态', type: 3, property: { options: [opt('进行中', 1), opt('已完成', 2), opt('暂停', 3)] } },
  ]);

  await batchCreateRecords(token, table3.table_id, [
    { fields: { '目标名称': '应急金 2万', '目标金额': 20000, '当前进度': 8645, '预计完成时间': new Date('2026-06-30').getTime(), '状态': '进行中' } },
    { fields: { '目标名称': '总资产 10万', '目标金额': 100000, '当前进度': 22221, '预计完成时间': new Date('2027-11-30').getTime(), '状态': '进行中' } },
    { fields: { '目标名称': '美股定投积累', '目标金额': 50000, '当前进度': 9576, '预计完成时间': new Date('2028-06-30').getTime(), '状态': '进行中' } },
  ]);
  console.log('  -> 已写入 3 条目标记录\n');

  // ================== 表 4：资产配置看板 ==================
  const table4 = await getOrCreateTable(token, '资产配置看板', [
    { field_name: '资产类别', type: 1 },
    { field_name: '当前金额', type: 2 },
    { field_name: '当前占比(%)', type: 2 },
    { field_name: '目标占比(%)', type: 2 },
    { field_name: '调整建议', type: 1 },
  ]);

  await batchCreateRecords(token, table4.table_id, [
    { fields: { '资产类别': '流动资产', '当前金额': 8645, '当前占比(%)': 38.9, '目标占比(%)': 30, '调整建议': '已充足，维持即可' } },
    { fields: { '资产类别': '投资资产', '当前金额': 9576, '当前占比(%)': 43.1, '目标占比(%)': 40, '调整建议': '可每月定投100-200 USD' } },
    { fields: { '资产类别': '锁定资产', '当前金额': 4000, '当前占比(%)': 18.0, '目标占比(%)': 30, '调整建议': '继续每月定存4000，逐步提升' } },
  ]);
  console.log('  -> 已写入 3 条配置记录\n');

  console.log('✅ 理财表格搭建完成！');
  console.log('请在飞书中打开表格，进入「仪表盘」添加饼图/柱状图/进度条进行可视化。');
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  if (err.response?.data) {
    console.error('飞书 API 返回:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
