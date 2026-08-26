import initSqlJs from 'sql.js';
import fs from 'fs';
import XLSX from 'xlsx';
import path from 'path';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

// 9位总监名单
const directors = [
  '姜龙', '李双江', '全垚', '马良成', 
  '周杰', '邓慧清', '柳江琴', '黄蓓丽', '魏艾梅'
];

console.log('=== 9位总监列表 ===');
directors.forEach((name, index) => {
  console.log(`${index + 1}. ${name}`);
});

// 获取总监的employee_id
console.log('\n=== 查询总监ID ===');
const directorIds = {};
directors.forEach(name => {
  const emp = dbGet('SELECT id, name, store_name FROM employees WHERE name = ?', [name]);
  if (emp) {
    directorIds[name] = emp.id;
    console.log(`✓ ${name} -> ID: ${emp.id}`);
  } else {
    console.log(`✗ ${name} -> 未找到`);
  }
});

// 读取Excel文件
const folderPath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜';
const files = fs.readdirSync(folderPath).filter(f => f.endsWith('.xls') || f.endsWith('.xlsx'));
const firstFile = files[0];
const filePath = path.join(folderPath, firstFile);

console.log(`\n=== 读取文件: ${firstFile} ===`);
const workbook = XLSX.readFile(filePath);
const worksheet = workbook.Sheets[workbook.SheetNames[0]];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`总行数: ${jsonData.length}`);

// 解析数据并导入
let importedCount = 0;
let skippedCount = 0;

for (let i = 2; i < jsonData.length; i++) { // 跳过前两行(标题和表头)
  const row = jsonData[i];
  if (!row || row.length < 2) continue;
  
  const name = row[0]; // 姓名列
  const date = row[2]; // 日期列
  const punishment = row[3]; // 处罚列
  const reward = row[7]; // 奖励列
  
  // 检查是否是9位总监之一
  if (!directors.includes(name)) {
    skippedCount++;
    continue;
  }
  
  const employeeId = directorIds[name];
  if (!employeeId) {
    console.log(`✗ ${name} 的ID未找到，跳过`);
    continue;
  }
  
  // 确定记录类型和内容
  let type, title, description;
  
  if (punishment && typeof punishment === 'string' && punishment.trim()) {
    // 有处罚记录 - 归类为"不足"
    type = 'shame';
    title = '工作不足';
    description = punishment;
  } else if (reward && typeof reward === 'string' && reward.trim()) {
    // 有奖励记录 - 归类为"荣誉"
    type = 'honor';
    title = '工作荣誉';
    description = String(reward);
  } else {
    skippedCount++;
    continue;
  }
  
  // 转换日期格式
  let recordDate;
  if (typeof date === 'number') {
    // Excel日期数字转换为日期字符串
    const excelDate = new Date((date - 25569) * 86400 * 1000);
    recordDate = excelDate.toISOString().split('T')[0];
  } else if (typeof date === 'string') {
    recordDate = date;
  } else {
    recordDate = new Date().toISOString().split('T')[0];
  }
  
  // 提取月份
  const month = recordDate.substring(0, 7); // YYYY-MM
  
  // 检查是否已存在该月份的记录
  const existing = dbGet('SELECT id FROM records WHERE employee_id = ? AND month = ? AND store_name = ?', 
    [employeeId, month, '公司总部']);
  
  if (existing) {
    // 已存在，添加item
    dbRun(
      'INSERT INTO record_items (record_id, type, title, description, date) VALUES (?, ?, ?, ?, ?)',
      [existing.id, type, title, description, recordDate]
    );
    console.log(`✓ ${name} (${month}) - 已添加${type === 'honor' ? '荣誉' : '不足'}到现有记录`);
  } else {
    // 创建新记录
    const result = dbRun(
      'INSERT INTO records (employee_id, store_name, month, submitted_by, status) VALUES (?, ?, ?, ?, ?)',
      [employeeId, '公司总部', month, 1, 'approved'] // 默认状态为已通过
    );
    const recordId = result.lastInsertRowid;
    
    dbRun(
      'INSERT INTO record_items (record_id, type, title, description, date) VALUES (?, ?, ?, ?, ?)',
      [recordId, type, title, description, recordDate]
    );
    console.log(`✓ ${name} (${month}) - 创建新记录(${type === 'honor' ? '荣誉' : '不足'})`);
  }
  
  importedCount++;
}

// 保存数据库
saveDb();

console.log(`\n=== 导入完成 ===`);
console.log(`成功导入: ${importedCount} 条记录`);
console.log(`跳过非总监: ${skippedCount} 条`);

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
  const result = dbGet('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: result.id };
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
}
