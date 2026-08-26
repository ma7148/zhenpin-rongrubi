import XLSX from 'xlsx';
import mammoth from 'mammoth';
import path from 'path';

const BASE = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';

async function checkFile(filePath) {
  const ext = filePath.toLowerCase().split('.').pop();
  console.log(`\n=== ${path.basename(filePath)} ===`);
  
  if (['xlsx', 'xls'].includes(ext)) {
    const wb = XLSX.readFile(filePath);
    wb.SheetNames.forEach(sn => {
      const data = XLSX.utils.sheet_to_json(wb.Sheets[sn], { header: 1 });
      console.log(`\nSheet: ${sn} (${data.length} rows)`);
      data.slice(0, 8).forEach((row, i) => {
        const cells = row.map((c, j) => `[${j}]=${JSON.stringify(c)}`).join(' | ');
        console.log(`  Row ${i}: ${cells}`);
      });
    });
  } else if (ext === 'docx') {
    const result = await mammoth.extractRawText({ path: filePath });
    const lines = result.value.split('\n').filter(l => l.trim());
    console.log(`(${lines.length} lines)`);
    lines.slice(0, 20).forEach((l, i) => console.log(`  ${i}: ${l}`));
  }
}

async function main() {
  await checkFile(path.join(BASE, '钟家村店管理层荣辱榜.docx'));
  await checkFile(path.join(BASE, '柳江琴', '工作失职&违规扣分登记表-2026.xlsx'));
  await checkFile(path.join(BASE, '柳江琴', '杨家湾店1-5月扣分记录.xls'));
  await checkFile(path.join(BASE, '柳江琴', '王家湾店管理层扣分明细.xlsx'));
}

main().catch(console.error);
