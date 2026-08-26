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

// 添加总监员工（门店设为"公司总部"）
const directorsToAdd = [
  { name: '姜龙', store: '公司总部' },
  { name: '李双江', store: '公司总部' },
  { name: '全垚', store: '公司总部' },
  { name: '马良成', store: '公司总部' },
  { name: '周杰', store: '公司总部' },
  { name: '邓慧清', store: '公司总部' },
   { name: '柳江琴', store: '公司总部' },
  { name: '黄蓓丽', store: '公司总部' },
  { name: '魏艾梅', store: '公司总部' }
];

console.log('=== 添加总监员工 ===');
directorsToAdd.forEach(d => {
  // 检查是否已存在
  const existing = db.exec(`SELECT id FROM employees WHERE name = '${d.name}'`);
  if (existing[0] && existing[0].values.length > 0) {
    console.log(`✓ ${d.name} 已存在`);
    // 更新为总监
    db.run(`UPDATE employees SET is_director = 1, store_name = '${d.store}' WHERE name = '${d.name}'`);
  } else {
    // 添加新员工（使用占位符身份证号）
    const placeholderId = `DIR-${Date.now()}-${d.name}`;
    db.run(`INSERT INTO employees (name, id_number, store_name, promotion_date, is_director) VALUES ('${d.name}', '${placeholderId}', '${d.store}', '2026-01-01', 1)`);
    console.log(`✓ ${d.name} → 已添加到${d.store}，设为总监`);
  }
});

save();

// 验证
console.log('\n=== 当前总监列表 ===');
const directorList = db.exec("SELECT name, store_name FROM employees WHERE is_director = 1");
if (directorList[0]) {
  directorList[0].values.forEach(r => console.log(`${r[0]} - ${r[1]}`));
}
