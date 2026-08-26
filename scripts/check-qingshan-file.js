import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\青山印象城店管理层履历表.xlsx';

console.log('=== 检查青山印象城店管理层履历表 ===\n');

try {
  const workbook = XLSX.readFile(filePath);
  
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n工作表: "${sheetName}"`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    if (jsonData.length === 0) return;
    
    // 显示表头
    console.log('表头:', jsonData[0]);
    
    // 查找关键列
    const headerRow = jsonData[0];
    let nameCol = -1;
    let hireDateCol = -1;
    let promotionDateCol = -1;
    
    headerRow.forEach((col, idx) => {
      const colStr = col ? col.toString().trim() : '';
      if (colStr.includes('姓名') || colStr.includes('名字')) {
        nameCol = idx;
      }
      if (colStr.includes('入职') || colStr.includes('入职时间') || colStr.includes('入职日期')) {
        hireDateCol = idx;
      }
      if (colStr.includes('提干') || colStr.includes('提拔') || colStr.includes('晋升') || colStr.includes('提干时间')) {
        promotionDateCol = idx;
      }
    });
    
    console.log(`姓名列: ${nameCol !== -1 ? `第${nameCol + 1}列` : '未找到'}`);
    console.log(`入职时间列: ${hireDateCol !== -1 ? `第${hireDateCol + 1}列` : '未找到'}`);
    console.log(`提干时间列: ${promotionDateCol !== -1 ? `第${promotionDateCol + 1}列` : '未找到'}`);
    
    // 显示前5行数据
    console.log('\n前5行数据示例:');
    for (let i = 1; i < Math.min(6, jsonData.length); i++) {
      const row = jsonData[i];
      const name = nameCol !== -1 ? row[nameCol] : row[0];
      const hireDate = hireDateCol !== -1 ? row[hireDateCol] : '';
      const promotionDate = promotionDateCol !== -1 ? row[promotionDateCol] : '';
      
      if (name) {
        console.log(`  ${i}. ${name} | 入职: ${hireDate || '无'} | 提干: ${promotionDate || '无'}`);
      }
    }
  });
} catch (err) {
  console.error('读取文件失败:', err.message);
}
