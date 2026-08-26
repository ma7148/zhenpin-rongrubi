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

console.log('=== 检查users表结构 ===\n');

// 查询表结构
const tableInfo = dbAll('PRAGMA table_info(users)');
console.log('users表字段:');
tableInfo.forEach(col => {
  console.log(`  - ${col.name} (${col.type})`);
});

console.log('\n=== 所有用户账户 ===\n');

const users = dbAll('SELECT * FROM users ORDER BY id');

console.log(`共有 ${users.length} 个用户账户:\n`);

users.forEach(user => {
  console.log(`${user.id}. ${user.username} (${user.role})`);
  console.log(`   门店: ${user.store_name || '无'}`);
  console.log('');
});
