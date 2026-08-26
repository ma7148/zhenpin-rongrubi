import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const folderPath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

// 9位总监名单
const directors = [
  '姜龙', '李双江', '全垚', '马良成', 
  '周杰', '邓慧清', '柳江琴', '黄蓓丽', '魏艾梅'
];

console.log('=== 检查所有Excel文件中的总监记录 ===\n');

files.forEach((file, fileIdx) => {
  console.log(`\n[${fileIdx + 1}/${files.length}] 文件: ${file}`);
  const filePath = path.join(folderPath, file);
  
  try {
    const workbook = XLSX.readFile(filePath);
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      // 检查每一行是否包含总监姓名
      let foundDirectors = [];
      jsonData.forEach((row, rowIdx) => {
        if (!row) return;
        const rowStr = JSON.stringify(row);
        directors.forEach(director => {
          if (rowStr.includes(director)) {
            foundDirectors.push({ name: director, row: rowIdx + 1, data: row.slice(0, 5) });
          }
        });
      });
      
      if (foundDirectors.length > 0) {
        console.log(`  ✓ 工作表 "${sheetName}" 找到 ${foundDirectors.length} 条总监记录:`);
        foundDirectors.forEach(fd => {
          console.log(`    - ${fd.name} (行${fd.row}): ${JSON.stringify(fd.data)}`);
        });
      }
    });
  } catch (err) {
    console.log(`  ✗ 读取失败: ${err.message}`);
  }
});
