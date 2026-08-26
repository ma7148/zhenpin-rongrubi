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

  // 测试文件
  const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\7月\\凯德管理层2026扣分明细.xls';
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  console.log('1. 预览解析...');
  const previewRes = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
    headers: { ...formData.getHeaders(), ...headers }
  });
  const { importId, stats } = previewRes.data;
  console.log(`   ${stats.totalRecords}条记录, ${stats.totalItems}条明细`);

  console.log('2. 确认导入（将自动发送邮件）...');
  const confirmRes = await axios.post(`${BASE_URL}/api/import/confirm`, { importId }, { headers });
  console.log(`   ${confirmRes.data.message}`);

  console.log('\n✅ 测试完成！请检查139邮箱是否收到邮件');
}

test().catch(err => console.error('Error:', err.response?.data || err.message));
