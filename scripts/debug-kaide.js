import XLSX from 'xlsx';

const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\7月\\凯德管理层2026扣分明细.xls';
const workbook = XLSX.readFile(filePath);

workbook.SheetNames.forEach(sheetName => {
  console.log(`\n=== Sheet: ${sheetName} ===`);
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  
  // 打印所有行，包含列索引
  data.forEach((row, i) => {
    if (row && row.length > 0) {
      const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
      console.log(`Row ${i}: ${cells}`);
    }
  });
  console.log(`Total rows: ${data.length}`);
});
