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

  console.log('=== 测试新流程：导入 → 审核 → 发送邮件 ===\n');

  // 1. 上传并预览
  const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\7月\\凯德管理层2026扣分明细.xls';
  const formData = new FormData();
  formData.append('file', fs.createReadStream(filePath));

  console.log('1. 上传文件并预览...');
  const previewRes = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
    headers: { ...formData.getHeaders(), ...headers }
  });
  const { importId, stats } = previewRes.data;
  console.log(`   解析完成: ${stats.totalRecords}条记录\n`);

  // 2. 确认导入（应该保存为pending状态）
  console.log('2. 确认导入（数据保存为待审核状态）...');
  const confirmRes = await axios.post(`${BASE_URL}/api/import/confirm`, { importId }, { headers });
  console.log(`   ${confirmRes.data.message}\n`);

  // 3. 查询待审核记录
  console.log('3. 查询待审核记录...');
  const pendingRes = await axios.get(`${BASE_URL}/api/records?status=pending`, { headers });
  const pendingRecords = pendingRes.data.records || [];
  console.log(`   待审核记录: ${pendingRecords.length}条\n`);

  if (pendingRecords.length > 0) {
    // 4. 审核通过第一条记录
    const firstRecord = pendingRecords[0];
    console.log(`4. 审核通过记录: ${firstRecord.employee_name} - ${firstRecord.month}...`);
    const approveRes = await axios.post(`${BASE_URL}/api/records/${firstRecord.id}/approve`, {}, { headers });
    console.log(`   ${approveRes.data.message}\n`);

    console.log('✅ 测试完成！请检查139邮箱是否收到审核通过的邮件');
  } else {
    console.log('⚠️ 没有待审核记录');
  }
}

test().catch(err => console.error('Error:', err.response?.data || err.message));
