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

// ===== 1. 删除"未知门店"的重复员工 =====
console.log('=== 步骤1: 删除未知门店重复数据 ===');
const delUnknown = db.run("DELETE FROM employees WHERE store_name = '未知门店'");
console.log('删除未知门店员工完成');

// ===== 2. 汉街店拆分：简金晶、乐俭、潘云飞、赵云霞 → 汉街精选店 =====
console.log('\n=== 步骤2: 汉街店拆分 ===');
const splitNames = ['简金晶', '乐俭', '潘云飞', '赵云霞'];
splitNames.forEach(name => {
  db.run(`UPDATE employees SET store_name = '汉街精选店' WHERE name = '${name}' AND store_name = '汉街店'`);
  console.log(`  ${name} → 汉街精选店`);
});

// ===== 3. 同步更新records表中的store_name =====
console.log('\n=== 步骤3: 同步更新records表 ===');
splitNames.forEach(name => {
  db.run(`UPDATE records SET store_name = '汉街精选店' WHERE employee_id IN (SELECT id FROM employees WHERE name = '${name}') AND store_name = '汉街店'`);
});
// 未知门店的records也更新
db.run("UPDATE records SET store_name = '南京路店' WHERE store_name = '未知门店'");
console.log('records表同步完成');

// ===== 4. 添加门店调动历史表 =====
console.log('\n=== 步骤4: 创建门店调动历史表 ===');
db.run(`
  CREATE TABLE IF NOT EXISTS store_transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    employee_id INTEGER NOT NULL,
    from_store TEXT NOT NULL,
    to_store TEXT NOT NULL,
    transfer_date DATE NOT NULL,
    reason TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (employee_id) REFERENCES employees(id)
  )
`);
console.log('门店调动历史表创建完成');

save();

// 验证结果
console.log('\n=== 验证结果 ===');
console.log('未知门店员工数:', db.exec("SELECT COUNT(*) FROM employees WHERE store_name = '未知门店'")[0]?.values[0][0]);
console.log('汉街精选店员工:', db.exec("SELECT DISTINCT name FROM employees WHERE store_name = '汉街精选店'")[0]?.values.map(r => r[0]).join(', '));
console.log('汉街店员工:', db.exec("SELECT DISTINCT name FROM employees WHERE store_name = '汉街店'")[0]?.values.map(r => r[0]).join(', '));
console.log('所有门店:', db.exec("SELECT DISTINCT store_name FROM employees ORDER BY store_name")[0]?.values.map(r => r[0]).join(', '));
