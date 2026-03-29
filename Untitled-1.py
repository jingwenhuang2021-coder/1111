#!/usr/bin/env python3
# 用途：为每个YouTuber创建飞书多维表格并导入数据
# 参数：--input <path> --app-id <id> --app-secret <secret> --folder-id <folder>
# 输出：创建结果摘要和表格URLs
# 退出码：0=成功，1=失败
# Known Issues：飞书表格创建后无法直接修改结构，需手动添加视图

import argparse
import json
import sys
import requests
from datetime import datetime

class FeishuClient:
    def __init__(self, app_id, app_secret):
        self.app_id = app_id
        self.app_secret = app_secret
        self.token = None
        self.base_url = "https://open.feishu.cn/open-apis"
        self._get_token()
    
    def _get_token(self):
        """获取飞书API Token"""
        url = f"{self.base_url}/auth/v3/tenant_access_token/internal"
        payload = {
            "app_id": self.app_id,
            "app_secret": self.app_secret
        }
        response = requests.post(url, json=payload)
        data = response.json()
        if data.get('code') == 0:
            self.token = data['tenant_access_token']
            print("✓ Feishu token acquired")
        else:
            raise Exception(f"Failed to get token: {data}")
    
    def _get_headers(self):
        """获取API请求头"""
        return {
            "Authorization": f"Bearer {self.token}",
            "Content-Type": "application/json"
        }
    
    def create_table(self, folder_id, table_name):
        """创建多维表格"""
        url = f"{self.base_url}/sheets/v3/spreadsheets"
        payload = {
            "title": table_name,
            "folder_token": folder_id
        }
        response = requests.post(url, json=payload, headers=self._get_headers())
        data = response.json()
        
        if data.get('code') == 0:
            spreadsheet = data['data']['spreadsheet']
            return spreadsheet['spreadsheet_token']
        else:
            raise Exception(f"Failed to create table: {data}")
    
    def add_sheet(self, spreadsheet_token, title):
        """为表格添加sheet"""
        url = f"{self.base_url}/sheets/v3/spreadsheets/{spreadsheet_token}/sheets"
        payload = {
            "requests": [{
                "addSheet": {
                    "properties": {
                        "title": title
                    }
                }
            }]
        }
        response = requests.post(url, json=payload, headers=self._get_headers())
        data = response.json()
        
        if data.get('code') == 0:
            return data['data']['replies'][0]['addSheet']['properties']['sheetId']
        else:
            raise Exception(f"Failed to add sheet: {data}")
    
    def insert_rows(self, spreadsheet_token, sheet_id, rows):
        """插入行数据"""
        if not rows:
            return
        
        # 准备插入的数据
        values = []
        for row in rows:
            values.append([row['title'], row['url'], row['published_at']])
        
        url = f"{self.base_url}/sheets/v3/spreadsheets/{spreadsheet_token}/values"
        payload = {
            "valueRange": {
                "range": f"'{sheet_id}'!A1",
                "values": values
            }
        }
        response = requests.put(url, json=payload, headers=self._get_headers())
        data = response.json()
        
        if data.get('code') != 0:
            raise Exception(f"Failed to insert rows: {data}")

def create_tables(input_path, app_id, app_secret, folder_id):
    """创建飞书表格"""
    try:
        with open(input_path, 'r', encoding='utf-8') as f:
            grouped_data = json.load(f)
        
        client = FeishuClient(app_id, app_secret)
        results = []
        
        for youtuber_channel, languages_data in grouped_data.items():
            print(f"\nProcessing: {youtuber_channel}")
            
            # 创建表格
            table_name = f"{youtuber_channel} - antigravity a1 & avata360"
            spreadsheet_token = client.create_table(folder_id, table_name)
            print(f"  ✓ Table created: {spreadsheet_token}")
            
            # 为每种语言创建sheet并导入数据
            for language, videos in languages_data.items():
                sheet_id = client.add_sheet(spreadsheet_token, language)
                client.insert_rows(spreadsheet_token, sheet_id, videos)
                print(f"  ✓ Sheet '{language}' added with {len(videos)} videos")
            
            table_url = f"https://my.feishu.cn/sheets/{spreadsheet_token}"
            results.append({
                'youtuber': youtuber_channel,
                'table_url': table_url,
                'videos_count': sum(len(v) for v in languages_data.values())
            })
        
        # 输出摘要
        print(f"\n✓ Successfully created {len(results)} tables")
        for result in results:
            print(f"  - {result['youtuber']}: {result['videos_count']} videos")
            print(f"    {result['table_url']}")
        
        return 0
        
    except Exception as e:
        print(f"✗ Error: {e}")
        return 1

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--input', required=True, help='Input JSON path')
    parser.add_argument('--app-id', required=True, help='Feishu App ID')
    parser.add_argument('--app-secret', required=True, help='Feishu App Secret')
    parser.add_argument('--folder-id', required=True, help='Feishu Folder ID')
    args = parser.parse_args()
    
    sys.exit(create_tables(args.input, args.app_id, args.app_secret, args.folder_id))
    