#!/usr/bin/env node
// 用途：将 .tmp 中最新生成的 YouTube 视频 Excel 数据同步到飞书多维表格
// 参数：无（依赖环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN）
// 输出：stdout 返回同步结果
// 退出码：0=执行成功，1=执行失败
// Known Issues：飞书 API 对 url 字段有特定格式要求；批量创建每次最多 500 条；需要应用被授权访问目标表格

import axios from 'axios';
import { read, utils } from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const APP_ID = process.env.FEISHU_APP_ID;
const APP_SECRET = process.env.FEISHU_APP_SECRET;
const APP_TOKEN = process.env.FEISHU_APP_TOKEN;

if (!APP_ID || !APP_SECRET || !APP_TOKEN) {
  console.error('错误：请设置环境变量 FEISHU_APP_ID、FEISHU_APP_SECRET、FEISHU_APP_TOKEN');
  process.exit(1);
}

const REQUIRED_FIELDS = [
  { name: '关键词', type: 1 },
  { name: '语言分类', type: 1 },
  { name: '视频标题', type: 1 },
  { name: '视频链接', type: 15 },
  { name: '频道名称', type: 1 },
  { name: '频道链接', type: 15 },
  { name: '发布日期', type: 1 },
  { name: '视频描述', type: 1 },
  { name: 'API语言标记', type: 1 },
];

async function getTenantAccessToken() {
  const url = 'https://open.feishu.cn/open-apis/auth/v3/tenant_access_token/internal';
  const res = await axios.post(url, {
    app_id: APP_ID,
    app_secret: APP_SECRET,
  });
  if (res.data.code !== 0) {
    throw new Error(`获取 tenant_access_token 失败: ${res.data.msg}`);
  }
  return res.data.tenant_access_token;
}

async function listTables(token) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.data.code !== 0) {
    throw new Error(`获取表格列表失败: ${res.data.msg}`);
  }
  return res.data.data.items;
}

async function listFields(token, tableId) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/fields`;
  const res = await axios.get(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.data.code !== 0) {
    throw new Error(`获取字段列表失败: ${res.data.msg}`);
  }
  return res.data.data.items;
}

async function createField(token, tableId, fieldName, fieldType) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/fields`;
  const res = await axios.post(
    url,
    { field_name: fieldName, type: fieldType },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  if (res.data.code !== 0) {
    throw new Error(`创建字段 "${fieldName}" 失败: ${res.data.msg}`);
  }
  return res.data.data;
}

async function batchCreateRecords(token, tableId, records) {
  const url = `https://open.feishu.cn/open-apis/bitable/v1/apps/${APP_TOKEN}/tables/${tableId}/records/batch_create`;
  const res = await axios.post(
    url,
    { records },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  if (res.data.code !== 0) {
    throw new Error(`批量创建记录失败: ${res.data.msg}`);
  }
  return res.data.data;
}

function buildUrlField(value) {
  if (!value) return '';
  return { text: value, link: value };
}

async function main() {
  // 1. 读取最新的 Excel 文件
  const tmpDir = path.resolve('.tmp');
  const files = fs
    .readdirSync(tmpDir)
    .filter((f) => f.startsWith('youtube-videos-') && f.endsWith('.xlsx'))
    .sort();
  if (files.length === 0) {
    console.error('错误：未找到生成的 Excel 文件');
    process.exit(1);
  }
  const latestFile = path.join(tmpDir, files[files.length - 1]);
  console.log(`读取文件: ${latestFile}`);

  const buf = fs.readFileSync(latestFile);
  const workbook = read(buf);
  const worksheet = workbook.Sheets[workbook.SheetNames[0]];
  const rows = utils.sheet_to_json(worksheet);
  console.log(`共读取 ${rows.length} 条记录`);

  // 2. 获取飞书 token
  const token = await getTenantAccessToken();
  console.log('成功获取 tenant_access_token');

  // 3. 获取表格列表
  const tables = await listTables(token);
  if (tables.length === 0) {
    console.error('错误：该多维表格中没有任何数据表');
    process.exit(1);
  }
  const targetTable = tables[0];
  console.log(`目标数据表: ${targetTable.table_id} (${targetTable.name})`);

  // 4. 获取现有字段并自动创建缺失字段
  const existingFields = await listFields(token, targetTable.table_id);
  const existingFieldNames = new Set(existingFields.map((f) => f.field_name));
  console.log('现有字段:', Array.from(existingFieldNames).join(', ') || '无');

  for (const req of REQUIRED_FIELDS) {
    if (!existingFieldNames.has(req.name)) {
      console.log(`创建字段: ${req.name} (类型 ${req.type})`);
      await createField(token, targetTable.table_id, req.name, req.type);
    }
  }

  // 5. 构造记录
  const records = rows.map((row) => {
    const fields = {
      关键词: row['关键词'] || '',
      语言分类: row['语言分类'] || '',
      视频标题: row['视频标题'] || '',
      视频链接: buildUrlField(row['视频链接']),
      频道名称: row['频道名称'] || '',
      频道链接: buildUrlField(row['频道链接']),
      发布日期: row['发布日期'] || '',
      视频描述: row['视频描述'] || '',
      'API语言标记': row['API语言标记'] || '',
    };
    return { fields };
  });

  // 6. 分批写入（每批 500 条）
  const batchSize = 500;
  let totalCreated = 0;
  for (let i = 0; i < records.length; i += batchSize) {
    const batch = records.slice(i, i + batchSize);
    const result = await batchCreateRecords(token, targetTable.table_id, batch);
    totalCreated += result.records?.length || 0;
    console.log(`已写入 ${totalCreated} / ${records.length} 条记录`);
  }

  console.log(`\n✅ 同步完成！共写入 ${totalCreated} 条记录到飞书多维表格。`);
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  if (err.response?.data) {
    console.error('飞书 API 返回:', JSON.stringify(err.response.data, null, 2));
  }
  process.exit(1);
});
