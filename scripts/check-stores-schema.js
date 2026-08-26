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

console.log('=== stores表结构 ===\n');

const tableInfo = dbAll('PRAGMA table_info(stores)');
tableInfo.forEach(col => {
  console.log(`${col.name}: ${col.type} ${col.notnull ? 'NOT NULL' : ''}`);
});

console.log('\n=== 当前门店列表 ===\n');
const stores = dbAll('SELECT * FROM stores ORDER BY name');
stores.forEach(store => {
  console.log(`${store.id}. ${store.name}`);
});
