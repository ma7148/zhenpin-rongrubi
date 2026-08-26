// 测试导入API
import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';

const BASE_URL = 'http://localhost:3003';

async function test() {
  // 先登录
  const loginRes = await axios.post(`${BASE_URL}/api/auth/login`, {
    username: 'admin',
    password: 'admin123'
  });
  const token = loginRes.data.token;
  console.log('登录成功, token:', token.substring(0, 20) + '...');

  // 测试Excel文件解析
  const testFile = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\汉街店2026年1-6月荣辱明细.xlsx';
  
  const formData = new FormData();
  formData.append('file', fs.createReadStream(testFile));

  try {
    const previewRes = await axios.post(`${BASE_URL}/api/import/preview`, formData, {
      headers: {
        ...formData.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n=== 解析结果 ===');
    console.log('统计:', JSON.stringify(previewRes.data.stats, null, 2));
    console.log('\n记录数:', previewRes.data.records.length);
    
    // 显示前5条记录
    previewRes.data.records.slice(0, 5).forEach((r, i) => {
      console.log(`\n记录 ${i+1}:`);
      console.log(`  门店: ${r.store}`);
      console.log(`  姓名: ${r.name}`);
      console.log(`  月份: ${r.month}`);
      console.log(`  匹配: ${r.matchedEmployeeId ? '已匹配(ID:' + r.matchedEmployeeId + ')' : '新员工'}`);
      console.log(`  条目数: ${r.items.length}`);
      r.items.forEach((item, j) => {
        console.log(`    ${j+1}. [${item.type}] ${item.title}`);
      });
    });

    // 不实际导入，只测试预览
    console.log('\n=== 预览测试通过 ===');
  } catch (err) {
    console.error('预览失败:', err.response?.data || err.message);
  }

  // 测试Word文件
  const wordFile = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\范湖万达店管理层荣辱榜.docx';
  const wordForm = new FormData();
  wordForm.append('file', fs.createReadStream(wordFile));

  try {
    const wordRes = await axios.post(`${BASE_URL}/api/import/preview`, wordForm, {
      headers: {
        ...wordForm.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n=== Word文件解析结果 ===');
    console.log('统计:', JSON.stringify(wordRes.data.stats, null, 2));
    wordRes.data.records.slice(0, 3).forEach((r, i) => {
      console.log(`\n记录 ${i+1}:`);
      console.log(`  门店: ${r.store}`);
      console.log(`  姓名: ${r.name}`);
      console.log(`  月份: ${r.month}`);
      console.log(`  条目: ${r.items.map(it => it.title).join('; ')}`);
    });
  } catch (err) {
    console.error('Word预览失败:', err.response?.data || err.message);
  }

  // 测试矩阵式Excel
  const matrixFile = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\黄总\\2026年1-5月万象城店管理层扣分明细.xls';
  const matrixForm = new FormData();
  matrixForm.append('file', fs.createReadStream(matrixFile));

  try {
    const matrixRes = await axios.post(`${BASE_URL}/api/import/preview`, matrixForm, {
      headers: {
        ...matrixForm.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    console.log('\n=== 矩阵式Excel解析结果 ===');
    console.log('统计:', JSON.stringify(matrixRes.data.stats, null, 2));
    matrixRes.data.records.slice(0, 3).forEach((r, i) => {
      console.log(`\n记录 ${i+1}:`);
      console.log(`  门店: ${r.store}`);
      console.log(`  姓名: ${r.name}`);
      console.log(`  月份: ${r.month}`);
      console.log(`  条目数: ${r.items.length}`);
      r.items.forEach((item, j) => {
        console.log(`    ${j+1}. [${item.type}] ${item.title}`);
      });
    });
  } catch (err) {
    console.error('矩阵Excel预览失败:', err.response?.data || err.message);
  }
}

test().catch(console.error);
