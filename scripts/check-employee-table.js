import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

function dbAll(sql, params = []) {
  const stmt = db.prepare(sql);
  if (params.length > 0) stmt.bind(params);
  const results = [];
  while (stmt.step()) {
    results.push(stmt.getAsObject());
  }
  stmt.free();
  return results;
}

console.log('=== 检查employees表结构 ===\n');

// 查询表结构
const tableInfo = db.exec('PRAGMA table_info(employees)');
if (tableInfo.length > 0) {
  console.log('employees表字段:');
  tableInfo[0].values.forEach(row => {
    console.log(`  - ${row[1]} (${row[2]})`);
  });
}

console.log('\n=== 查询示例员工数据 ===\n');
const employees = dbAll('SELECT * FROM employees LIMIT 3');
employees.forEach(emp => {
  console.log(`姓名: ${emp.name}`);
  console.log(`  门店: ${emp.store_name}`);
  console.log(`  职位: ${emp.position || '无'}`);
  console.log(`  身份证号: ${emp.id_number || '无'}`);
  console.log(`  入职时间: ${emp.hire_date || '无'}`);
  console.log(`  提干时间: ${emp.promotion_date || '无'}`);
  console.log('');
});
