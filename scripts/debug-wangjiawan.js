import XLSX from 'xlsx';

const filePath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\柳江琴\\王家湾店管理层扣分明细.xlsx';
const wb = XLSX.readFile(filePath);

console.log('Sheet names:', wb.SheetNames);
wb.SheetNames.forEach(sn => {
  console.log(`\nSheet: "${sn}" (length: ${sn.length})`);
  console.log('  Char codes:', Array.from(sn).map(c => `${c}:${c.charCodeAt(0)}`).join(' '));
  const sheet = wb.Sheets[sn];
  const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log('  Rows:', data.length);
  data.slice(0, 3).forEach((row, i) => {
    console.log(`  Row ${i}:`, row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | '));
  });
  
  // Test regex
  const cleaned = sn.replace(/[^\u4e00-\u9fa5]/g, '');
  console.log('  Regex result:', cleaned);
});
