import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

function save() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
  console.log('数据库已保存');
}

// 添加is_director字段（如果不存在）
try {
  db.run('ALTER TABLE employees ADD COLUMN is_director INTEGER DEFAULT 0');
  save();
  console.log('已添加is_director字段');
} catch (e) {
  console.log('is_director字段已存在');
}

// 设置总监名单
const directors = ['姜龙', '严海春', '李双江', '全垚', '马良成', '周杰', '邓慧清', '柳江琴','黄蓓丽', '魏艾梅'];

console.log('=== 设置总监 ===');
directors.forEach(name => {
  // 先查找员工
  const result = db.exec(`SELECT id, name, store_name FROM employees WHERE name = '${name}'`);
  if (result[0] && result[0].values.length > 0) {
    const emp = result[0].values[0];
    db.run(`UPDATE employees SET is_director = 1 WHERE id = ${emp[0]}`);
    console.log(`✓ ${name} (ID: ${emp[0]}, 门店: ${emp[2]}) → 已设为总监`);
  } else {
    console.log(`✗ ${name} → 未找到，需要先添加该员工`);
  }
});

save();

// 验证
console.log('\n=== 当前总监列表 ===');
const directorList = db.exec("SELECT name, store_name FROM employees WHERE is_director = 1");
if (directorList[0]) {
  directorList[0].values.forEach(r => console.log(`${r[0]} - ${r[1]}`));
} else {
  console.log('暂无总监');
}
