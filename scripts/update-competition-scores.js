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

console.log('=== 更新竞聘记录(添加得分信息) ===\n');

// 竞聘得分数据
const competitionData = [
  { name: '李双江', score: 144.26, bonus: '学历+1分', note: '主动参加总监竞聘' },
  { name: '杨宗', score: 141.24, bonus: '', note: '主动参加总监竞聘' },
  { name: '魏飞', score: 132.04, bonus: '学历+1分', note: '主动参加总监竞聘' },
  { name: '李晨', score: 131.78, bonus: '', note: '主动参加总监竞聘' },
  { name: '全垚', score: 146.06, bonus: '', note: '参加并胜出总监竞聘' }
];

competitionData.forEach(emp => {
  // 获取员工ID
  const employee = dbGet('SELECT id FROM employees WHERE name = ?', [emp.name]);
  if (!employee) {
    console.log(`✗ 未找到员工: ${emp.name}`);
    return;
  }
  
  const employeeId = employee.id;
  const month = '2026-08';
  
  // 构建完整的备注文本
  let fullNote = `${emp.note},最后得分${emp.score}分`;
  if (emp.bonus) {
    fullNote += `,${emp.bonus}`;
  }
  
  // 检查是否已有记录
  const existingRecord = dbGet(
    'SELECT id FROM records WHERE employee_id = ? AND month = ?',
    [employeeId, month]
  );
  
  if (existingRecord) {
    // 更新现有记录的review_note
    dbRun(
      'UPDATE records SET review_note = ? WHERE id = ?',
      [fullNote, existingRecord.id]
    );
    console.log(`✓ 已更新 ${emp.name}: ${fullNote}`);
  } else {
    // 创建新记录
    dbRun(
      `INSERT INTO records 
       (employee_id, store_name, month, status, submitted_by, review_note, submitted_at) 
       VALUES (?, '公司总部', ?, 'approved', 1, ?, datetime('now'))`,
      [employeeId, month, fullNote]
    );
    console.log(`✓ 已创建 ${emp.name}: ${fullNote}`);
  }
});

saveDb();
console.log('\n✅ 所有竞聘记录已更新!数据库已保存');
