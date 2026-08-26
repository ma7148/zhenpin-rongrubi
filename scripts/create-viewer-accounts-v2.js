import initSqlJs from 'sql.js';
import fs from 'fs';
import bcrypt from 'bcryptjs';

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

console.log('=== 创建查询账户 ===\n');

// 首先检查并修改users表的CHECK约束
console.log('1. 检查users表结构...');
try {
  // 尝试删除旧表并重建(保留数据)
  const users = db.exec('SELECT * FROM users');
  const userData = users[0] ? users[0].values : [];
  
  console.log(`   当前用户数: ${userData.length}`);
  
  // 创建新表(临时)
  db.run(`
    CREATE TABLE IF NOT EXISTS users_new (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'store', 'viewer')),
      store_name TEXT,
      disabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);
  
  // 复制数据
  if (userData.length > 0) {
    userData.forEach(row => {
      db.run(
        'INSERT INTO users_new (id, username, password, role, store_name, disabled, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)',
        row
      );
    });
    console.log('   ✓ 数据已复制到新表');
  }
  
  // 删除旧表
  db.run('DROP TABLE users');
  console.log('   ✓ 旧表已删除');
  
  // 重命名新表
  db.run('ALTER TABLE users_new RENAME TO users');
  console.log('   ✓ 新表已重命名为users');
  
} catch (err) {
  console.log('   ⚠️ 表结构可能已更新:', err.message);
}

// 保存
saveDb();
console.log('\n2. 数据库结构已更新,支持viewer角色\n');

// 创建2个查询账户
const queryAccounts = [
  { username: 'boss1', password: 'boss123', role: 'viewer', store_name: null },
  { username: 'boss2', password: 'boss123', role: 'viewer', store_name: null }
];

queryAccounts.forEach(account => {
  // 检查是否已存在
  const existing = dbGet('SELECT id FROM users WHERE username = ?', [account.username]);
  
  if (existing) {
    console.log(`✗ ${account.username} 已存在,跳过`);
  } else {
    // 加密密码
    const hashedPassword = bcrypt.hashSync(account.password, 10);
    
    // 插入新用户
    dbRun(
      'INSERT INTO users (username, password, role, store_name, disabled) VALUES (?, ?, ?, ?, 0)',
      [account.username, hashedPassword, account.role, account.store_name]
    );
    
    console.log(`✓ 创建成功: ${account.username} (密码: ${account.password})`);
  }
});

// 保存数据库
saveDb();

console.log('\n=== 账户信息 ===');
console.log('账户1: boss1 / boss123');
console.log('账户2: boss2 / boss123');
console.log('\n权限说明:');
console.log('- 只能查看所有数据(员工、记录、统计)');
console.log('- 不能添加、编辑、删除任何数据');
console.log('- 不能提交荣辱记录');
console.log('- 不能管理用户');

// 验证
console.log('\n=== 当前所有用户 ===');
const allUsers = db.exec('SELECT id, username, role, store_name FROM users ORDER BY id');
if (allUsers[0]) {
  allUsers[0].values.forEach(r => {
    const roleLabel = r[2] === 'admin' ? '管理员' : (r[2] === 'store' ? '门店管理员' : '查询账户');
    console.log(`  ID:${r[0]} ${r[1]} - ${roleLabel} (${r[3] || '全部'})`);
  });
}
