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

console.log('=== records表完整结构 ===\n');

const tableInfo = dbAll('PRAGMA table_info(records)');
console.log('字段列表:');
tableInfo.forEach(col => {
  console.log(`  ${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''} ${col.dflt_value ? 'DEFAULT ' + col.dflt_value : ''}`);
});

console.log('\n示例数据(前3条):');
const sampleRecords = dbAll('SELECT * FROM records LIMIT 3');
if (sampleRecords.length > 0) {
  sampleRecords.forEach((record, idx) => {
    console.log(`\n记录${idx + 1}:`);
    Object.keys(record).forEach(key => {
      console.log(`  ${key}: ${record[key]}`);
    });
  });
} else {
  console.log('  无数据');
}
