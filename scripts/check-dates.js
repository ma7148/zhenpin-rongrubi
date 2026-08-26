import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const folderPath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

console.log('=== 检查Excel文件中的提干时间和入职时间 ===\n');

files.forEach((file, fileIdx) => {
  console.log(`\n[${fileIdx + 1}/${files.length}] 文件: ${file}`);
  const filePath = path.join(folderPath, file);
  
  try {
    const workbook = XLSX.readFile(filePath);
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) return;
      
      // 查找包含"提干"或"入职"的列
      const headerRow = jsonData[0];
      let tianganCol = -1;
      let ruzhiCol = -1;
      
      headerRow.forEach((col, idx) => {
        if (col && (col.toString().includes('提干') || col.toString().includes('提拔'))) {
          tianganCol = idx;
        }
        if (col && (col.toString().includes('入职') || col.toString().includes('入职时间'))) {
          ruzhiCol = idx;
        }
      });
      
      if (tianganCol !== -1 || ruzhiCol !== -1) {
        console.log(`  工作表: "${sheetName}"`);
        if (tianganCol !== -1) {
          console.log(`    ✓ 找到提干时间列 (第${tianganCol + 1}列)`);
        }
        if (ruzhiCol !== -1) {
          console.log(`    ✓ 找到入职时间列 (第${ruzhiCol + 1}列)`);
        }
        
        // 显示前几行数据示例
        console.log(`    数据示例:`);
        for (let i = 1; i < Math.min(4, jsonData.length); i++) {
          const row = jsonData[i];
          const name = row[0] || '';
          const tiangan = tianganCol !== -1 ? row[tianganCol] : '';
          const ruzhi = ruzhiCol !== -1 ? row[ruzhiCol] : '';
          if (name) {
            console.log(`      ${name}: 提干=${tiangan || '无'}, 入职=${ruzhi || '无'}`);
          }
        }
      }
    });
  } catch (err) {
    console.log(`  ✗ 读取失败: ${err.message}`);
  }
});

console.log('\n=== 检查完成 ===');
