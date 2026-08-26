import initSqlJs from 'sql.js';
import fs from 'fs';
import XLSX from 'xlsx';
import path from 'path';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

function dbGet(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  let result = null;
  if (stmt.step()) {
    result = stmt.getAsObject();
  }
  stmt.free();
  return result;
}

function dbRun(sql, params = []) {
  db.run(sql, params);
  const result = dbGet('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: result.id };
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
}

const folderPath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));

console.log('=== 开始从Excel文件提取并更新身份证号码 ===\n');

let updatedCount = 0;
let notFoundCount = 0;
let skippedCount = 0;

// 遍历所有Excel文件
files.forEach((file, fileIdx) => {
  console.log(`\n[${fileIdx + 1}/${files.length}] 处理文件: ${file}`);
  const filePath = path.join(folderPath, file);
  
  try {
    const workbook = XLSX.readFile(filePath);
    
    workbook.SheetNames.forEach(sheetName => {
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
      
      if (jsonData.length < 2) return; // 至少需要表头+数据
      
      // 遍历每一行数据(跳过表头)
      for (let i = 1; i < jsonData.length; i++) {
        const row = jsonData[i];
        if (!row || row.length < 2) continue;
        
        const name = String(row[0]).trim(); // 姓名列
        const idNumber = row[1]; // 身份证列
        
        // 检查是否有有效的身份证号
        if (!name || !idNumber) continue;
        
        // 判断是否是有效的身份证号(15-18位数字或字母)
        const idStr = String(idNumber).trim();
        if (idStr.length < 15 || idStr.length > 18) continue;
        
        // 查找数据库中是否有这个员工
        const employee = dbGet('SELECT id, name, id_number FROM employees WHERE name = ?', [name]);
        
        if (employee) {
          // 员工存在,更新身份证号
          if (employee.id_number && employee.id_number !== idStr) {
            // 已有身份证号且不同,更新
            dbRun('UPDATE employees SET id_number = ? WHERE id = ?', [idStr, employee.id]);
            console.log(`  ✓ 更新: ${name} - ${idStr} (原: ${employee.id_number})`);
            updatedCount++;
          } else if (!employee.id_number) {
            // 没有身份证号,添加
            dbRun('UPDATE employees SET id_number = ? WHERE id = ?', [idStr, employee.id]);
            console.log(`  ✓ 新增: ${name} - ${idStr}`);
            updatedCount++;
          } else {
            // 身份证号相同,跳过
            skippedCount++;
          }
        } else {
          // 员工不存在,记录一下
          console.log(`  ✗ 未找到员工: ${name} (身份证: ${idStr})`);
          notFoundCount++;
        }
      }
    });
  } catch (err) {
    console.log(`  ✗ 读取文件失败: ${err.message}`);
  }
});

// 保存数据库
saveDb();

console.log('\n=== 更新完成 ===');
console.log(`✓ 成功更新/新增: ${updatedCount} 条`);
console.log(`✗ 未找到员工: ${notFoundCount} 条`);
console.log(`- 跳过(已存在): ${skippedCount} 条`);

// 统计还有多少员工没有身份证号
const noIdEmployees = dbGet('SELECT COUNT(*) as count FROM employees WHERE id_number IS NULL OR id_number = ""');
console.log(`\n📊 当前数据库中无身份证号的员工: ${noIdEmployees.count} 人`);
