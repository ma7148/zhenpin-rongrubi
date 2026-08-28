const initSqlJs = require('sql.js');
const fs = require('fs');
const path = require('path');

const dbPath = path.join(__dirname, 'database', 'rongrubi.db');

// 备份
const backupPath = path.join(__dirname, 'database', `rongrubi_backup_${Date.now()}.db`);
fs.copyFileSync(dbPath, backupPath);
console.log('已备份数据库');

initSqlJs().then(SQL => {
  const buf = fs.readFileSync(dbPath);
  const db = new SQL.Database(buf);

  function dbAll(sql, params = []) {
    const stmt = db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) results.push(stmt.getAsObject());
    stmt.free();
    return results;
  }

  function dbGet(sql, params = []) {
    const rows = dbAll(sql, params);
    return rows.length > 0 ? rows[0] : null;
  }

  function dbRun(sql, params = []) {
    db.run(sql, params);
  }

  function saveDb() {
    const data = db.export();
    fs.writeFileSync(dbPath, Buffer.from(data));
  }

  // 找出所有占位员工
  const placeholders = dbAll("SELECT id, name, store_name FROM employees WHERE name LIKE '[待补全]%'");
  console.log(`找到 ${placeholders.length} 个占位员工`);

  // 统计每个占位员工有多少条记录
  let totalRecords = 0;
  placeholders.forEach(emp => {
    const recCount = dbGet("SELECT COUNT(*) as cnt FROM records WHERE employee_id = ?", [emp.id]);
    totalRecords += recCount.cnt;
    console.log(`  ID=${emp.id}, 姓名=${emp.name}, 门店=${emp.store_name}, 记录数=${recCount.cnt}`);
  });

  console.log(`\n这些占位员工共有 ${totalRecords} 条关联记录`);
  console.log('将占位员工姓名改为"未知员工"，保留记录...');

  // 更新占位员工姓名
  placeholders.forEach(emp => {
    dbRun("UPDATE employees SET name = ? WHERE id = ?", [`未知员工(${emp.store_name})`, emp.id]);
  });

  saveDb();
  console.log('\n=== 完成 ===');

  // 验证
  const remaining = dbAll("SELECT COUNT(*) as cnt FROM employees WHERE name LIKE '[待补全]%'");
  console.log(`剩余占位员工: ${remaining[0].cnt}`);
  const totalEmp = dbGet("SELECT COUNT(*) as cnt FROM employees");
  console.log(`总员工数: ${totalEmp.cnt}`);
});
