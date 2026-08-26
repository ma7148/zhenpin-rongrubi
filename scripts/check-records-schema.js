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

console.log('=== records表结构 ===\n');

const tableInfo = dbAll('PRAGMA table_info(records)');
tableInfo.forEach(col => {
  console.log(`${col.name} (${col.type}) ${col.notnull ? 'NOT NULL' : ''}`);
});
