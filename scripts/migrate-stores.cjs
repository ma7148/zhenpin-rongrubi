#!/usr/bin/env node
/**
 * 门店名称迁移和补充脚本
 * 将现有门店重命名为用户指定的名称，并添加新门店
 */

const SQL = require('sql.js');
const fs = require('fs');
const path = require('path');

const DB_PATH = path.join(__dirname, '../server/database/rongrubi.db');

// 门店重命名映射（旧名称 → 新名称）
const storeRenames = {
  '凯德店': '凯德西城店',
  '范湖万达店': '范湖万达',
};

// 用户指定的所有门店（第一列表 + 第二列表）
const allDesiredStores = [
  // 第一列表（当前运营门店）
  '光谷天地店',
  '永旺店',
  '凯德西城店',
  '后湖店',
  '范湖万达',
  '佛祖岭店',
  '汉街店',
  '南湖店',
  // 第二列表（额外门店）
  '欢乐谷店',
  '王家湾店',
  '会展中心店',
  '杨家湾店',
  '青山印象城',
  '人信汇店',
  '沌口店',
  '新华家园店',
  '宝丰路店',
  '万科店',
  '江腾广场店',
  '一元路店',
  '佳园路店',
  '新世界国贸店',
  '南京路',
  '武汉天地',
  '万象城',
  '江夏纸坊店',
  '同学广场',
  '融侨华府',
  '汉街精选',
  '钟家村',
  '金银潭永旺',
];

async function main() {
  console.log('=== 开始门店数据迁移 ===\n');
  
  // 读取数据库
  const buf = fs.readFileSync(DB_PATH);
  const sql = await SQL();
  const db = new sql.Database(buf);
  
  // 获取当前所有门店
  const currentStoresResult = db.exec('SELECT DISTINCT store_name FROM employees WHERE store_name IS NOT NULL');
  const currentStores = currentStoresResult.length > 0 
    ? currentStoresResult[0].values.map(v => v[0])
    : [];
  
  console.log('当前数据库门店：');
  currentStores.forEach(s => console.log(`  - ${s}`));
  console.log(`共 ${currentStores.length} 个\n`);
  
  let renameCount = 0;
  let addCount = 0;
  let skipCount = 0;
  
  // Step 1: 执行重命名
  console.log('--- Step 1: 重命名现有门店 ---');
  for (const [oldName, newName] of Object.entries(storeRenames)) {
    if (!currentStores.includes(oldName)) {
      console.log(`  ⚠️  未找到 "${oldName}"，跳过`);
      continue;
    }
    
    if (currentStores.includes(newName)) {
      console.log(`  ⚠️  "${newName}" 已存在，跳过重命名 "${oldName}"`);
      continue;
    }
    
    console.log(`   "${oldName}" → "${newName}"`);
    
    // 更新 employees 表
    db.run('UPDATE employees SET store_name = ? WHERE store_name = ?', [newName, oldName]);
    
    // 更新 users 表（门店账户）
    db.run("UPDATE users SET store_name = ? WHERE store_name = ? AND role = 'store'", [newName, oldName]);
    
    // 更新 records 表
    db.run('UPDATE records SET store_name = ? WHERE store_name = ?', [newName, oldName]);
    
    renameCount++;
  }
  
  // 重新获取更新后的门店列表
  const updatedStoresResult = db.exec('SELECT DISTINCT store_name FROM employees WHERE store_name IS NOT NULL');
  const updatedStores = updatedStoresResult.length > 0
    ? updatedStoresResult[0].values.map(v => v[0])
    : [];
  
  // Step 2: 添加缺失的门店
  console.log('\n--- Step 2: 添加缺失门店 ---');
  for (const desiredStore of allDesiredStores) {
    if (updatedStores.includes(desiredStore)) {
      console.log(`  ✅ "${desiredStore}" 已存在，跳过`);
      skipCount++;
      continue;
    }
    
    console.log(`  ➕ 添加 "${desiredStore}"`);
    
    // 通过插入虚拟员工记录来创建门店
    const timestamp = Date.now();
    const idNumber = `STORE-${timestamp}-${Math.random().toString(36).substr(2, 6)}`;
    const hireDate = new Date().toISOString().split('T')[0];
    
    db.run(
      'INSERT INTO employees (name, store_name, id_number, is_director, promotion_date) VALUES (?, ?, ?, 0, ?)',
      [`[门店] ${desiredStore}`, desiredStore, idNumber, hireDate]
    );
    
    addCount++;
  }
  
  // 保存数据库
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
  
  console.log('\n=== 迁移完成 ===');
  console.log(`重命名: ${renameCount} 个`);
  console.log(`新增: ${addCount} 个`);
  console.log(`跳过: ${skipCount} 个`);
  
  // 验证最终结果
  const finalStoresResult = db.exec('SELECT DISTINCT store_name FROM employees WHERE store_name IS NOT NULL ORDER BY store_name');
  const finalStores = finalStoresResult.length > 0
    ? finalStoresResult[0].values.map(v => v[0])
    : [];
  
  console.log(`\n最终门店列表（共 ${finalStores.length} 个）：`);
  finalStores.forEach(s => console.log(`  - ${s}`));
  
  // 检查是否有遗漏
  const missingStores = allDesiredStores.filter(s => !finalStores.includes(s));
  if (missingStores.length > 0) {
    console.log('\n⚠️  以下门店未能添加：');
    missingStores.forEach(s => console.log(`  - ${s}`));
  } else {
    console.log('\n✅ 所有指定门店均已存在！');
  }
}

main().catch(err => {
  console.error('错误:', err);
  process.exit(1);
});
