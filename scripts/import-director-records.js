import initSqlJs from 'sql.js';
import fs from 'fs';
import XLSX from 'xlsx';

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
    console.log(`✓ ${name} -> ID: ${emp.id}, 门店: ${emp.store_name}`);
  } else {
    console.log(`✗ ${name} -> 未找到`);
  }
});

// 读取Excel文件
const excelPath = 'C:\\Users\\71486\\Desktop\\10.臻品足道荣辱榜\\2026年1-6月份荣辱榜.xls';
if (!fs.existsSync(excelPath)) {
  console.log(`\n✗ 文件不存在: ${excelPath}`);
  process.exit(1);
}

console.log(`\n=== 读取Excel文件 ===`);
const workbook = XLSX.readFile(excelPath);
console.log(`工作表数量: ${workbook.SheetNames.length}`);
console.log(`工作表名称: ${workbook.SheetNames.join(', ')}`);

// 读取第一个工作表
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log(`\n数据行数: ${jsonData.length}`);
if (jsonData.length > 0) {
  console.log('前5行数据:');
  jsonData.slice(0, 5).forEach((row, idx) => {
    console.log(`  行${idx}: ${JSON.stringify(row)}`);
  });
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
  const result = dbGet('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: result.id };
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
}
