#!/usr/bin/env node
// 用途：抓取 YouTube 上与 antigravity A1 / Avata360 相关的视频，按西班牙语和意大利语分类
// 参数：无（依赖环境变量 YOUTUBE_API_KEY）
// 输出：.tmp/youtube-videos-[timestamp].xlsx
// 退出码：0=执行成功，1=执行失败
// Known Issues：YouTube Data API 每日配额有限（搜索约 100 单位/次）；部分视频可能未标记 defaultAudioLanguage

import { google } from 'googleapis';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const API_KEY = process.env.YOUTUBE_API_KEY;
if (!API_KEY) {
  console.error('错误：请设置环境变量 YOUTUBE_API_KEY');
  process.exit(1);
}

const KEYWORDS = ['antigravity A1', 'Avata360'];
const LANGUAGES = [
  { code: 'es', name: '西班牙语' },
  { code: 'it', name: '意大利语' }
];
const MAX_RESULTS_PER_QUERY = 50;

const youtube = google.youtube({ version: 'v3', auth: API_KEY });

async function searchVideos(keyword, relevanceLanguage) {
  const results = [];
  let pageToken = null;
  let fetched = 0;

  while (fetched < MAX_RESULTS_PER_QUERY) {
    const remaining = MAX_RESULTS_PER_QUERY - fetched;
    const pageSize = remaining > 50 ? 50 : remaining;

    const res = await youtube.search.list({
      part: ['snippet'],
      q: keyword,
      type: ['video'],
      relevanceLanguage,
      maxResults: pageSize,
      pageToken: pageToken || undefined,
    });

    const items = res.data.items || [];
    if (items.length === 0) break;

    results.push(...items);
    fetched += items.length;

    pageToken = res.data.nextPageToken;
    if (!pageToken) break;
  }

  return results;
}

async function fetchVideoDetails(videoIds) {
  if (videoIds.length === 0) return {};
  const details = {};

  // 每批最多 50 个
  for (let i = 0; i < videoIds.length; i += 50) {
    const batch = videoIds.slice(i, i + 50);
    const res = await youtube.videos.list({
      part: ['snippet'],
      id: batch,
    });

    for (const item of res.data.items || []) {
      details[item.id] = item.snippet;
    }
  }

  return details;
}

async function main() {
  const tmpDir = path.resolve('.tmp');
  if (!fs.existsSync(tmpDir)) {
    fs.mkdirSync(tmpDir, { recursive: true });
  }

  const allRows = [];
  const seenVideoIds = new Set();

  for (const keyword of KEYWORDS) {
    for (const lang of LANGUAGES) {
      console.log(`正在搜索: "${keyword}" [${lang.name}] ...`);
      const searchResults = await searchVideos(keyword, lang.code);
      console.log(`  -> 获取到 ${searchResults.length} 条结果`);

      const videoIds = searchResults.map((item) => item.id.videoId).filter(Boolean);
      const details = await fetchVideoDetails(videoIds);

      for (const item of searchResults) {
        const videoId = item.id.videoId;
        if (!videoId || seenVideoIds.has(videoId)) continue;
        seenVideoIds.add(videoId);

        const snippet = details[videoId] || item.snippet;
        const channelId = snippet.channelId;

        allRows.push({
          关键词: keyword,
          语言分类: lang.name,
          视频标题: snippet.title,
          视频链接: `https://www.youtube.com/watch?v=${videoId}`,
          频道名称: snippet.channelTitle,
          频道链接: channelId ? `https://www.youtube.com/channel/${channelId}` : '',
          发布日期: snippet.publishedAt ? snippet.publishedAt.split('T')[0] : '',
          视频描述: snippet.description ? snippet.description.substring(0, 200) : '',
          API语言标记: snippet.defaultAudioLanguage || snippet.defaultLanguage || '',
        });
      }
    }
  }

  if (allRows.length === 0) {
    console.log('未找到任何视频。');
    process.exit(0);
  }

  const worksheet = XLSX.utils.json_to_sheet(allRows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Videos');

  // 自动调整列宽
  const colWidths = [
    { wch: 18 },  // 关键词
    { wch: 10 },  // 语言分类
    { wch: 50 },  // 视频标题
    { wch: 45 },  // 视频链接
    { wch: 25 },  // 频道名称
    { wch: 45 },  // 频道链接
    { wch: 12 },  // 发布日期
    { wch: 60 },  // 视频描述
    { wch: 10 },  // API语言标记
  ];
  worksheet['!cols'] = colWidths;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const outputPath = path.join(tmpDir, `youtube-videos-${timestamp}.xlsx`);
  XLSX.writeFile(workbook, outputPath);

  console.log(`\n✅ 完成！共抓取 ${allRows.length} 条视频。`);
  console.log(`📁 文件已保存: ${outputPath}`);
}

main().catch((err) => {
  console.error('执行出错:', err.message);
  process.exit(1);
});
