import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

console.log('=== 柳江琴的所有记录 ===');
const result = db.exec("SELECT id, name, store_name, is_director FROM employees WHERE name = '柳江琴'");
if (result[0]) {
  result[0].values.forEach(r => console.log(`ID: ${r[0]}, 姓名: ${r[1]}, 门店: ${r[2]}, 总监: ${r[3]}`));
}

// 删除重复记录，保留第一条
console.log('\n=== 清理重复记录 ===');
const ids = result[0]?.values.map(r => r[0]) || [];
if (ids.length > 1) {
  // 保留第一个，删除其他
  const keepId = ids[0];
  const deleteIds = ids.slice(1);
  deleteIds.forEach(id => {
    db.run(`DELETE FROM employees WHERE id = ${id}`);
    console.log(`✓ 已删除重复记录 ID: ${id}`);
  });
  
  // 保存数据库
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
  console.log('\n数据库已保存');
} else {
  console.log('没有重复记录');
}

// 验证
console.log('\n=== 当前公司总部总监列表 ===');
const directorList = db.exec("SELECT name, store_name FROM employees WHERE store_name = '公司总部' AND is_director = 1");
if (directorList[0]) {
  directorList[0].values.forEach(r => console.log(`${r[0]} - ${r[1]}`));
}
