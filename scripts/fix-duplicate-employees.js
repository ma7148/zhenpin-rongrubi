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
  const result = dbGet('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: result.id };
}

function saveDb() {
  const data = db.export();
  fs.writeFileSync('server/database/rongrubi.db', Buffer.from(data));
}

console.log('=== 检查南京路店员工的重复记录 ===\n');

// 查询南京路店所有员工
const employees = dbAll(`
  SELECT id, name, store_name, id_number 
  FROM employees 
  WHERE store_name LIKE '%南京路%' OR store_name = '臻品足道.南京路'
  ORDER BY name
`);

console.log(`找到 ${employees.length} 条员工记录:\n`);

// 按姓名分组
const byName = {};
employees.forEach(emp => {
  if (!byName[emp.name]) {
    byName[emp.name] = [];
  }
  byName[emp.name].push(emp);
});

let deletedCount = 0;

Object.keys(byName).forEach(name => {
  const records = byName[name];
  console.log(`${name}: ${records.length} 条记录`);
  
  if (records.length > 1) {
    console.log(`  ⚠️ 发现重复记录!`);
    records.forEach((rec, idx) => {
      console.log(`    [${idx}] ID: ${rec.id}, 身份证: ${rec.id_number || '无'}`);
    });
    
    // 保留第一条(已有真实身份证号的),删除其他重复记录
    const keepRecord = records.find(r => r.id_number && !r.id_number.startsWith('TEMP-')) || records[0];
    const deleteRecords = records.filter(r => r.id !== keepRecord.id);
    
    deleteRecords.forEach(rec => {
      console.log(`    ✗ 删除重复记录 ID: ${rec.id} (身份证: ${rec.id_number})`);
      dbRun('DELETE FROM employees WHERE id = ?', [rec.id]);
      deletedCount++;
    });
    
    console.log(`    ✓ 保留记录 ID: ${keepRecord.id} (身份证: ${keepRecord.id_number || '无'})`);
  } else {
    const rec = records[0];
    const hasRealId = rec.id_number && !rec.id_number.startsWith('TEMP-');
    console.log(`  ${hasRealId ? '✓' : '✗'} 身份证: ${rec.id_number || '无'}`);
  }
  console.log('');
});

// 保存数据库
saveDb();

console.log(`\n=== 清理完成 ===`);
console.log(`✓ 已删除 ${deletedCount} 条重复记录`);

// 验证
console.log('\n=== 验证结果 ===');
const remainingEmployees = dbAll(`
  SELECT id, name, store_name, id_number 
  FROM employees 
  WHERE store_name LIKE '%南京路%' OR store_name = '臻品足道.南京路'
  ORDER BY name
`);

console.log(`剩余 ${remainingEmployees.length} 条记录:`);
remainingEmployees.forEach(emp => {
  const hasRealId = emp.id_number && !emp.id_number.startsWith('TEMP-');
  console.log(`  ${hasRealId ? '✓' : '✗'} ${emp.name}: ${emp.id_number || '无'}`);
});
