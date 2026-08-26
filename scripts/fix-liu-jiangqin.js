import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

console.log('=== 柳江琴的当前状态 ===');
const result = db.exec("SELECT id, name, store_name, is_director FROM employees WHERE name = '柳江琴'");
if (result[0]) {
  result[0].values.forEach(r => {
    console.log(`ID: ${r[0]}, 姓名: ${r[1]}, 门店: ${r[2]}, 总监: ${r[3]}`);
  });
  
  // 更新为公司总部总监
  db.run("UPDATE employees SET store_name = '公司总部', is_director = 1 WHERE name = '柳江琴'");
  console.log('\n✓ 已更新柳江琴为公司总部总监');
} else {
  console.log('未找到柳江琴的记录');
  // 添加新记录
  const placeholderId = `DIR-${Date.now()}-柳江琴`;
  db.run(`INSERT INTO employees (name, id_number, store_name, promotion_date, is_director) VALUES ('柳江琴', '${placeholderId}', '公司总部', '2026-01-01', 1)`);
  console.log('✓ 已添加柳江琴为公司总部总监');
}

// 保存数据库
const data = db.export();
fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
console.log('\n数据库已保存');

// 验证
console.log('\n=== 当前公司总部总监列表 ===');
const directorList = db.exec("SELECT name, store_name, is_director FROM employees WHERE store_name = '公司总部' AND is_director = 1 ORDER BY name");
if (directorList[0]) {
  console.log(`共 ${directorList[0].values.length} 人:`);
  directorList[0].values.forEach((r, index) => console.log(`${index + 1}. ${r[0]} - ${r[1]} (总监: ${r[2]})`));
}
