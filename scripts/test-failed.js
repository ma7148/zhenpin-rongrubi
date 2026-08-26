import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3002';
const BASE = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';

const FAILED_FILES = [
  '钟家村店管理层荣辱榜.docx',
  '柳江琴\\工作失职&违规扣分登记表-2026.xlsx',
  '柳江琴\\杨家湾店1-5月扣分记录.xls',
  '柳江琴\\王家湾店管理层扣分明细.xlsx',
];

async function test() {
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin', password: 'admin123'
  });
  const token = loginRes.data.token;
  const headers = { 'Authorization': `Bearer ${token}` };

  for (const relPath of FAILED_FILES) {
    const fullPath = path.join(BASE, relPath);
    console.log(`\n=== ${relPath} ===`);
    
    if (!fs.existsSync(fullPath)) {
      console.log('  文件不存在');
      continue;
    }

    const formData = new FormData();
    formData.append('file', fs.createReadStream(fullPath));

    try {
      const res = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
        headers: { ...formData.getHeaders(), ...headers }
      });

      console.log(`  统计: ${res.data.stats.totalRecords}条记录, ${res.data.stats.totalItems}条明细`);
      console.log(`  门店: ${res.data.stats.stores.join(', ')}`);
      
      res.data.records.slice(0, 3).forEach((r, i) => {
        console.log(`  记录${i+1}: ${r.store}/${r.name}/${r.month}`);
        r.items.slice(0, 2).forEach(item => {
          console.log(`    [${item.type}] ${item.title} ${item.description}`);
        });
      });
    } catch (err) {
      console.log(`  ❌ ${err.response?.data?.error || err.message}`);
    }
  }
}

test().catch(console.error);
