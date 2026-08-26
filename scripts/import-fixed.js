import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3002';
const BASE_DIR = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';

// 之前失败的4个文件中，3个已修复（钟家村店无数据跳过）
const FILES_TO_IMPORT = [
  '柳江琴\\工作失职&违规扣分登记表-2026.xlsx',
  '柳江琴\\杨家湾店1-5月扣分记录.xls',
  '柳江琴\\王家湾店管理层扣分明细.xlsx',
];

async function main() {
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin', password: 'admin123'
  });
  const token = loginRes.data.token;
  const headers = { 'Authorization': `Bearer ${token}` };

  let totalFiles = 0, totalRecords = 0, totalItems = 0, totalNewEmployees = 0;

  for (const relPath of FILES_TO_IMPORT) {
    const fullPath = path.join(BASE_DIR, relPath);
    if (!fs.existsSync(fullPath)) { console.log(`⚠ 文件不存在: ${relPath}`); continue; }

    console.log(`\n--- ${relPath} ---`);
    const formData = new FormData();
    formData.append('file', fs.createReadStream(fullPath));

    try {
      const previewRes = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
        headers: { ...formData.getHeaders(), ...headers }
      });
      const { importId, stats } = previewRes.data;
      console.log(`  ${stats.totalRecords}条记录, ${stats.totalItems}条明细, ${stats.newEmployees}新员工`);
      console.log(`  门店: ${stats.stores.join(', ')}`);

      const confirmRes = await axios.post(`${BASE_URL}/api/import/confirm`, { importId }, { headers });
      console.log(`  ✅ ${confirmRes.data.message}`);

      totalFiles++;
      totalRecords += stats.totalRecords;
      totalItems += stats.totalItems;
      totalNewEmployees += stats.newEmployees;
    } catch (err) {
      console.log(`  ❌ ${err.response?.data?.error || err.message}`);
    }
  }

  console.log(`\n=== 完成: ${totalFiles}文件, ${totalRecords}记录, ${totalItems}明细, ${totalNewEmployees}新员工 ===`);
}

main().catch(err => console.error('Error:', err.message));
