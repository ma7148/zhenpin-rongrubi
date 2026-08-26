import initSqlJs from 'sql.js';
import fs from 'fs';
import XLSX from 'xlsx';

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

console.log('=== 从员工信息模板更新身份证号码 ===\n');

// 读取Excel文件
const filePath = 'C:\\Users\\71486\\Desktop\\臻品足道员工信息模板.xlsx';
const workbook = XLSX.readFile(filePath);

// 收集所有员工的姓名和身份证号
const employeeMap = new Map(); // name -> id_number

workbook.SheetNames.forEach(sheetName => {
  const worksheet = workbook.Sheets[sheetName];
  const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  if (jsonData.length < 2) return;
  
  const headerRow = jsonData[0];
  let nameCol = -1;
  let idNumberCol = -1;
  
  headerRow.forEach((col, idx) => {
    const colStr = col ? col.toString().trim() : '';
    if (colStr.includes('姓名') || colStr === '名字' || colStr === '家属姓名') {
      nameCol = idx;
    }
    if (colStr.includes('身份证') || colStr.includes('身份证号')) {
      idNumberCol = idx;
    }
  });
  
  if (nameCol === -1 || idNumberCol === -1) return;
  
  // 从第2行开始读取数据
  for (let i = 1; i < jsonData.length; i++) {
    const row = jsonData[i];
    const name = row[nameCol];
    const idNumber = row[idNumberCol];
    
    if (name && idNumber) {
      // 如果已存在同名员工,保留第一个(避免重复)
      if (!employeeMap.has(name)) {
        employeeMap.set(name, idNumber.toString().trim());
      }
    }
  }
});

console.log(`从Excel文件中提取到 ${employeeMap.size} 个员工的身份证号码\n`);

// 更新数据库中的员工
let updatedCount = 0;
let notFoundCount = 0;
let skippedCount = 0;

// 获取数据库中所有员工
const employees = db.exec('SELECT DISTINCT name FROM employees');
if (employees.length > 0) {
  const names = employees[0].values.map(row => row[0]);
  
  console.log(`数据库中有 ${names.length} 个不同的员工姓名\n`);
  console.log('开始更新身份证号码:\n');
  
  names.forEach(name => {
    const idNumber = employeeMap.get(name);
    
    if (!idNumber) {
      notFoundCount++;
      console.log(`✗ ${name}: Excel中未找到`);
      return;
    }
    
    // 检查是否已经是真实身份证号(不是TEMP开头)
    const existingRecords = db.exec('SELECT id, id_number FROM employees WHERE name = ?', [name]);
    if (existingRecords.length === 0) return;
    
    const records = existingRecords[0].values;
    
    // 如果已经有真实身份证号(不是TEMP或DIR开头),跳过
    const hasRealId = records.some(row => row[1] && !row[1].toString().startsWith('TEMP-') && !row[1].toString().startsWith('DIR-'));
    if (hasRealId) {
      skippedCount++;
      console.log(`⊙ ${name}: 已有真实身份证号,跳过`);
      return;
    }
    
    // 如果有多个重复记录,只保留第一条,删除其他
    if (records.length > 1) {
      // 保留第一条记录的ID
      const keepId = records[0][0];
      // 删除其他重复记录
      for (let i = 1; i < records.length; i++) {
        dbRun('DELETE FROM employees WHERE id = ?', [records[i][0]]);
      }
      // 更新保留的记录
      dbRun('UPDATE employees SET id_number = ? WHERE id = ?', [idNumber, keepId]);
    } else {
      // 只有一条记录,直接更新
      dbRun('UPDATE employees SET id_number = ? WHERE id = ?', [idNumber, records[0][0]]);
    }
    
    updatedCount++;
    console.log(`✓ ${name}: ${idNumber}`);
  });
}

saveDb();

console.log('\n=== 更新完成 ===');
console.log(`✓ 成功更新: ${updatedCount} 人`);
console.log(`⊙ 已有身份证号(跳过): ${skippedCount} 人`);
console.log(`✗ Excel中未找到: ${notFoundCount} 人`);
console.log(`📊 总计处理: ${updatedCount + skippedCount + notFoundCount} 人`);
