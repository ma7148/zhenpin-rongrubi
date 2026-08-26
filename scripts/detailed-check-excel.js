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

console.log('=== 详细检查所有Excel文件 ===\n');

files.forEach((file, fileIdx) => {
  console.log(`\n[${fileIdx + 1}/${files.length}] 文件: ${file}`);
  const filePath = path.join(folderPath, file);
  
  try {
    const workbook = XLSX.readFile(filePath);
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length === 0) return;
      
      console.log(`\n  工作表: "${sheetName}" (${jsonData.length}行)`);
      
      // 显示表头
      if (jsonData.length > 0) {
        console.log(`  表头: ${JSON.stringify(jsonData[0])}`);
      }
      
      // 检查每一行
      let foundRecords = [];
      jsonData.forEach((row, rowIdx) => {
        if (!row || row.length < 2) return;
        
        // 查找姓名和身份证号
        const name = row[0];
        const idNumber = row[1];
        
        // 检查是否包含总监姓名或看起来像身份证号的字段
        const isDirector = directors.includes(name);
        const hasIdNumber = idNumber && typeof idNumber === 'string' && idNumber.length >= 15;
        
        if (isDirector || (hasIdNumber && rowIdx < 10)) { // 显示前10行有身份证的记录
          foundRecords.push({
            row: rowIdx + 1,
            name: name,
            idNumber: idNumber,
            isDirector: isDirector,
            hasIdNumber: hasIdNumber,
            fullRow: row.slice(0, 8)
          });
        }
      });
      
      if (foundRecords.length > 0) {
        console.log(`  找到 ${foundRecords.length} 条相关记录:`);
        foundRecords.forEach(fr => {
          const marker = fr.isDirector ? '【总监】' : (fr.hasIdNumber ? '【有身份证】' : '');
          console.log(`    行${fr.row}: ${marker} 姓名=${fr.name}, 身份证=${fr.idNumber || '无'}`);
          console.log(`      完整数据: ${JSON.stringify(fr.fullRow)}`);
        });
      }
    });
  } catch (err) {
    console.log(`  ✗ 读取失败: ${err.message}`);
  }
});
