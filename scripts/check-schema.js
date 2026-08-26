import initSqlJs from 'sql.js';
import fs from 'fs';

const SQL = await initSqlJs();
const buf = fs.readFileSync('server/database/rongrubi.db');
const db = new SQL.Database(buf);

// 查看employees表结构
const schema = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='employees'");
console.log('表结构:', schema[0]?.values[0][0]);
