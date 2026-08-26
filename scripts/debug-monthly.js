import XLSX from 'xlsx';

const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\2026年1-6月月份管理层荣辱榜.xls';
const wb = XLSX.readFile(filePath);

wb.SheetNames.forEach(sn => {
  console.log(`\n=== Sheet: ${sn} ===`);
  const data = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
  data.forEach((row, i) => {
    const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
    console.log(`Row ${i}: ${cells}`);
  });
});
