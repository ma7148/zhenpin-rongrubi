import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE_URL = 'http://localhost:3002';

async function main() {
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin', password: 'admin123'
  });
  const token = loginRes.data.token;
  const headers = { 'Authorization': `Bearer ${token}` };

  const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\2026年1-6月月份管理层荣辱榜.xls';
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  const previewRes = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
    headers: { ...formData.getHeaders(), ...headers }
  });
  const { importId, stats } = previewRes.data;
  console.log(`解析: ${stats.totalRecords}条记录, ${stats.totalItems}条明细, ${stats.newEmployees}新员工`);
  console.log(`门店: ${stats.stores.join(', ')}`);

  const confirmRes = await axios.post(`${BASE_URL}/api/import/confirm`, { importId }, { headers });
  console.log(`✅ ${confirmRes.data.message}`);
}

main().catch(err => console.error('Error:', err.response?.data || err.message));
