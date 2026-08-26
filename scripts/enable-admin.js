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
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
}

console.log('=== 检查并启用admin账户 ===\n');

// 检查admin账户状态
const admin = dbGet('SELECT id, username, role, disabled FROM users WHERE username = ?', ['admin']);

if (admin) {
  console.log(`admin账户状态:`);
  console.log(`  ID: ${admin.id}`);
  console.log(`  用户名: ${admin.username}`);
  console.log(`  角色: ${admin.role}`);
  console.log(`  禁用状态: ${admin.disabled ? '✗ 已禁用' : '✓ 已启用'}`);
  
  if (admin.disabled) {
    console.log('\n正在启用admin账户...');
    dbRun('UPDATE users SET disabled = 0 WHERE username = ?', ['admin']);
    saveDb();
    console.log('✓ admin账户已启用\n');
    
    // 验证
    const updated = dbGet('SELECT disabled FROM users WHERE username = ?', ['admin']);
    console.log(`验证: admin账户现在${updated.disabled ? '已禁用' : '已启用'}`);
  } else {
    console.log('\n✓ admin账户已经是启用状态');
  }
} else {
  console.log('✗ 未找到admin账户');
}
