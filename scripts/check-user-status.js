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

console.log('=== 检查用户账户状态 ===\n');

const users = dbAll('SELECT id, username, role, store_name, is_active FROM users ORDER BY id');

console.log(`共有 ${users.length} 个用户账户:\n`);

users.forEach(user => {
  const status = user.is_active ? '✓ 激活' : '✗ 禁用';
  console.log(`${user.id}. ${user.username} (${user.role})`);
  console.log(`   门店: ${user.store_name || '无'}`);
  console.log(`   状态: ${status}`);
  console.log('');
});
