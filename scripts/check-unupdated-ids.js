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

console.log('=== 检查未更新的员工 ===\n');

// 查询所有身份证号不是18位真实号码的员工
const employees = dbAll(`
  SELECT DISTINCT name, store_name, id_number 
  FROM employees 
  WHERE id_number IS NULL 
     OR id_number LIKE 'TEMP-%' 
     OR id_number LIKE 'DIR-%'
`);

console.log(`共有 ${employees.length} 条记录的身份证号需要更新:\n`);

employees.forEach((emp, idx) => {
  console.log(`${idx + 1}. ${emp.name} (${emp.store_name})`);
  console.log(`   当前身份证号: ${emp.id_number || '无'}`);
});

console.log('\n=== 按门店统计 ===\n');
const storeStats = {};
employees.forEach(emp => {
  if (!storeStats[emp.store_name]) {
    storeStats[emp.store_name] = [];
  }
  storeStats[emp.store_name].push(emp.name);
});

Object.keys(storeStats).forEach(store => {
  console.log(`${store}: ${storeStats[store].length}人`);
  storeStats[store].forEach(name => {
    console.log(`  - ${name}`);
  });
});
