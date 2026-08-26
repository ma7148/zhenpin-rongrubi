import initSqlJs from 'sql.js';
import fs from 'fs';

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

console.log('=== 添加hire_date字段到employees表 ===\n');

try {
  // 检查是否已存在hire_date字段
  const tableInfo = db.exec('PRAGMA table_info(employees)');
  let hasHireDate = false;
  
  if (tableInfo.length > 0) {
    tableInfo[0].values.forEach(row => {
      if (row[1] === 'hire_date') {
        hasHireDate = true;
      }
    });
  }
  
  if (!hasHireDate) {
    console.log('添加hire_date字段...');
    dbRun('ALTER TABLE employees ADD COLUMN hire_date DATE');
    console.log('✓ hire_date字段添加成功\n');
  } else {
    console.log('hire_date字段已存在\n');
  }
  
  saveDb();
  console.log('✓ 数据库已保存\n');
  
  // 显示当前员工数据
  const employees = db.exec('SELECT name, store_name, hire_date, promotion_date FROM employees LIMIT 5');
  if (employees.length > 0) {
    console.log('示例员工数据:');
    employees[0].values.forEach(row => {
      console.log(`  ${row[0]} (${row[1]}) - 入职: ${row[2] || '无'}, 提干: ${row[3] || '无'}`);
    });
  }
  
} catch (err) {
  console.error('错误:', err.message);
}
