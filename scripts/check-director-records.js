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

console.log('=== 检查公司总部的记录 ===\n');

// 查询公司总部的所有记录
const records = dbAll(`
  SELECT r.id, e.name as employee_name, r.month, r.store_name, 
         ri.type, ri.title, ri.description, ri.date
  FROM records r
  JOIN employees e ON r.employee_id = e.id
  LEFT JOIN record_items ri ON r.id = ri.record_id
  WHERE r.store_name = '公司总部'
  ORDER BY e.name, r.month
`);

if (records.length === 0) {
  console.log('✗ 公司总部没有任何记录');
} else {
  console.log(`✓ 找到 ${records.length} 条记录项:\n`);
  
  // 按员工分组
  const byEmployee = {};
  records.forEach(r => {
    if (!byEmployee[r.employee_name]) {
      byEmployee[r.employee_name] = [];
    }
    byEmployee[r.employee_name].push(r);
  });
  
  Object.keys(byEmployee).forEach(name => {
    console.log(`${name}:`);
    byEmployee[name].forEach(r => {
      const typeStr = r.type === 'honor' ? '荣誉' : '不足';
      console.log(`  - ${r.month}: ${typeStr} - ${r.description || r.title}`);
    });
    console.log('');
  });
}

// 检查9位总监各自有多少记录
console.log('\n=== 9位总监的记录统计 ===\n');
const directors = [
  '姜龙', '李双江', '全垚', '马良成', 
  '周杰', '邓慧清', '柳江琴', '黄蓓丽', '魏艾梅'
];

directors.forEach(name => {
  const count = dbAll(`
    SELECT COUNT(*) as count 
    FROM records r
    JOIN employees e ON r.employee_id = e.id
    WHERE e.name = ? AND r.store_name = '公司总部'
  `, [name])[0].count;
  
  const symbol = count > 0 ? '✓' : '✗';
  console.log(`${symbol} ${name}: ${count} 条记录`);
});
