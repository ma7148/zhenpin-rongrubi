const Database = require('./node_modules/better-sqlite3');
const db = new Database('./server/database/rongrubi.db');

// 查询所有不同的门店名称
const stores = db.prepare("SELECT DISTINCT store_name FROM employees WHERE store_name IS NOT NULL AND store_name NOT LIKE '[门店]%' ORDER BY store_name").all();
console.log('当前数据库中的门店：');
stores.forEach((s, i) => console.log(`${i+1}. ${s.store_name}`));

// 查询用户表中的门店
const userStores = db.prepare("SELECT DISTINCT store_name FROM users WHERE role='store' AND store_name IS NOT NULL ORDER BY store_name").all();
console.log('\n用户表中的门店账户：');
userStores.forEach((s, i) => console.log(`${i+1}. ${s.store_name} (用户名: ${db.prepare("SELECT username FROM users WHERE store_name=? LIMIT 1", [s.store_name]).get()?.username})`));
