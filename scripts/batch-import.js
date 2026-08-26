import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:3002';
const BASE_DIR = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';

// 所有需要导入的文件（排除HTML和JSON备份文件）
const FILES_TO_IMPORT = [
  // 根目录Excel/Word
  '2026年1-6月月份管理层荣辱榜.xls',
  '2026年汉街精选工作失职&违规扣分登记表.xlsx',
  '汉街店2026年1-6月荣辱明细.xlsx',
  '江腾广场店工作失职&违规扣分登记表-2026.xlsx',
  '范湖万达店管理层荣辱榜.docx',
  '钟家村店管理层荣辱榜.docx',
  // 子目录
  '7月\\凯德管理层2026扣分明细.xls',
  '柳江琴\\工作失职&违规扣分登记表-2026.xlsx',
  '柳江琴\\杨家湾店1-5月扣分记录.xls',
  '柳江琴\\永旺店工作失职&违规扣分登记表-2025(1)(1)(1).xlsx',
  '柳江琴\\王家湾店管理层扣分明细.xlsx',
  '黄总\\2026年1-5月万象城店管理层扣分明细.xls',
  '黄总\\2026年1-5月武汉天地店管理层扣分明细.xls',
  '臻品足道荣辱榜\\融侨华府荣辱榜.docx',
];

async function main() {
  // 1. 登录
  console.log('=== 登录系统 ===');
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  const token = loginRes.data.token;
  console.log('登录成功');

  const headers = { 'Authorization': `Bearer ${token}` };

  let totalFiles = 0;
  let totalRecords = 0;
  let totalItems = 0;
  let totalNewEmployees = 0;
  const results = [];
  const errors = [];

  for (const relPath of FILES_TO_IMPORT) {
    const fullPath = path.join(BASE_DIR, relPath);
    
    if (!fs.existsSync(fullPath)) {
      console.log(`\n⚠ 文件不存在: ${relPath}`);
      errors.push({ file: relPath, error: '文件不存在' });
      continue;
    }

    console.log(`\n--- 处理: ${relPath} ---`);

    // 2. 预览解析
    const formData = new FormData();
    formData.append('file', fs.createReadStream(fullPath));

    try {
      const previewRes = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
        headers: { ...formData.getHeaders(), ...headers }
      });

      const { importId, records, stats } = previewRes.data;
      console.log(`  解析: ${stats.totalRecords}条记录, ${stats.totalItems}条明细, ${stats.newEmployees}新员工, ${stats.matchedEmployees}已匹配`);
      console.log(`  门店: ${stats.stores.join(', ')}`);

      // 3. 确认导入
      const confirmRes = await axios.post(`${BASE_URL}/api/import/confirm`, { importId }, { headers });
      console.log(`  ✅ ${confirmRes.data.message}`);

      totalFiles++;
      totalRecords += stats.totalRecords;
      totalItems += stats.totalItems;
      totalNewEmployees += stats.newEmployees;
      results.push({ file: relPath, stats, message: confirmRes.data.message });
    } catch (err) {
      const errorMsg = err.response?.data?.error || err.message;
      console.log(`  ❌ 失败: ${errorMsg}`);
      errors.push({ file: relPath, error: errorMsg });
    }
  }

  // 汇总
  console.log('\n\n========================================');
  console.log('=== 批量导入完成 ===');
  console.log('========================================');
  console.log(`成功导入文件: ${totalFiles} 个`);
  console.log(`总记录数: ${totalRecords} 条`);
  console.log(`总明细数: ${totalItems} 条`);
  console.log(`新建员工: ${totalNewEmployees} 人`);
  
  if (errors.length > 0) {
    console.log(`\n失败文件 (${errors.length}):`);
    errors.forEach(e => console.log(`   ${e.file}: ${e.error}`));
  }

  console.log('\n详细结果:');
  results.forEach(r => {
    console.log(`  ✅ ${r.file}`);
    console.log(`     ${r.message}`);
  });
}

main().catch(err => {
  console.error('批量导入失败:', err.message);
  process.exit(1);
});
