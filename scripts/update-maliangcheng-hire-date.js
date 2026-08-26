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

console.log('=== 更新马良成入职时间 ===\n');

// 更新马良成的入职时间为2016-02-18
dbRun('UPDATE employees SET hire_date = ? WHERE name = ?', ['2016-02-18', '马良成']);

saveDb();

console.log('✓ 马良成的入职时间已更新为: 2016-02-18\n');

// 验证更新
const result = dbGet('SELECT name, hire_date FROM employees WHERE name = ? LIMIT 1', ['马良成']);
if (result) {
  console.log(`验证: ${result.name} - 入职日期: ${result.hire_date}`);
}
