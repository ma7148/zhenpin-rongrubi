import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE_URL = 'http://localhost:3002';

async function test() {
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin', password: 'admin123'
  });
  const token = loginRes.data.token;
  const headers = { 'Authorization': `Bearer ${token}` };

  const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\2026年1-6月月份管理层荣辱榜.xls';
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const res = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
    headers: { ...formData.getHeaders(), ...headers }
  });

  console.log('=== 月度荣辱榜解析结果 ===');
  console.log('统计:', JSON.stringify(res.data.stats, null, 2));
  
  res.data.records.forEach((r, i) => {
    console.log(`\n记录 ${i+1}: ${r.store} / ${r.name} / ${r.month}`);
    r.items.forEach(item => {
      console.log(`  [${item.type}] ${item.title} ${item.description}`);
    });
  });
}

test().catch(err => console.error('Error:', err.response?.data || err.message));
