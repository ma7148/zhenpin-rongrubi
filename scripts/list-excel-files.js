import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const folderPath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';

console.log('=== 文件夹中的Excel文件 ===');
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
files.forEach((file, idx) => {
  console.log(`${idx + 1}. ${file}`);
});

if (files.length === 0) {
  console.log('未找到Excel文件');
  process.exit(1);
}

// 读取第一个Excel文件
const firstFile = files[0];
const filePath = path.join(folderPath, firstFile);
console.log(`\n=== 读取文件: ${firstFile} ===`);

try {
  const workbook = XLSX.readFile(filePath);
  console.log(`工作表数量: ${workbook.SheetNames.length}`);
  console.log(`工作表名称: ${workbook.SheetNames.join(', ')}\n`);
  
  // 读取每个工作表的前几行
  workbook.SheetNames.forEach(sheetName => {
    console.log(`\n--- 工作表: ${sheetName} ---`);
    const worksheet = workbook.Sheets[sheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
    
    console.log(`总行数: ${jsonData.length}`);
    if (jsonData.length > 0) {
      console.log('前3行数据:');
      jsonData.slice(0, 3).forEach((row, idx) => {
        console.log(`  行${idx}: ${JSON.stringify(row.slice(0, 10))}`); // 只显示前10列
      });
    }
  });
} catch (err) {
  console.error('读取文件失败:', err.message);
}
