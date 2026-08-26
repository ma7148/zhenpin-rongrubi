import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

console.log('=== 所有管理员用户 ===');
const admins = db.exec("SELECT id, username, role, store_name FROM users WHERE role = 'admin'");
if (admins[0]) {
  admins[0].values.forEach(r => {
    console.log(`ID: ${r[0]}, 用户名: ${r[1]}, 角色: ${r[2]}, 门店: ${r[3]}`);
  });
}

console.log('\n=== 更新admin用户的store_name为公司总部 ===');
db.run("UPDATE users SET store_name = '公司总部' WHERE role = 'admin' AND (store_name IS NULL OR store_name != '公司总部')");

// 保存数据库
const data = db.export();
fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
console.log('✓ 数据库已保存');

// 验证
console.log('\n=== 更新后的admin用户 ===');
const updatedAdmins = db.exec("SELECT id, username, role, store_name FROM users WHERE role = 'admin'");
if (updatedAdmins[0]) {
  updatedAdmins[0].values.forEach(r => {
    console.log(`ID: ${r[0]}, 用户名: ${r[1]}, 角色: ${r[2]}, 门店: ${r[3]}`);
  });
}
