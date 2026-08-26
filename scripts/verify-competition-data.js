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

console.log('=== 检查竞聘记录是否已保存到数据库 ===\n');

// 1. 检查records表中的竞聘记录
console.log('1. records表中的竞聘记录:');
const competitionRecords = dbAll(
  "SELECT r.id, r.employee_id, e.name, r.store_name, r.month, r.review_note FROM records r JOIN employees e ON r.employee_id = e.id WHERE r.review_note LIKE '%总监竞聘%' ORDER BY r.employee_id"
);

if (competitionRecords.length > 0) {
  console.log(`找到 ${competitionRecords.length} 条竞聘记录:\n`);
  competitionRecords.forEach(record => {
    console.log(`ID: ${record.id}`);
    console.log(`员工: ${record.name} (${record.employee_id})`);
    console.log(`门店: ${record.store_name}`);
    console.log(`月份: ${record.month}`);
    console.log(`备注: ${record.review_note}`);
    console.log('');
  });
} else {
  console.log('❌ 未找到任何竞聘记录\n');
}

// 2. 检查新员工是否存在
console.log('\n2. 检查新员工:');
const newEmployees = ['杨宗', '魏飞', '李晨'];
newEmployees.forEach(name => {
  const emp = dbAll('SELECT id, name, store_name FROM employees WHERE name = ?', [name]);
  if (emp.length > 0) {
    console.log(`✓ ${name}: ID=${emp[0].id}, 门店=${emp[0].store_name}`);
  } else {
    console.log(`✗ ${name}: 不存在`);
  }
});

// 3. 检查所有相关员工的记录数
console.log('\n3. 各员工记录统计:');
const employees = ['李双江', '杨宗', '魏飞', '李晨', '全垚'];
employees.forEach(name => {
  const emp = dbAll('SELECT id FROM employees WHERE name = ?', [name]);
  if (emp.length > 0) {
    const count = dbAll(
      'SELECT COUNT(*) as cnt FROM records WHERE employee_id = ?',
      [emp[0].id]
    );
    console.log(`${name}: ${count[0].cnt} 条记录`);
  } else {
    console.log(`${name}: 员工不存在`);
  }
});
