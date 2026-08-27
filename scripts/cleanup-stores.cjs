#!/usr/bin/env node
/**
 * 清理重复门店 + 重命名金银潭永旺
 */
const SQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../server/database/rongrubi.db');

async function main() {
  const buf = fs.readFileSync(DB_PATH);
  const sql = await SQL();
  const db = new sql.Database(buf);

  // 需要删除的虚拟门店（不带"店"后缀的重复项）
  const storesToRemove = ['万象城', '南京路', '武汉天地', '汉街精选', '融侨华府'];

  console.log('=== 清理重复门店 ===\n');

  for (const store of storesToRemove) {
    // 查看该门店下有多少员工
    const empResult = db.exec('SELECT COUNT(*) FROM employees WHERE store_name = ?', [store]);
    const count = empResult[0]?.values[0]?.[0] || 0;
    console.log(`  删除 "${store}"（${count} 条虚拟员工记录）`);

    db.run('DELETE FROM employees WHERE store_name = ?', [store]);
    db.run("DELETE FROM users WHERE store_name = ? AND role = 'store'", [store]);
    db.run('DELETE FROM records WHERE store_name = ?', [store]);
  }

  // 重命名 金银潭永旺 → 功夫Pai金银潭永旺店
  console.log('\n=== 重命名门店 ===');
  const renameResult = db.exec('SELECT COUNT(*) FROM employees WHERE store_name = ?', ['金银潭永旺']);
  const renameCount = renameResult[0]?.values[0]?.[0] || 0;
  console.log(`  "金银潭永旺" → "功夫Pai金银潭永旺店"（${renameCount} 条记录）`);

  db.run('UPDATE employees SET store_name = ? WHERE store_name = ?', ['功夫Pai金银潭永旺店', '金银潭永旺']);
  db.run("UPDATE users SET store_name = ? WHERE store_name = ? AND role = 'store'", ['功夫Pai金银潭永旺店', '金银潭永旺']);
  db.run('UPDATE records SET store_name = ? WHERE store_name = ?', ['功夫Pai金银潭永旺店', '金银潭永旺']);

  // 保存
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));

  // 验证
  const finalResult = db.exec('SELECT DISTINCT store_name FROM employees WHERE store_name IS NOT NULL ORDER BY store_name');
  const finalStores = finalResult[0]?.values.map(v => v[0]) || [];
  console.log(`\n最终门店列表（共 ${finalStores.length} 个）：`);
  finalStores.forEach(s => console.log(`  - ${s}`));
}

main().catch(err => { console.error(err); process.exit(1); });
