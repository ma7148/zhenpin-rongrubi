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

console.log('=== 当前所有门店 ===\n');

const stores = dbAll(`
  SELECT DISTINCT store_name 
  FROM employees 
  WHERE store_name IS NOT NULL AND store_name != ''
  ORDER BY store_name
`);

stores.forEach((store, idx) => {
  console.log(`${idx + 1}. ${store.store_name}`);
});

console.log(`\n共 ${stores.length} 个门店`);
