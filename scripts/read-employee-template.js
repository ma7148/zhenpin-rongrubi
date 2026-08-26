import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = 'C:\\Users\\71486\\Desktop\\臻品足道员工信息模板.xlsx';

console.log('=== 读取臻品足道员工信息模板 ===\n');

try {
  const workbook = XLSX.readFile(filePath);
  
  console.log(`工作表数量: ${workbook.SheetNames.length}`);
  console.log(`工作表名称: ${workbook.SheetNames.join(', ')}\n`);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- 工作表: "${sheetName}" ---`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) {
      console.log('  空工作表');
      return;
    }
    
    // 显示表头
    console.log('表头:', jsonData[0]);
    
    // 查找关键列
    const headerRow = jsonData[0];
    let nameCol = -1;
    let idNumberCol = -1;
    let storeCol = -1;
    let hireDateCol = -1;
    
    headerRow.forEach((col, idx) => {
      const colStr = col ? col.toString().trim() : '';
      if (colStr.includes('姓名') || colStr === '名字') {
        nameCol = idx;
      }
      if (colStr.includes('身份证') || colStr.includes('身份证号')) {
        idNumberCol = idx;
      }
      if (colStr.includes('门店') || colStr.includes('所属门店') || colStr === '店名') {
        storeCol = idx;
      }
      if (colStr.includes('入职') || colStr.includes('入职时间') || colStr.includes('入职日期')) {
        hireDateCol = idx;
      }
    });
    
    console.log(`姓名列: ${nameCol !== -1 ? `第${nameCol + 1}列` : '未找到'}`);
    console.log(`身份证号列: ${idNumberCol !== -1 ? `第${idNumberCol + 1}列` : '未找到'}`);
    console.log(`门店列: ${storeCol !== -1 ? `第${storeCol + 1}列` : '未找到'}`);
    console.log(`入职日期列: ${hireDateCol !== -1 ? `第${hireDateCol + 1}列` : '未找到'}`);
    
    // 显示所有数据
    console.log(`\n数据行数: ${jsonData.length - 1}`);
    console.log('\n员工信息:');
    for (let i = 1; i < jsonData.length; i++) {
      const row = jsonData[i];
      const name = nameCol !== -1 ? row[nameCol] : '';
      const idNumber = idNumberCol !== -1 ? row[idNumberCol] : '';
      const store = storeCol !== -1 ? row[storeCol] : '';
      const hireDate = hireDateCol !== -1 ? row[hireDateCol] : '';
      
      if (name) {
        console.log(`  ${i}. ${name} | 身份证: ${idNumber || '无'} | 门店: ${store || '无'} | 入职: ${hireDate || '无'}`);
      }
    }
  });
} catch (err) {
  console.error('读取文件失败:', err.message);
}
