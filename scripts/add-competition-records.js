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

console.log('=== 添加员工并记录竞聘信息 ===\n');

// 1. 先添加缺失的员工
const newEmployees = [
  { name: '杨宗', store_name: '公司总部', id_number: 'TEMP-YANGZONG-001' },
  { name: '魏飞', store_name: '公司总部', id_number: 'TEMP-WEIFEI-001' },
  { name: '李晨', store_name: '公司总部', id_number: 'TEMP-LICHEN-001' }
];

console.log('步骤1: 添加新员工\n');
newEmployees.forEach(emp => {
  const existing = dbGet('SELECT id FROM employees WHERE name = ?', [emp.name]);
  if (!existing) {
    dbRun(
      'INSERT INTO employees (name, store_name, id_number, is_director, promotion_date) VALUES (?, ?, ?, 0, ?)',
      [emp.name, emp.store_name, emp.id_number, '2026-08-16']
    );
    console.log(`✓ 已添加员工: ${emp.name}`);
  } else {
    console.log(`⊙ 员工已存在: ${emp.name}`);
  }
});

saveDb();
console.log('\n数据库已保存\n');

// 2. 重新查询所有需要更新的员工
console.log('步骤2: 为所有员工添加竞聘记录\n');
const employees = [
  { name: '李双江', date: '2026-08-16', action: '主动参加总监竞聘', type: 'honor' },
  { name: '杨宗', date: '2026-08-16', action: '主动参加总监竞聘', type: 'honor' },
  { name: '魏飞', date: '2026-08-16', action: '主动参加总监竞聘', type: 'honor' },
  { name: '李晨', date: '2026-08-16', action: '主动参加总监竞聘', type: 'honor' },
  { name: '全垚', date: '2026-08-16', action: '参加并胜出总监竞聘', type: 'honor' }
];

employees.forEach(emp => {
  const employee = dbGet('SELECT id, name, store_name FROM employees WHERE name = ?', [emp.name]);
  if (employee) {
    // 提取月份 (2026-08)
    const month = emp.date.substring(0, 7);
    
    // 检查是否已有相同月份的记录
    const existingRecord = dbGet(
      'SELECT id FROM records WHERE employee_id = ? AND month = ? AND review_note LIKE ?',
      [employee.id, month, '%总监竞聘%']
    );
    
    if (!existingRecord) {
      // 添加荣誉记录
      dbRun(
        `INSERT INTO records 
         (employee_id, store_name, month, status, submitted_by, review_note, submitted_at) 
         VALUES (?, ?, ?, 'approved', 1, ?, datetime('now'))`,
        [employee.id, employee.store_name, month, emp.action]
      );
      console.log(`✓ 已为 ${emp.name} 添加记录: ${emp.action} (${month})`);
    } else {
      console.log(`⊙ ${emp.name} 已有竞聘记录,跳过`);
    }
  } else {
    console.log(`✗ 未找到员工: ${emp.name}`);
  }
});

saveDb();
console.log('\n✅ 所有操作完成!数据库已保存');
