import XLSX from 'xlsx';
import mammoth from 'mammoth';
import fs from 'fs';
import path from 'path';

const baseDir = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';

// 读取Excel文件
function readExcel(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`文件: ${path.basename(filePath)}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const workbook = XLSX.readFile(filePath);
    workbook.SheetNames.forEach(sheetName => {
      console.log(`\n--- 工作表: ${sheetName} ---`);
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      
      // 打印前15行
      const maxRows = Math.min(data.length, 15);
      for (let i = 0; i < maxRows; i++) {
        console.log(`行${i}: ${JSON.stringify(data[i])}`);
      }
      console.log(`... 共 ${data.length} 行`);
    });
  } catch (err) {
    console.log(`读取失败: ${err.message}`);
  }
}

// 读取Word文件
async function readWord(filePath) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`文件: ${path.basename(filePath)}`);
  console.log(`${'='.repeat(60)}`);
  
  try {
    const result = await mammoth.extractRawText({ path: filePath });
    const lines = result.value.split('\n').filter(l => l.trim());
    console.log('前30行内容:');
    lines.slice(0, 30).forEach((line, i) => {
      console.log(`  ${i}: ${line}`);
    });
    console.log(`... 共 ${lines.length} 行`);
  } catch (err) {
    console.log(`读取失败: ${err.message}`);
  }
}

// 读取几个代表性文件
async function main() {
  // Excel文件
  readExcel(path.join(baseDir, '汉街店2026年1-6月荣辱明细.xlsx'));
  readExcel(path.join(baseDir, '2026年1-6月月份管理层荣辱榜.xls'));
  readExcel(path.join(baseDir, '2026年汉街精选工作失职&违规扣分登记表.xlsx'));
  readExcel(path.join(baseDir, '江腾广场店工作失职&违规扣分登记表-2026.xlsx'));
  readExcel(path.join(baseDir, '7月', '凯德管理层2026扣分明细.xls'));
  readExcel(path.join(baseDir, '柳江琴', '杨家湾店1-5月扣分记录.xls'));
  readExcel(path.join(baseDir, '黄总', '2026年1-5月万象城店管理层扣分明细.xls'));
  readExcel(path.join(baseDir, '黄总', '2026年1-5月武汉天地店管理层扣分明细.xls'));
  
  // Word文件
  await readWord(path.join(baseDir, '范湖万达店管理层荣辱榜.docx'));
  await readWord(path.join(baseDir, '钟家村店管理层荣辱榜.docx'));
  await readWord(path.join(baseDir, '臻品足道荣辱榜', '融侨华府荣辱榜.docx'));
}

main().catch(console.error);
