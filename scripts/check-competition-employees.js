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
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
}

console.log('=== 检查员工竞聘信息 ===\n');

// 查询需要更新的员工
const employees = [
  { name: '李双江', date: '2026-08-16', action: '主动参加总监竞聘' },
  { name: '杨宗', date: '2026-08-16', action: '主动参加总监竞聘' },
  { name: '魏飞', date: '2026-08-16', action: '主动参加总监竞聘' },
  { name: '李晨', date: '2026-08-16', action: '主动参加总监竞聘' },
  { name: '全垚', date: '2026-08-16', action: '参加并胜出总监竞聘' }
];

employees.forEach(emp => {
  const employee = dbGet('SELECT id, name, store_name, hire_date FROM employees WHERE name = ?', [emp.name]);
  if (employee) {
    console.log(`✓ 找到员工: ${emp.name}`);
    console.log(`  ID: ${employee.id}`);
    console.log(`  门店: ${employee.store_name}`);
    console.log(`  入职日期: ${employee.hire_date || '未设置'}`);
    console.log(`  操作: ${emp.action}`);
    console.log('');
  } else {
    console.log(`✗ 未找到员工: ${emp.name}`);
    console.log('');
  }
});
