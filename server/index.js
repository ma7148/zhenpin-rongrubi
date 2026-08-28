import express from 'express';
import initSqlJs from 'sql.js';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import cors from 'cors';
import multer from 'multer';
import XLSX from 'xlsx';
import mammoth from 'mammoth';
import nodemailer from 'nodemailer';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { getEmailConfig } from './email-service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const dbDir = join(__dirname, 'database');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// 创建上传文件目录
const uploadsDir = join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

const DB_PATH = join(dbDir, 'rongrubi.db');
let db;

// 辅助函数：查询所有行
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

// 辅助函数：查询单行
function dbGet(sql, params = []) {
  const rows = dbAll(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

// 辅助函数：执行修改并返回 lastInsertRowid
function dbRun(sql, params = []) {
  db.run(sql, params);
  const result = dbGet('SELECT last_insert_rowid() as id');
  return { lastInsertRowid: result.id };
}

// 保存数据库到文件
function saveDb() {
  const data = db.export();
  const buffer = Buffer.from(data);
  fs.writeFileSync(DB_PATH, buffer);
}

// 记录操作日志
function logOperation(req, action, resourceType, resourceId, details = {}) {
  try {
    const userId = req.user ? req.user.id : null;
    const username = req.user ? req.user.username : 'anonymous';
    const ip = req.headers['x-forwarded-for'] || req.connection.remoteAddress || 'unknown';
    const userAgent = req.headers['user-agent'] || 'unknown';
    
    dbRun(
      'INSERT INTO operation_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [userId, username, action, resourceType, resourceId, JSON.stringify(details), ip, userAgent]
    );
    
    console.log(`[日志] ${username} - ${action} ${resourceType} #${resourceId}`);
  } catch (err) {
    console.error('[日志] 记录失败:', err.message);
  }
}

async function initDatabase() {
  const SQL = await initSqlJs();

  if (fs.existsSync(DB_PATH)) {
    const fileBuffer = fs.readFileSync(DB_PATH);
    db = new SQL.Database(fileBuffer);
  } else {
    db = new SQL.Database();
  }

  // 创建表
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'store')),
      store_name TEXT,
      disabled INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // 兼容旧数据库：添加disabled字段（如果不存在）
  try {
    db.run('ALTER TABLE users ADD COLUMN disabled INTEGER DEFAULT 0');
  } catch (e) { /* 字段已存在，忽略 */ }

  // 兼容旧数据库：清理临时身份证号
  try {
    db.run("UPDATE employees SET id_number = NULL WHERE id_number LIKE 'TEMP-%'");
    saveDb();
  } catch (e) { /* 忽略 */ }

  // 添加phone字段到users表（用于水印）
  try {
    db.run('ALTER TABLE users ADD COLUMN phone TEXT');
  } catch (e) { /* 字段已存在，忽略 */ }

  // 兼容旧数据库：添加hire_date字段
  try {
    db.run('ALTER TABLE employees ADD COLUMN hire_date DATE');
  } catch (e) { /* 字段已存在，忽略 */ }

  // 兼容旧数据库：添加store_number字段（店家编号）
  try {
    db.run('ALTER TABLE employees ADD COLUMN store_number TEXT');
  } catch (e) { /* 字段已存在，忽略 */ }

  // 兼容旧数据库：添加is_director字段
  try {
    db.run('ALTER TABLE employees ADD COLUMN is_director INTEGER DEFAULT 0');
  } catch (e) { /* 字段已存在，忽略 */ }

  // 添加watermark字段到record_items表（用于日志水印）
  try {
    db.run('ALTER TABLE record_items ADD COLUMN watermark TEXT');
  } catch (e) { /* 字段已存在，忽略 */ }

  db.run(`
    CREATE TABLE IF NOT EXISTS employees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      id_number TEXT,
      store_name TEXT NOT NULL,
      promotion_date DATE NOT NULL,
      is_director INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      store_name TEXT NOT NULL,
      month TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending', 'approved', 'rejected')),
      submitted_by INTEGER NOT NULL,
      reviewed_by INTEGER,
      review_note TEXT,
      submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (submitted_by) REFERENCES users(id),
      FOREIGN KEY (reviewed_by) REFERENCES users(id)
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS record_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      record_id INTEGER NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('honor', 'shame')),
      title TEXT NOT NULL,
      description TEXT,
      date DATE NOT NULL,
      watermark TEXT,
      FOREIGN KEY (record_id) REFERENCES records(id) ON DELETE CASCADE
    )
  `);

  db.run(`
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      employee_id INTEGER NOT NULL,
      original_name TEXT NOT NULL,
      stored_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_type TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      uploaded_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (employee_id) REFERENCES employees(id),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    )
  `);

  // 操作日志表（记录所有关键操作）
  db.run(`
    CREATE TABLE IF NOT EXISTS operation_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      username TEXT,
      action TEXT NOT NULL,
      resource_type TEXT, -- 'employee', 'record', 'user'等
      resource_id INTEGER,
      details TEXT, -- JSON格式的详细数据
      ip_address TEXT,
      user_agent TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id)
    )
  `);

  // 初始化管理员账户
  const adminExists = dbGet('SELECT id FROM users WHERE username = ?', ['admin']);
  if (!adminExists) {
    const hashedPassword = bcrypt.hashSync('admin123', 10);
    dbRun('INSERT INTO users (username, password, role) VALUES (?, ?, ?)', ['admin', hashedPassword, 'admin']);

    const stores = ['光谷天地店', '杨家湾店', '南京路店'];
    stores.forEach(store => {
      const username = store.substring(0, 2);
      const pwd = bcrypt.hashSync('store123', 10);
      dbRun('INSERT INTO users (username, password, role, store_name) VALUES (?, ?, ?, ?)', [username, pwd, 'store', store]);
    });

    saveDb();
    console.log('已创建默认账户：');
    console.log('  总部管理员 - 用户名: admin, 密码: admin123');
    console.log('  门店账户 - 用户名: 光谷/杨家/南京, 密码: store123');
  }

  // 门店名称迁移：旧门店 → 新门店
  const storeMigration = [
    { oldName: '北京旗舰店', newName: '光谷天地店', oldUser: '北京', newUser: '光谷' },
    { oldName: '上海分店', newName: '杨家湾店', oldUser: '上海', newUser: '杨家' },
    { oldName: '广州分店', newName: '南京路店', oldUser: '广州', newUser: '南京' },
  ];
  storeMigration.forEach(({ oldName, newName, oldUser, newUser }) => {
    const user = dbGet('SELECT id FROM users WHERE username = ?', [oldUser]);
    if (user) {
      dbRun('UPDATE users SET username = ?, store_name = ? WHERE username = ?', [newUser, newName, oldUser]);
      console.log(`[迁移] 用户 ${oldUser} → ${newUser}, 门店 ${oldName} → ${newName}`);
    }
    dbRun('UPDATE employees SET store_name = ? WHERE store_name = ?', [newName, oldName]);
    dbRun('UPDATE records SET store_name = ? WHERE store_name = ?', [newName, oldName]);
  });

  // 店家编号映射（按用户提供的顺序）
  const storeNumberMap = {
    '功夫Pai金银潭永旺店': 'NO1',
    '头等舱·武汉新天地店': 'NO1',
    '头等舱·万象城店': 'NO2',
    '光谷天地店': 'NO3',
    '杨家湾店': 'NO4',
    '南京路店': 'NO6',
    '江腾广场店': 'NO7',
    '宝丰路店': 'NO8',
    '一元路店': 'NO9',
    '汉街店': 'NO10',
    '后湖店': 'NO12',
    '王家湾店': 'NO13',
    '会展中心店': 'NO14',
    '人信汇店': 'NO15',
    '汉街精选店': 'NO16',
    '范湖万达店': 'NO17',
    '沌口店': 'NO18',
    '永旺店': 'NO19',
    '佳园路店': 'NO20',
    '凯德西城店': 'NO21',
    '融侨华府店': 'NO22',
    '佛祖岭店': 'NO23',
    '同学广场店': 'NO24',
    '钟家村店': 'NO25',
    '新华家园店': 'NO26',
    '洪山万科店': 'NO27',
    '南湖店': 'NO28',
    '欢乐谷店': 'NO29',
    '青山印象城店': 'NO30',
    '新世界国贸店': 'NO31',
    '江夏纸坊店': 'NO32',
  };

  // 旧门店名称 → 新门店名称映射（全面覆盖）
  const storeNameMigration = {
    '楚河汉街店': '汉街店',
    '青年路店': '宝丰路店',
    '汉阳店': '人信汇店',
    '范湖店': '范湖万达店',
    '范湖万达': '范湖万达店',
    '金潭中心店': '会展中心店',
    '八佰店': '凯德西城店',
    '汉阳四新大道店': '汉街精选店',
    '汉商银座店': '融侨华府店',
    '康桥居店': '佛祖岭店',
    '茂华居店': '同学广场店',
    '同学广场': '同学广场店',
    '茶百道店': '青山印象城店',
    '青山印象城': '青山印象城店',
    '新世界百货店': '新世界国贸店',
    '武汉新天地店': '头等舱·武汉新天地店',
    '武汉天地店': '头等舱·武汉新天地店',
    '武昌万商店': '头等舱·万象城店',
    '万象城店': '头等舱·万象城店',
    '公司总部': '公司总部',
    '光谷天地店': '光谷天地店',
    '杨家湾店': '杨家湾店',
    '南京路店': '南京路店',
    '江腾广场店': '江腾广场店',
    '一元路店': '一元路店',
    '后湖店': '后湖店',
    '王家湾店': '王家湾店',
    '沌口店': '沌口店',
    '永旺店': '永旺店',
    '佳园路店': '佳园路店',
    '钟家村店': '钟家村店',
    '钟家村': '钟家村店',
    '新华家园店': '新华家园店',
    '洪山万科店': '洪山万科店',
    '万科店': '洪山万科店',
    '万科': '洪山万科店',
    '南湖店': '南湖店',
    '欢乐谷店': '欢乐谷店',
    '江夏纸坊店': '江夏纸坊店',
  };

  // 先迁移门店名称
  Object.entries(storeNameMigration).forEach(([oldName, newName]) => {
    dbRun('UPDATE employees SET store_name = ? WHERE store_name = ?', [newName, oldName]);
    dbRun('UPDATE records SET store_name = ? WHERE store_name = ?', [newName, oldName]);
    dbRun('UPDATE users SET store_name = ? WHERE store_name = ?', [newName, oldName]);
  });

  // 再更新所有员工的店家编号
  const allEmployees = dbAll('SELECT id, store_name FROM employees');
  allEmployees.forEach(emp => {
    const number = storeNumberMap[emp.store_name];
    if (number) {
      dbRun('UPDATE employees SET store_number = ? WHERE id = ?', [number, emp.id]);
    }
  });
  if (allEmployees.length > 0) {
    saveDb();
    console.log(`[店家编号] 已为 ${allEmployees.length} 名员工更新店家编号`);
  }
}

const app = express();

// ============ 数据库自动备份 ============

// 备份数据库到邮箱
async function backupDatabase() {
  try {
    const emailConfig = getEmailConfig();
    if (!emailConfig || !emailConfig.enabled) {
      console.log('[备份] 邮箱未配置或已禁用，跳过备份');
      return;
    }

    // 读取数据库文件
    const dbPath = join(__dirname, 'database', 'rongrubi.db');
    if (!fs.existsSync(dbPath)) {
      console.log('[备份] 数据库文件不存在，跳过备份');
      return;
    }

    const dbBuffer = fs.readFileSync(dbPath);
    
    // 创建nodemailer transporter
    const nodemailer = await import('nodemailer');
    const transporter = nodemailer.default.createTransport({
      host: emailConfig.smtpHost,
      port: emailConfig.smtpPort,
      secure: true,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.password
      }
    });

    // 发送邮件
    await transporter.sendMail({
      from: emailConfig.email,
      to: emailConfig.email,
      subject: `【自动备份】臻品足道荣辱榜数据库 - ${new Date().toLocaleString('zh-CN')}`,
      text: `数据库自动备份\n备份时间: ${new Date().toLocaleString('zh-CN')}\n数据库大小: ${(dbBuffer.length / 1024).toFixed(2)} KB`,
      attachments: [
        {
          filename: `rongrubi_backup_${Date.now()}.db`,
          content: dbBuffer
        }
      ]
    });

    console.log('[备份] 数据库备份邮件发送成功');
  } catch (err) {
    console.error('[备份] 备份失败:', err.message);
  }
}

// 启动定时备份(每6小时一次)
function startAutoBackup() {
  const SIX_HOURS = 6 * 60 * 60 * 1000;
  setInterval(async () => {
    console.log('[备份] 开始自动备份...');
    await backupDatabase();
  }, SIX_HOURS);
  
  // 首次启动时立即备份一次
  setTimeout(async () => {
    console.log('[备份] 启动时立即备份...');
    await backupDatabase();
  }, 5000);
}

// ============ 安全加固 ============

// 1. 安全 HTTP headers（防止 XSS、点击劫持、嗅探等）
app.use(helmet({
  crossOriginResourcePolicy: false, // 允许静态资源跨域加载（解决 Vite crossorigin 问题）
  contentSecurityPolicy: false      // 允许内联脚本和样式
}));

// 2. CORS 配置：支持公网访问（仅对 API 路由生效，静态文件不受影响）
const ALLOWED_ORIGINS = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:3000',
  'http://localhost:3002',
  'https://zhenpin-rongrubi.vercel.app',
  'https://zhenpin-rongrubi-production.up.railway.app'
];
app.use('/api', cors({
  origin: function (origin, callback) {
    // 允许无 origin 的请求（如服务端调用、移动端）
    if (!origin || ALLOWED_ORIGINS.includes(origin) || origin?.includes('.cpolar') || origin?.includes('.ngrok') || origin?.includes('.natapp') || origin?.includes('.vercel.app') || origin?.includes('.railway.app')) {
      callback(null, true);
    } else {
      callback(null, true); // 放宽限制，避免阻塞静态资源
    }
  },
  credentials: true
}));

// 3. 请求体大小限制（防止大请求攻击）
app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// 4. 全局请求频率限制（每个 IP 最多 100 请求/15分钟）
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: '请求过于频繁，请稍后再试' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use(globalLimiter);

// 5. 登录/注册接口严格限制（每个 IP 最多 10 次/15分钟，防爆破）
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: '登录尝试次数过多，请15分钟后再试' },
  standardHeaders: true,
  legacyHeaders: false
});

// 配置文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, uniqueSuffix + '.' + ext);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/plain'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('不支持的文件类型，仅支持 PDF、Word、Excel 和文本文件'));
    }
  }
});

// JWT 密钥（随机生成，每次重启会失效，更安全）
const JWT_SECRET_FILE = join(__dirname, 'jwt-secret.key');
let JWT_SECRET;
if (fs.existsSync(JWT_SECRET_FILE)) {
  JWT_SECRET = fs.readFileSync(JWT_SECRET_FILE, 'utf-8');
} else {
  JWT_SECRET = crypto.randomBytes(64).toString('hex');
  fs.writeFileSync(JWT_SECRET_FILE, JWT_SECRET);
}
console.log('[安全] JWT密钥已生成');

// ============ 邮箱配置 ============
const EMAIL_CONFIG_PATH = join(__dirname, 'email-config.json');
let emailConfig = null;

function loadEmailConfig() {
  // 优先从环境变量读取（Railway 部署）
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    emailConfig = {
      email: process.env.EMAIL_USER,
      password: process.env.EMAIL_PASS,
      smtpHost: process.env.EMAIL_SMTP_HOST || 'smtp.139.com',
      smtpPort: parseInt(process.env.EMAIL_SMTP_PORT) || 465,
      enabled: true
    };
    console.log('[邮箱] 从环境变量加载配置:', emailConfig.email);
    return;
  }
  
  // 从配置文件读取（本地开发）
  if (fs.existsSync(EMAIL_CONFIG_PATH)) {
    emailConfig = JSON.parse(fs.readFileSync(EMAIL_CONFIG_PATH, 'utf-8'));
    console.log('[邮箱] 从配置文件加载:', emailConfig.email);
  }
}

// 生成Excel报告
function generateExcelReport(records, filename) {
  const wb = XLSX.utils.book_new();
  
  // 按门店分组
  const storeGroups = {};
  records.forEach(r => {
    if (!storeGroups[r.store]) storeGroups[r.store] = [];
    storeGroups[r.store].push(r);
  });
  
  // 为每个门店创建一个sheet
  Object.entries(storeGroups).forEach(([store, storeRecords]) => {
    const data = [['门店', '姓名', '月份', '类型', '事项', '扣分', '日期']];
    
    storeRecords.forEach(r => {
      r.items.forEach(item => {
        data.push([
          r.store,
          r.name,
          r.month,
          item.type === 'honor' ? '荣' : '辱',
          item.title,
          item.description || '',
          item.date || ''
        ]);
      });
    });
    
    const ws = XLSX.utils.aoa_to_sheet(data);
    XLSX.utils.book_append_sheet(wb, ws, store.substring(0, 31)); // sheet名最长31字符
  });
  
  // 生成buffer
  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
  return buf;
}

// 发送邮件
async function sendImportEmail(records, stats, originalFilename) {
  if (!emailConfig || !emailConfig.enabled) {
    console.log('[邮箱] 未配置或已禁用，跳过发送');
    return;
  }
  
  try {
    const transporter = nodemailer.createTransport({
      host: emailConfig.smtpHost || 'smtp.139.com',
      port: emailConfig.smtpPort || 465,
      secure: true,
      auth: {
        user: emailConfig.email,
        pass: emailConfig.password
      }
    });
    
    // 生成Excel附件
    const excelBuffer = generateExcelReport(records, originalFilename);
    const timestamp = new Date().toLocaleString('zh-CN');
    
    const mailOptions = {
      from: emailConfig.email,
      to: emailConfig.email,
      subject: `【荣辱榜】${timestamp} - ${stats.totalRecords}条记录已导入`,
      text: `荣辱榜数据导入报告\n\n导入时间: ${timestamp}\n导入文件: ${originalFilename}\n总记录数: ${stats.totalRecords}\n总明细数: ${stats.totalItems}\n新建员工: ${stats.newEmployees}\n涉及门店: ${stats.stores.join(', ')}`,
      html: `
        <div style="font-family: Arial, sans-serif; padding: 20px;">
          <h2 style="color: #1890ff;">荣辱榜数据导入报告</h2>
          <table style="border-collapse: collapse; width: 100%; margin-top: 20px;">
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">导入时间</td><td style="padding: 8px; border: 1px solid #ddd;">${timestamp}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">导入文件</td><td style="padding: 8px; border: 1px solid #ddd;">${originalFilename}</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">总记录数</td><td style="padding: 8px; border: 1px solid #ddd; color: #1890ff; font-size: 18px;">${stats.totalRecords} 条</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">总明细数</td><td style="padding: 8px; border: 1px solid #ddd; color: #52c41a; font-size: 18px;">${stats.totalItems} 条</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">新建员工</td><td style="padding: 8px; border: 1px solid #ddd; color: #fa8c16; font-size: 18px;">${stats.newEmployees} 人</td></tr>
            <tr><td style="padding: 8px; border: 1px solid #ddd; font-weight: bold;">涉及门店</td><td style="padding: 8px; border: 1px solid #ddd;">${stats.stores.join(', ')}</td></tr>
          </table>
          <p style="color: #666; margin-top: 30px; font-size: 12px;">
            此邮件由臻品足道荣辱榜系统自动发送<br>
            附件为本次导入的完整数据Excel报表
          </p>
        </div>
      `,
      attachments: [
        {
          filename: `荣辱榜导入_${originalFilename.replace(/\.[^.]+$/, '')}_${Date.now()}.xlsx`,
          content: excelBuffer
        }
      ]
    };
    
    await transporter.sendMail(mailOptions);
    console.log('[邮箱] 导入报告已发送至:', emailConfig.email);
    return true;
  } catch (err) {
    console.error('[邮箱] 发送失败:', err.message);
    return false;
  }
}

// 加载邮箱配置
loadEmailConfig();

console.log('=== 代码版本: 2026-08-28-v3 修改密码调试 ===');

// 认证中间件
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: '未授权' });

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: '令牌无效' });
  }
};

const requireAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '权限不足' });
  }
  next();
};

// 禁止viewer角色进行写操作
const noViewer = (req, res, next) => {
  if (req.user.role === 'viewer') {
    return res.status(403).json({ error: '查询账户无此权限' });
  }
  next();
};

// 登录
app.post('/api/auth/login', authLimiter, (req, res) => {
  const { username, password } = req.body;
  const user = dbGet('SELECT * FROM users WHERE username = ?', [username]);

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ error: '用户名或密码错误' });
  }

  if (user.disabled) {
    return res.status(403).json({ error: '该账户已被禁用，请联系管理员' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, store_name: user.store_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  // 记录登录日志
  logOperation(req, 'LOGIN', 'user', user.id, {
    username: user.username,
    role: user.role
  });

  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      store_name: user.store_name
    }
  });
});

// ============ 验证码登录 ============
const verificationCodes = new Map(); // 存储验证码 {phone: {code, expire}}

// 发送验证码
app.post('/api/auth/send-code', authLimiter, async (req, res) => {
  const { phone } = req.body;
  
  if (!phone || !/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' });
  }
  
  // 生成6位验证码
  const code = Math.floor(100000 + Math.random() * 900000).toString();
  const expire = Date.now() + 5 * 60 * 1000; // 5分钟过期
  
  verificationCodes.set(phone, { code, expire });
  
  // 发送到139邮箱
  if (emailConfig && emailConfig.enabled) {
    try {
      const transporter = nodemailer.createTransport({
        host: emailConfig.smtpHost || 'smtp.139.com',
        port: emailConfig.smtpPort || 465,
        secure: true,
        auth: {
          user: emailConfig.email,
          pass: emailConfig.password
        }
      });
      
      await transporter.sendMail({
        from: emailConfig.email,
        to: emailConfig.email,
        subject: `【荣辱榜验证码】${code}`,
        text: `手机号：${phone}\n验证码：${code}\n有效期：5分钟\n\n此验证码由臻品足道荣辱榜系统发送`,
        html: `
          <div style="font-family: Arial, sans-serif; padding: 20px;">
            <h2 style="color: #1890ff;">荣辱榜登录验证码</h2>
            <table style="border-collapse: collapse; margin-top: 20px;">
              <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">手机号</td><td style="padding: 10px; border: 1px solid #ddd;">${phone}</td></tr>
              <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">验证码</td><td style="padding: 10px; border: 1px solid #ddd; font-size: 24px; color: #fa8c16; font-weight: bold;">${code}</td></tr>
              <tr><td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">有效期</td><td style="padding: 10px; border: 1px solid #ddd;">5分钟</td></tr>
            </table>
            <p style="color: #666; margin-top: 20px; font-size: 12px;">
              此验证码由臻品足道荣辱榜系统自动发送<br>
              如非本人操作，请忽略此邮件
            </p>
          </div>
        `
      });
      
      console.log('[验证码] 已发送至:', phone, '验证码:', code);
      res.json({ message: '验证码已发送，请联系管理员获取' });
    } catch (err) {
      console.error('[验证码] 发送失败:', err.message);
      // 备用方案：邮件发送失败时直接返回验证码（Railway可能封锁SMTP端口）
      console.log('[验证码] 备用方案：直接返回验证码', code);
      res.json({ message: '验证码已生成（邮件发送失败，请查看下方验证码）', code });
    }
  } else {
    // 开发模式：直接返回验证码
    console.log('[验证码] 邮箱未配置，验证码:', code);
    res.json({ message: '验证码已生成（开发模式）', code });
  }
});

// 验证码登录
app.post('/api/auth/verify-code', authLimiter, (req, res) => {
  const { phone, code } = req.body;
  
  if (!phone || !code) {
    return res.status(400).json({ error: '请输入手机号和验证码' });
  }
  
  const stored = verificationCodes.get(phone);
  
  if (!stored) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }
  
  if (Date.now() > stored.expire) {
    verificationCodes.delete(phone);
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }
  
  if (stored.code !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  
  // 验证成功，删除验证码
  verificationCodes.delete(phone);
  
  // 查找或创建用户
  let user = dbGet('SELECT * FROM users WHERE username = ?', [phone]);
  
  if (!user) {
    // 自动创建用户（默认store角色，需要管理员后续分配门店）
    const password = bcrypt.hashSync('123456', 10);
    const result = dbRun(
      'INSERT INTO users (username, password, role, store_name) VALUES (?, ?, ?, ?)',
      [phone, password, 'store', null]
    );
    user = dbGet('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
    console.log('[验证码登录] 自动创建用户:', phone);
  }
  
  if (user.disabled) {
    return res.status(403).json({ error: '该账户已被禁用，请联系管理员' });
  }
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, store_name: user.store_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      store_name: user.store_name
    }
  });
});

// 获取当前用户信息
app.get('/api/auth/me', authenticate, (req, res) => {
  res.json({ user: req.user });
});

// ============ 门店自助注册 ============

// 获取门店列表（公开接口，注册页面用）
app.get('/api/public/stores', (req, res) => {
  const storesFromEmployees = dbAll('SELECT DISTINCT store_name FROM employees WHERE store_name IS NOT NULL');
  const storesFromUsers = dbAll('SELECT DISTINCT store_name FROM users WHERE role = ? AND store_name IS NOT NULL', ['store']);
  const allStores = new Set([
    ...storesFromEmployees.map(s => s.store_name),
    ...storesFromUsers.map(s => s.store_name)
  ]);
  res.json({ stores: [...allStores] });
});

// 清理占位员工（仅admin可用）
app.post('/api/admin/cleanup-placeholders', authenticate, noViewer, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以操作' });
  }
  
  const placeholders = dbAll("SELECT id, name, store_name FROM employees WHERE name LIKE '[待补全]%'");
  
  placeholders.forEach(emp => {
    dbRun("UPDATE employees SET name = ? WHERE id = ?", [`未知员工(${emp.store_name})`, emp.id]);
  });
  
  saveDb();
  console.log(`[清理] 已清理 ${placeholders.length} 个占位员工`);
  res.json({ message: `已清理 ${placeholders.length} 个占位员工`, count: placeholders.length });
});

// 创建新门店（仅admin可用）
app.post('/api/admin/stores', authenticate, noViewer, (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({ error: '只有管理员可以创建新门店' });
  }
  
  const { store_name } = req.body;
  
  if (!store_name || typeof store_name !== 'string' || store_name.trim() === '') {
    return res.status(400).json({ error: '门店名称不能为空' });
  }
  
  const trimmedName = store_name.trim();
  
  // 检查是否已存在
  const existing = dbGet(
    'SELECT id FROM employees WHERE store_name = ? LIMIT 1',
    [trimmedName]
  );
  
  if (existing) {
    return res.status(400).json({ error: `门店"${trimmedName}"已存在` });
  }
  
  // 创建一个虚拟员工记录来保存门店名称
  try {
    dbRun(
      'INSERT INTO employees (name, store_name, id_number, is_director, promotion_date) VALUES (?, ?, ?, 0, ?)',
      [`[门店] ${trimmedName}`, trimmedName, `STORE-${Date.now()}`, new Date().toISOString().split('T')[0]]
    );
    saveDb();
  } catch (err) {
    console.error('[门店创建] 数据库错误:', err.message);
    return res.status(500).json({ error: '创建失败: ' + err.message });
  }
  
  console.log(`✓ 管理员 ${req.user.username} 创建了新门店: ${trimmedName}`);
  
  res.json({ 
    message: `门店"${trimmedName}"创建成功`,
    store_name: trimmedName
  });
});

// 注册接口
app.post('/api/auth/register', authLimiter, async (req, res) => {
  const { phone, code, password, store_name } = req.body;
  
  if (!phone || !code || !password || !store_name) {
    return res.status(400).json({ error: '请填写完整注册信息' });
  }
  
  if (!/^1\d{10}$/.test(phone)) {
    return res.status(400).json({ error: '请输入正确的手机号' });
  }
  
  if (password.length < 6) {
    return res.status(400).json({ error: '密码至少6位' });
  }
  
  // 检查手机号是否已注册
  const existingUser = dbGet('SELECT * FROM users WHERE username = ?', [phone]);
  if (existingUser) {
    return res.status(400).json({ error: '该手机号已注册，请直接登录' });
  }
  
  // 检查该门店账户数量（每个门店最多2个账户）
  const storeAccounts = dbAll(
    'SELECT id FROM users WHERE store_name = ? AND role = ?',
    [store_name, 'store']
  );
  if (storeAccounts.length >= 2) {
    return res.status(400).json({ error: `该门店已有${storeAccounts.length}个账户（最多2个），请先删除离职员工账户再注册` });
  }
  
  // 验证验证码
  const stored = verificationCodes.get(phone);
  if (!stored) {
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }
  if (Date.now() > stored.expire) {
    verificationCodes.delete(phone);
    return res.status(400).json({ error: '验证码已过期，请重新获取' });
  }
  if (stored.code !== code) {
    return res.status(400).json({ error: '验证码错误' });
  }
  
  // 验证成功，创建用户
  verificationCodes.delete(phone);
  const hashedPassword = bcrypt.hashSync(password, 10);
  const result = dbRun(
    'INSERT INTO users (username, password, role, store_name) VALUES (?, ?, ?, ?)',
    [phone, hashedPassword, 'store', store_name]
  );
  
  const user = dbGet('SELECT * FROM users WHERE id = ?', [result.lastInsertRowid]);
  console.log('[注册] 新门店注册:', phone, store_name);
  
  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role, store_name: user.store_name },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
  
  res.json({
    message: '注册成功',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
      store_name: user.store_name
    }
  });
});

// 员工管理
// 计算入职年限
function calculateWorkYears(hireDate) {
  if (!hireDate) return null;
  
  const hire = new Date(hireDate);
  const now = new Date();
  
  let years = now.getFullYear() - hire.getFullYear();
  const monthDiff = now.getMonth() - hire.getMonth();
  
  // 如果还没到入职周年,减1年
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < hire.getDate())) {
    years--;
  }
  
  return years >= 0 ? years : 0;
}

// 格式化入职年限显示
function formatWorkYears(years) {
  if (years === null) return '未设置';
  return `${years}年`;
}

app.get('/api/employees', authenticate, (req, res) => {
  let sql = 'SELECT * FROM employees';
  const params = [];

  if (req.user.role === 'store') {
    sql += ' WHERE store_name = ?';
    params.push(req.user.store_name);
  }

  sql += " ORDER BY CASE WHEN store_number IS NOT NULL THEN CAST(REPLACE(store_number, 'NO', '') AS INTEGER) ELSE 999 END, created_at DESC";
  const employees = dbAll(sql, params);
  
  // 为每个员工添加入职年限
  const employeesWithYears = employees.map(emp => ({
    ...emp,
    work_years: calculateWorkYears(emp.hire_date),
    work_years_text: formatWorkYears(calculateWorkYears(emp.hire_date))
  }));
  
  res.json({ employees: employeesWithYears });
});

// 门店账户创建员工（可选择门店）
app.post('/api/store/employees', authenticate, (req, res) => {
  const { name, id_number, hire_date, promotion_date, store_name } = req.body;

  if (!name || !id_number) {
    return res.status(400).json({ error: '姓名和身份证号不能为空' });
  }

  // 门店账户只能选择自己的门店，admin可选择任意门店
  let finalStoreName = store_name;
  if (req.user.role === 'store') {
    finalStoreName = req.user.store_name;
    if (!finalStoreName) {
      return res.status(400).json({ error: '当前账户未绑定门店' });
    }
  }
  if (!finalStoreName) {
    return res.status(400).json({ error: '请选择所属门店' });
  }

  try {
    const result = dbRun(
      'INSERT INTO employees (name, id_number, store_name, hire_date, promotion_date, is_director) VALUES (?, ?, ?, ?, ?, 0)',
      [name, id_number, finalStoreName, hire_date || null, promotion_date || null]
    );
    saveDb();

    logOperation(req, 'CREATE', 'employee', result.lastInsertRowid, {
      name,
      store_name: finalStoreName
    });

    res.json({ id: result.lastInsertRowid, message: '添加成功' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '身份证号已存在' });
    }
    res.status(500).json({ error: '添加失败: ' + err.message });
  }
});

app.post('/api/employees', authenticate, requireAdmin, (req, res) => {
  const { name, id_number, store_name, promotion_date, hire_date } = req.body;

  if (!name || !id_number || !store_name) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  try {
    const result = dbRun('INSERT INTO employees (name, id_number, store_name, hire_date, promotion_date) VALUES (?, ?, ?, ?, ?)', [name, id_number, store_name, hire_date || null, promotion_date || null]);
    saveDb();
    
    // 记录日志
    logOperation(req, 'CREATE', 'employee', result.lastInsertRowid, {
      name,
      store_name
    });
    
    res.json({ id: result.lastInsertRowid, message: '添加成功' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '身份证号已存在' });
    }
    res.status(500).json({ error: '添加失败' });
  }
});

app.put('/api/employees/:id', authenticate, requireAdmin, (req, res) => {
  const { name, id_number, store_name, promotion_date } = req.body;

  try {
    dbRun('UPDATE employees SET name = ?, id_number = ?, store_name = ?, promotion_date = ? WHERE id = ?', [name, id_number, store_name, promotion_date, req.params.id]);
    saveDb();
    
    // 记录日志
    logOperation(req, 'UPDATE', 'employee', req.params.id, {
      name,
      store_name
    });
    
    res.json({ message: '更新成功' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '身份证号已存在' });
    }
    res.status(500).json({ error: '更新失败' });
  }
});

app.delete('/api/employees/:id', authenticate, requireAdmin, (req, res) => {
  const employeeId = req.params.id;
  
  dbRun('DELETE FROM employees WHERE id = ?', [employeeId]);
  saveDb();
  
  // 记录日志
  logOperation(req, 'DELETE', 'employee', employeeId);
  
  res.json({ message: '删除成功' });
});

// 门店调动API
app.post('/api/employees/:id/transfer', authenticate, requireAdmin, (req, res) => {
  const { to_store, transfer_date, reason } = req.body;
  const employeeId = req.params.id;

  try {
    // 获取员工当前门店
    const employee = dbAll('SELECT * FROM employees WHERE id = ?', [employeeId])[0];
    if (!employee) return res.status(404).json({ error: '员工不存在' });

    const fromStore = employee.store_name;

    // 更新员工门店
    dbRun('UPDATE employees SET store_name = ? WHERE id = ?', [to_store, employeeId]);

    // 记录调动历史
    dbRun(
      'INSERT INTO store_transfers (employee_id, from_store, to_store, transfer_date, reason) VALUES (?, ?, ?, ?, ?)',
      [employeeId, fromStore, to_store, transfer_date, reason]
    );

    // 同步更新records表
    dbRun('UPDATE records SET store_name = ? WHERE employee_id = ? AND store_name = ?', [to_store, employeeId, fromStore]);

    saveDb();
    res.json({ message: `已将 ${employee.name} 从 ${fromStore} 调动到 ${to_store}` });
  } catch (err) {
    res.status(500).json({ error: '调动失败' });
  }
});

// 获取员工调动历史
app.get('/api/employees/:id/transfers', authenticate, (req, res) => {
  const transfers = dbAll(
    'SELECT * FROM store_transfers WHERE employee_id = ? ORDER BY transfer_date DESC',
    [req.params.id]
  );
  res.json({ transfers });
});

// 设置总监
app.put('/api/employees/:id/set-director', authenticate, requireAdmin, (req, res) => {
  const { is_director } = req.body;
  try {
    dbRun('UPDATE employees SET is_director = ? WHERE id = ?', [is_director ? 1 : 0, req.params.id]);
    saveDb();
    res.json({ message: is_director ? '已设为总监' : '已取消总监' });
  } catch (err) {
    res.status(500).json({ error: '操作失败' });
  }
});

// 记录管理
app.get('/api/records', authenticate, (req, res) => {
  let sql = `
    SELECT r.*, e.name as employee_name, e.id_number,
           u.username as submitted_by_name
    FROM records r
    LEFT JOIN employees e ON r.employee_id = e.id
    JOIN users u ON r.submitted_by = u.id
  `;
  const conditions = [];
  const params = [];

  if (req.user.role === 'store') {
    conditions.push('r.store_name = ?');
    params.push(req.user.store_name);
  }

  if (req.query.store_name) {
    conditions.push('r.store_name = ?');
    params.push(req.query.store_name);
  }

  if (req.query.employee_id) {
    conditions.push('r.employee_id = ?');
    params.push(Number(req.query.employee_id));
  }

  if (req.query.month) {
    conditions.push('r.month = ?');
    params.push(req.query.month);
  }

  if (req.query.status) {
    conditions.push('r.status = ?');
    params.push(req.query.status);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  sql += ' ORDER BY r.submitted_at DESC';

  const records = dbAll(sql, params);

  records.forEach(record => {
    record.items = dbAll('SELECT * FROM record_items WHERE record_id = ?', [record.id]);
    // 处理员工被删除的情况
    if (!record.employee_name) {
      record.employee_name = '[已删除员工]';
      record.id_number = null;
    }
  });

  res.json({ records });
});

app.post('/api/records', authenticate, noViewer, (req, res) => {
  const { employee_id, month, items } = req.body;

  if (!employee_id || !month || !items || items.length === 0) {
    return res.status(400).json({ error: '请完整填写信息' });
  }

  const employee = dbGet('SELECT * FROM employees WHERE id = ?', [employee_id]);
  if (!employee) {
    return res.status(400).json({ error: '员工不存在' });
  }

  if (req.user.role === 'store' && employee.store_name !== req.user.store_name) {
    return res.status(403).json({ error: '只能为本店员工提交' });
  }

  // 检查是否已提交过该月份的记录
  const existing = dbGet('SELECT id FROM records WHERE employee_id = ? AND month = ? AND store_name = ?', [employee_id, month, employee.store_name]);
  if (existing) {
    return res.status(400).json({ error: '该员工该月份的记录已提交' });
  }

  // 获取提交者手机号（用于水印）
  const submitterPhone = req.user.phone || '未知';
  
  // 生成水印：门店+手机号
  const watermark = `${employee.store_name} - ${submitterPhone}`;

  try {
    // 使用员工的store_name，而不是提交者的store_name
    const recordStoreName = employee.store_name || req.user.store_name;
    
    const result = dbRun(
      'INSERT INTO records (employee_id, store_name, month, submitted_by) VALUES (?, ?, ?, ?)',
      [employee_id, recordStoreName, month, req.user.id]
    );
    const recordId = result.lastInsertRowid;

    items.forEach(item => {
      dbRun(
        'INSERT INTO record_items (record_id, type, title, description, date, watermark) VALUES (?, ?, ?, ?, ?, ?)',
        [recordId, item.type, item.title, item.description || '', item.date, watermark]
      );
    });

    saveDb();
    
    // 记录日志
    logOperation(req, 'CREATE', 'record', recordId, {
      employee_id,
      month,
      items_count: items.length,
      watermark
    });
    
    res.json({ id: recordId, message: '提交成功', watermark });
  } catch (err) {
    res.status(500).json({ error: '提交失败' });
  }
});

// 审核记录
app.put('/api/records/:id/review', authenticate, requireAdmin, (req, res) => {
  const { status, review_note } = req.body;

  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: '状态值无效' });
  }

  dbRun(
    'UPDATE records SET status = ?, reviewed_by = ?, review_note = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
    [status, req.user.id, review_note || null, req.params.id]
  );
  saveDb();
  
  // 记录日志
  logOperation(req, status === 'approved' ? 'APPROVE' : 'REJECT', 'record', req.params.id, {
    status,
    review_note
  });
  
  res.json({ message: status === 'approved' ? '已通过' : '已驳回' });
});

// 删除记录
app.delete('/api/records/:id', authenticate, requireAdmin, (req, res) => {
  const recordId = req.params.id;
  
  dbRun('DELETE FROM record_items WHERE record_id = ?', [recordId]);
  dbRun('DELETE FROM records WHERE id = ?', [recordId]);
  saveDb();
  
  // 记录日志
  logOperation(req, 'DELETE', 'record', recordId);
  
  res.json({ message: '删除成功' });
});

// 统计信息
app.get('/api/stats', authenticate, (req, res) => {
  const isStore = req.user.role === 'store';
  const storeParam = isStore ? [req.user.store_name] : [];

  const totalEmployees = dbGet(
    isStore ? 'SELECT COUNT(*) as count FROM employees WHERE store_name = ?' : 'SELECT COUNT(*) as count FROM employees',
    storeParam
  ).count;

  const pendingReviews = dbGet(
    isStore ? "SELECT COUNT(*) as count FROM records WHERE status = 'pending' AND store_name = ?" : "SELECT COUNT(*) as count FROM records WHERE status = 'pending'",
    storeParam
  ).count;

  const approvedRecords = dbGet(
    isStore ? "SELECT COUNT(*) as count FROM records WHERE status = 'approved' AND store_name = ?" : "SELECT COUNT(*) as count FROM records WHERE status = 'approved'",
    storeParam
  ).count;

  const totalStores = dbGet('SELECT COUNT(DISTINCT store_name) as count FROM users WHERE role = ? AND store_name IS NOT NULL', ['store']).count;

  res.json({ totalEmployees, pendingReviews, approvedRecords, totalStores });
});

// 用户管理
app.get('/api/users', authenticate, requireAdmin, (req, res) => {
  const users = dbAll('SELECT id, username, role, store_name, disabled, created_at FROM users ORDER BY created_at DESC');
  res.json({ users });
});

app.post('/api/users', authenticate, requireAdmin, (req, res) => {
  const { username, password, role, store_name } = req.body;

  if (!username || !password || !role) {
    return res.status(400).json({ error: '请填写完整信息' });
  }

  if (role === 'store' && !store_name) {
    return res.status(400).json({ error: '门店账户必须指定门店名称' });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);
    const result = dbRun('INSERT INTO users (username, password, role, store_name) VALUES (?, ?, ?, ?)', [username, hashedPassword, role, store_name || null]);
    saveDb();
    res.json({ id: result.lastInsertRowid, message: '创建成功' });
  } catch (err) {
    if (err.message && err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: '用户名已存在' });
    }
    res.status(500).json({ error: '创建失败' });
  }
});

// 编辑用户（分配门店等）
app.put('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  const { role, store_name } = req.body;
  const userId = req.params.id;
  
  const user = dbGet('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  if (role) {
    dbRun('UPDATE users SET role = ? WHERE id = ?', [role, userId]);
  }
  if (store_name !== undefined) {
    dbRun('UPDATE users SET store_name = ? WHERE id = ?', [store_name || null, userId]);
  }
  
  saveDb();
  res.json({ message: '更新成功' });
});

// 重置密码
app.put('/api/users/:id/reset-password', authenticate, requireAdmin, (req, res) => {
  const { newPassword } = req.body;
  const userId = req.params.id;
  
  if (!newPassword || newPassword.length < 6) {
    return res.status(400).json({ error: '密码至少6位' });
  }
  
  const user = dbGet('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, userId]);
  saveDb();
  console.log('[管理员] 重置密码:', req.user.username, '→', user.username);
  res.json({ message: `已重置 ${user.username} 的密码` });
});

// 修改自己的密码
app.put('/api/users/change-password', authenticate, (req, res) => {
  const { oldPassword, newPassword } = req.body;
  const userId = Number(req.user.id);  // 确保是数字类型
  
  process.stderr.write('[修改密码] req.user: ' + JSON.stringify(req.user) + ' userId: ' + userId + '\n');
  
  if (!oldPassword || !newPassword) {
    return res.status(400).json({ error: '请填写完整' });
  }
  
  if (newPassword.length < 6) {
    return res.status(400).json({ error: '新密码至少6位' });
  }
  
  // 先尝试用 ID 查找，如果找不到再用 username 查找
  let user = dbGet('SELECT * FROM users WHERE id = ?', [userId]);
  process.stderr.write('[修改密码] ID查找结果: ' + (user ? '找到' : '未找到') + '\n');
  if (!user) {
    // 备用方案：用 username 查找
    user = dbGet('SELECT * FROM users WHERE username = ?', [req.user.username]);
    process.stderr.write('[修改密码] Username查找结果：' + (user ? '找到' : '未找到') + '\n');
  }
  if (!user) {
    return res.status(404).json({ error: '用户不存在', debug: { userId, userType: typeof req.user.id, user: req.user } });
  }
  
  // 验证旧密码
  if (!bcrypt.compareSync(oldPassword, user.password)) {
    return res.status(400).json({ error: '原密码错误' });
  }
  
  const hashedPassword = bcrypt.hashSync(newPassword, 10);
  dbRun('UPDATE users SET password = ? WHERE id = ?', [hashedPassword, user.id]);
  saveDb();
  console.log('[修改密码]', req.user.username, '修改了密码');
  res.json({ message: '密码修改成功' });
});

// 禁用/启用账户
app.put('/api/users/:id/toggle-status', authenticate, requireAdmin, (req, res) => {
  const userId = req.params.id;
  
  const user = dbGet('SELECT * FROM users WHERE id = ?', [userId]);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  if (user.username === 'admin') {
    return res.status(403).json({ error: '不能禁用管理员账户' });
  }
  
  const newStatus = user.disabled ? 0 : 1;
  dbRun('UPDATE users SET disabled = ? WHERE id = ?', [newStatus, userId]);
  saveDb();
  
  const action = newStatus ? '禁用' : '启用';
  console.log(`[管理员] ${action}账户:`, req.user.username, '→', user.username);
  res.json({ message: `已${action}账户 ${user.username}` });
});

app.delete('/api/users/:id', authenticate, requireAdmin, (req, res) => {
  const user = dbGet('SELECT * FROM users WHERE id = ?', [req.params.id]);

  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }

  if (user.username === 'admin') {
    return res.status(403).json({ error: '不能删除管理员账户' });
  }

  dbRun('DELETE FROM users WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ message: '删除成功' });
});

// 获取门店列表（从员工表和用户表合并获取所有门店）
app.get('/api/stores', authenticate, (req, res) => {
  const storesFromEmployees = dbAll('SELECT DISTINCT store_name, store_number FROM employees WHERE store_name IS NOT NULL');
  const storesFromUsers = dbAll('SELECT DISTINCT store_name FROM users WHERE role = ? AND store_name IS NOT NULL', ['store']);
  const allStores = new Map();
  // 添加员工表中的门店（带编号）
  storesFromEmployees.forEach(s => {
    if (s.store_name) allStores.set(s.store_name, s.store_number || null);
  });
  // 添加用户表中的门店
  storesFromUsers.forEach(s => {
    if (s.store_name && !allStores.has(s.store_name)) allStores.set(s.store_name, null);
  });
  // 转换为数组并按编号排序
  const result = [...allStores.entries()].map(([name, number]) => ({ name, number }));
  result.sort((a, b) => {
    const getNum = (n) => {
      if (!n) return 999;
      const num = parseInt(n.replace('NO', ''));
      return isNaN(num) ? 999 : num;
    };
    return getNum(a.number) - getNum(b.number);
  });
  res.json({ stores: result });
});

// 文件上传
app.post('/api/files/upload', authenticate, upload.array('files', 10), (req, res) => {
  const employeeId = req.body.employee_id;
  
  if (!employeeId) {
    return res.status(400).json({ error: '请选择员工' });
  }

  const employee = dbGet('SELECT * FROM employees WHERE id = ?', [employeeId]);
  if (!employee) {
    return res.status(400).json({ error: '员工不存在' });
  }

  if (req.user.role === 'store' && employee.store_name !== req.user.store_name) {
    return res.status(403).json({ error: '只能为本店员工上传文件' });
  }

  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: '请选择要上传的文件' });
  }

  try {
    const uploadedFiles = [];
    req.files.forEach(file => {
      const result = dbRun(
        'INSERT INTO files (employee_id, original_name, stored_name, file_path, file_size, file_type, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [employeeId, file.originalname, file.filename, file.path, file.size, file.mimetype, req.user.id]
      );
      uploadedFiles.push({
        id: result.lastInsertRowid,
        original_name: file.originalname,
        file_size: file.size
      });
    });
    saveDb();
    res.json({ message: `成功上传 ${uploadedFiles.length} 个文件`, files: uploadedFiles });
  } catch (err) {
    res.status(500).json({ error: '上传失败' });
  }
});

// 获取员工的文件列表
app.get('/api/files', authenticate, (req, res) => {
  const employeeId = req.query.employee_id;
  
  if (!employeeId) {
    return res.status(400).json({ error: '请指定员工ID' });
  }

  const employee = dbGet('SELECT * FROM employees WHERE id = ?', [employeeId]);
  if (!employee) {
    return res.status(404).json({ error: '员工不存在' });
  }

  if (req.user.role === 'store' && employee.store_name !== req.user.store_name) {
    return res.status(403).json({ error: '无权查看该员工的文件' });
  }

  const files = dbAll(
    `SELECT f.*, u.username as uploaded_by_name 
     FROM files f 
     JOIN users u ON f.uploaded_by = u.id 
     WHERE f.employee_id = ? 
     ORDER BY f.uploaded_at DESC`,
    [employeeId]
  );

  res.json({ files });
});

// 下载文件
app.get('/api/files/:id/download', authenticate, (req, res) => {
  const file = dbGet('SELECT * FROM files WHERE id = ?', [req.params.id]);
  
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const employee = dbGet('SELECT * FROM employees WHERE id = ?', [file.employee_id]);
  if (req.user.role === 'store' && employee.store_name !== req.user.store_name) {
    return res.status(403).json({ error: '无权下载该文件' });
  }

  if (!fs.existsSync(file.file_path)) {
    return res.status(404).json({ error: '文件已被删除' });
  }

  res.download(file.file_path, file.original_name);
});

// 删除文件
app.delete('/api/files/:id', authenticate, (req, res) => {
  const file = dbGet('SELECT * FROM files WHERE id = ?', [req.params.id]);
  
  if (!file) {
    return res.status(404).json({ error: '文件不存在' });
  }

  const employee = dbGet('SELECT * FROM employees WHERE id = ?', [file.employee_id]);
  if (req.user.role === 'store' && employee.store_name !== req.user.store_name) {
    return res.status(403).json({ error: '无权删除该文件' });
  }

  // 删除物理文件
  if (fs.existsSync(file.file_path)) {
    fs.unlinkSync(file.file_path);
  }

  dbRun('DELETE FROM files WHERE id = ?', [req.params.id]);
  saveDb();
  res.json({ message: '删除成功' });
});

// ============ 批量导入解析逻辑 ============

// 临时导入文件存储
const importDir = join(__dirname, 'import_temp');
if (!fs.existsSync(importDir)) {
  fs.mkdirSync(importDir, { recursive: true });
}

const importStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, importDir),
  filename: (req, file, cb) => {
    const uniqueName = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = file.originalname.split('.').pop();
    cb(null, uniqueName + '.' + ext);
  }
});
const importUpload = multer({
  storage: importStorage,
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = file.originalname.toLowerCase().split('.').pop();
    if (['xlsx', 'xls', 'docx'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 .xlsx, .xls, .docx 格式'));
    }
  }
});

// 解析日期/月份字符串，返回 YYYY-MM 格式
function parseMonth(dateStr) {
  if (!dateStr) return null;
  const str = String(dateStr).trim();

  // Excel 序列号（如 46080 = 2026-02-08）
  if (/^\d{5}$/.test(str)) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + parseInt(str) * 86400000);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    return `${y}-${mo}`;
  }

  // "2026.1月" or "2026年1月"
  let m = str.match(/(\d{4})[.年](\d{1,2})月?/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;

  // "2025.2.5" or "2026.1.9"
  m = str.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}`;

  // "3.6" or "5.18" (当年)
  m = str.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m) return `2026-${m[1].padStart(2, '0')}`;

  // "3月" or "5月"
  m = str.match(/^(\d{1,2})月$/);
  if (m) return `2026-${m[1].padStart(2, '0')}`;

  // "1月10日"
  m = str.match(/(\d{1,2})月(\d{1,2})日?/);
  if (m) return `2026-${m[1].padStart(2, '0')}`;

  // 纯数字月份 "1", "2", "3" ... "12"
  m = str.match(/^(\d{1,2})$/);
  if (m && parseInt(m[1]) >= 1 && parseInt(m[1]) <= 12) return `2026-${m[1].padStart(2, '0')}`;

  return null;
}

// 解析日期为 YYYY-MM-DD 格式
function parseDate(dateStr) {
  if (!dateStr) return '2026-01-01';
  const str = String(dateStr).trim();

  // Excel 序列号（如 46080 = 2026-02-08）
  if (/^\d{5}$/.test(str)) {
    const excelEpoch = new Date(1899, 11, 30);
    const date = new Date(excelEpoch.getTime() + parseInt(str) * 86400000);
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${mo}-${d}`;
  }

  // "2026.1.9" or "2025.2.5"
  let m = str.match(/(\d{4})\.(\d{1,2})\.(\d{1,2})/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`;

  // "2026.1月" -> first day of month
  m = str.match(/(\d{4})[.年](\d{1,2})月?/);
  if (m) return `${m[1]}-${m[2].padStart(2, '0')}-01`;

  // "3.6" -> 2026-03-06
  m = str.match(/^(\d{1,2})\.(\d{1,2})$/);
  if (m) return `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

  // "3月" or "5月"
  m = str.match(/^(\d{1,2})月$/);
  if (m) return `2026-${m[1].padStart(2, '0')}-01`;

  // "1月10日"
  m = str.match(/(\d{1,2})月(\d{1,2})日?/);
  if (m) return `2026-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;

  return '2026-01-01';
}

// 判断记录类型（荣/辱）
function detectType(text) {
  if (!text) return 'shame';
  if (/奖励|荣誉|表扬|优秀|嘉奖/.test(text)) return 'honor';
  return 'shame';
}

// 从文件名提取门店名
function extractStoreFromFilename(filename) {
  const storePatterns = [
    '南京路店', '汉街店', '汉街精选店', '江腾广场店', '范湖万达店',
    '钟家村店', '青山印象城店', '凯德西城店', '杨家湾店', '头等舱·万象城店',
    '头等舱·武汉新天地店', '洪山万科店', '融侨华府店', '永旺店', '王家湾店',
    '江夏纸坊店', '同学广场店'
  ];
  for (const store of storePatterns) {
    const keyword = store.replace('店', '');
    if (filename.includes(keyword)) {
      console.log('[门店提取]', filename, '->', store, '(匹配关键词:', keyword + ')');
      return store;
    }
  }
  console.log('[门店提取]', filename, '-> 未匹配');
  return '';
}

// 清理数值（处理 "500R", "615元", "-200元" 等格式）
function parseScore(val) {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') return val;
  const str = String(val).trim();
  const num = str.replace(/[元Rr分]/g, '').replace(/[^\d.-]/g, '');
  const parsed = parseFloat(num);
  return isNaN(parsed) ? null : parsed;
}

// 解析Excel文件
function parseExcelFile(filePath, filename) {
  const workbook = XLSX.readFile(filePath);
  const allRecords = [];
  const storeFromFilename = extractStoreFromFilename(filename);

  // 检测文件类型：按员工分sheet vs 矩阵式
  const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
  const firstData = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

  // 检查第一个sheet的第一行是否是标题（包含员工姓名的矩阵头）
  const isMatrix = detectMatrixFormat(firstData);

  if (isMatrix) {
    // 矩阵式：所有sheet合并解析
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const records = parseMatrixSheet(data, storeFromFilename || extractStoreFromFilename(sheetName));
      allRecords.push(...records);
    });
  } else {
    // 按员工分sheet
    workbook.SheetNames.forEach(sheetName => {
      const sheet = workbook.Sheets[sheetName];
      const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      const records = parsePerEmployeeSheet(data, sheetName, storeFromFilename);
      if (records) allRecords.push(...records);
    });
  }

  return allRecords;
}

// 检测是否为矩阵格式
function detectMatrixFormat(data) {
  for (let i = 0; i < Math.min(data.length, 5); i++) {
    const row = data[i];
    if (!row || row.length < 4) continue;

    // 先检查是否为按员工sheet的表头（包含"责任人""扣分"等关键字）
    const hasHeaderKeywords = row.some(c => {
      if (!c) return false;
      const s = String(c).trim();
      return /^(责任人|扣分|事项摘要|备注|得分|分数)$/.test(s);
    });
    if (hasHeaderKeywords) return false;

    // 检查行中是否有多个看起来像姓名的列
    let nameCount = 0;
    for (let j = 2; j < row.length; j++) {
      const val = row[j];
      if (val && typeof val === 'string' && val.length >= 2 && val.length <= 4 && /[\u4e00-\u9fa5]/.test(val)) {
        // 排除常见非姓名词汇
        if (!/日期|门店|事项|扣分|合计|备注|登记|责任人|摘要|分数/.test(val)) {
          nameCount++;
        }
      }
    }
    if (nameCount >= 3) return true;
  }
  return false;
}

// 解析矩阵式工作表
function parseMatrixSheet(data, defaultStore) {
  const records = [];
  let headerRowIndex = -1;
  let employeeCols = []; // [{name, col}]
  let dateCol = -1;
  let itemCol = -1;

  // 查找表头行（包含多个姓名的行）
  for (let i = 0; i < Math.min(data.length, 10); i++) {
    const row = data[i];
    if (!row || row.length < 3) continue;

    const names = [];
    for (let j = 0; j < row.length; j++) {
      const val = row[j];
      if (val && typeof val === 'string' && val.length >= 2 && val.length <= 5 && /[\u4e00-\u9fa5]/.test(val)) {
        // 排除常见非姓名词汇
        if (!/日期|门店|事项|扣分|合计|备注|登记/.test(val)) {
          names.push({ name: val.trim(), col: j });
        }
      }
    }

    if (names.length >= 3) {
      headerRowIndex = i;
      employeeCols = names;
      // 找到日期列和事项列
      for (let j = 0; j < row.length; j++) {
        const val = row[j] ? String(row[j]) : '';
        if (val.includes('日期')) dateCol = j;
        else if (val.includes('事项') || val.includes('扣分事项')) itemCol = j;
      }
      // 如果没找到标注的列名，默认第一列是日期，第二或第三列是事项
      if (dateCol === -1) dateCol = 0;
      if (itemCol === -1) {
        // 找到第一个非日期、非员工名的列
        for (let j = 1; j < row.length; j++) {
          if (j !== dateCol && !employeeCols.find(e => e.col === j)) {
            const v = row[j] ? String(row[j]) : '';
            if (!v.includes('门店')) { itemCol = j; break; }
            else if (itemCol === -1) itemCol = j; // 门店列后面的列
          }
        }
        if (itemCol === -1) itemCol = 1;
      }
      break;
    }
  }

  if (headerRowIndex === -1 || employeeCols.length === 0) return records;

  // 提取从文件名或标题行获得的门店名
  let store = defaultStore;
  if (!store) {
    // 尝试从标题行上方的行提取
    for (let i = 0; i < headerRowIndex; i++) {
      const row = data[i];
      if (!row) continue;
      for (const cell of row) {
        if (cell) {
          const s = extractStoreFromFilename(String(cell));
          if (s) { store = s; break; }
        }
      }
      if (store) break;
    }
  }

  // 解析数据行
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    const dateStr = row[dateCol];
    const itemStr = row[itemCol];
    if (!dateStr && !itemStr) continue;

    const dateStrClean = dateStr ? String(dateStr).trim() : '';
    const itemStrClean = itemStr ? String(itemStr).trim() : '';

    // 跳过合计行
    if (dateStrClean.includes('合计') || itemStrClean.includes('合计')) continue;
    if (!dateStrClean && !itemStrClean) continue;

    const month = parseMonth(dateStrClean);
    if (!month) continue;

    const date = parseDate(dateStrClean);
    const type = detectType(itemStrClean);

    employeeCols.forEach(emp => {
      const score = parseScore(row[emp.col]);
      if (score !== null && score !== 0) {
        records.push({
          name: emp.name,
          idCard: '',
          store: store,
          month: month,
          type: type,
          title: itemStrClean,
          description: score ? `扣${Math.abs(score)}分` : '',
          score: Math.abs(score),
          date: date
        });
      }
    });
  }

  return records;
}

// 解析按员工分sheet的工作表
function parsePerEmployeeSheet(data, sheetName, defaultStore) {
  if (!data || data.length < 2) return null;

  // 从标题行提取门店和员工名
  let store = defaultStore || '';
  let empName = '';
  const titleRow = data[0] ? data[0].join(' ') : '';

  // 尝试从标题提取门店
  if (!store) {
    const storeMatch = titleRow.match(/([\u4e00-\u9fa5]+(?:店|精选店|广场店|万达店|印象城店))/);
    if (storeMatch) store = storeMatch[1];
  }
  if (!store) {
    const locMatch = titleRow.match(/([\u4e00-\u9fa5]{2,6})\d{4}年/);
    if (locMatch) {
      const loc = locMatch[1];
      if (!/^(工作|管理层|荣辱|扣分|明细|登记表|月份)$/.test(loc)) {
        store = loc + '店';
      }
    }
  }

  // 查找表头行
  let headerRowIndex = -1;
  let colNameIdx = -1, colItemIdx = -1, colScoreIdx = -1, colDateIdx = -1;

  for (let i = 0; i < Math.min(data.length, 5); i++) {
    const row = data[i];
    if (!row) continue;
    // 精确匹配列名（避免标题行中的"登记表"等误匹配）
    const hasDate = row.some(c => c && /^(日期|月份)$/.test(String(c).trim()));
    const hasItem = row.some(c => c && /^(事项摘要|扣分事项|扣分原因|事项|摘要|原因|事由|处罚)$/.test(String(c).trim()));
    const hasScore = row.some(c => c && /^(扣分|分数|得分)$/.test(String(c).trim()));
    const hasPosition = row.some(c => c && /^(职务|岗位|职位)$/.test(String(c).trim()));
    const hasName = row.some(c => c && /^(姓名|责任人|名字)$/.test(String(c).trim()));
    if (hasDate && (hasItem || hasScore || hasPosition || hasName)) {
      headerRowIndex = i;
      row.forEach((cell, j) => {
        if (!cell) return;
        const s = String(cell).trim();
        if (s === '日期' || s === '月份') colDateIdx = j;
        else if (s === '事项摘要' || s === '扣分事项' || s === '扣分原因' || s === '事项' || s === '摘要' || s === '原因' || s === '事由' || s === '处罚') colItemIdx = j;
        else if (s === '责任人' || s === '姓名' || s === '名字') colNameIdx = j;
        else if (s === '扣分' || s === '分数' || s === '得分') colScoreIdx = j;
        else if (s === '职务' || s === '岗位' || s === '职位') { /* 职务列，忽略 */ }
      });
      break;
    }
  }

  // 如果没有找到表头行，尝试检测无表头的纯数据格式（如杨家湾店：日期|事项|责任人|扣分）
  if (headerRowIndex === -1) {
    for (let i = 1; i < Math.min(data.length, 5); i++) {
      const row = data[i];
      if (!row || row.length < 3) continue;
      const firstCell = String(row[0] || '').trim();
      const secondCell = String(row[1] || '').trim();
      // 如果第一列像日期（数字.数字 或 5位Excel序列号），第二列是中文文本
      const looksLikeDate = /^\d{1,2}\.\d{1,2}$/.test(firstCell) || /^\d{5}$/.test(firstCell);
      const looksLikeText = secondCell.length > 2 && /[\u4e00-\u9fa5]/.test(secondCell);
      if (looksLikeDate && looksLikeText) {
        // 隐式表头：col0=日期, col1=事项, col2=责任人, col3=扣分
        headerRowIndex = 0; // 从第0行之后开始（跳过标题行）
        colDateIdx = 0;
        colItemIdx = 1;
        colNameIdx = 2;
        colScoreIdx = 3;
        break;
      }
    }
  }

  if (headerRowIndex === -1) return null;

  // 从标题行或sheet名提取员工名（仅当数据中没有姓名列时使用）
  const nameInData = colNameIdx >= 0; // 数据行中有姓名列
  if (!nameInData) {
    // 优先从sheet名提取（sheet名通常就是员工名，如"吴欣宇"、"陈光辉"）
    const sheetNameClean = sheetName.replace(/[^\u4e00-\u9fa5]/g, '');
    if (sheetNameClean.length >= 2 && sheetNameClean.length <= 4) {
      empName = sheetNameClean;
    }
    if (!empName) {
      // 从标题行提取：匹配年份+月份后面的姓名
      const titleMatch = titleRow.match(/\d{4}年(?:\d{1,2}月?)?([\u4e00-\u9fa5]{2,4})(?:工作|管理层|的)/);
      if (titleMatch) empName = titleMatch[1];
    }
    if (!empName) {
      // 回退：匹配任何姓名+工作/管理层/的
      const fallbackMatch = titleRow.match(/([\u4e00-\u9fa5]{2,4})(?:工作|管理层|的)/);
      if (fallbackMatch) empName = fallbackMatch[1];
    }
    if (!empName) {
      // 从数据行中获取
      for (let i = headerRowIndex + 1; i < data.length; i++) {
        const row = data[i];
        if (!row) continue;
        if (colNameIdx >= 0 && row[colNameIdx]) {
          empName = String(row[colNameIdx]).trim();
          break;
        }
      }
    }
    // 清理姓名中的空格
    if (empName) empName = empName.replace(/\s+/g, '');
    if (!empName) empName = sheetNameClean || sheetName.replace(/[^\u4e00-\u9fa5]/g, '');
  }

  // 解析数据行
  const records = [];
  let lastName = '';
  for (let i = headerRowIndex + 1; i < data.length; i++) {
    const row = data[i];
    if (!row || row.length < 2) continue;

    const dateStr = colDateIdx >= 0 ? row[colDateIdx] : row[0];
    // 优先使用item列，其次使用score列旁边的文本列，最后回退到row[1]
    let itemStr;
    if (colItemIdx >= 0) {
      itemStr = row[colItemIdx];
    } else if (colScoreIdx >= 0 && colScoreIdx + 1 < row.length) {
      itemStr = row[colScoreIdx + 1]; // 扣分列后面可能是事由
    } else {
      itemStr = row[1];
    }
    const score = colScoreIdx >= 0 ? parseScore(row[colScoreIdx]) : parseScore(row[row.length - 1]);

    if (!itemStr) continue;
    const itemStrClean = String(itemStr).trim();
    if (itemStrClean.includes('合计') || itemStrClean === '' || itemStrClean === '无') continue;

    const month = parseMonth(dateStr);
    if (!month) continue;

    const date = parseDate(dateStr);
    const type = detectType(itemStrClean);

    // 如果数据中有姓名列，使用每行的姓名（支持跨行继承）；否则使用sheet名
    let rowName;
    if (nameInData && colNameIdx >= 0) {
      const currentName = row[colNameIdx] ? String(row[colNameIdx]).trim().replace(/\s+/g, '') : '';
      if (currentName) {
        lastName = currentName;
        rowName = currentName;
      } else {
        rowName = lastName;
      }
    } else {
      rowName = empName;
    }

    if (!rowName) continue;

    records.push({
      name: rowName,
      idCard: '',
      store: store,
      month: month,
      type: type,
      title: itemStrClean,
      description: score ? `扣${Math.abs(score)}分` : '',
      score: score ? Math.abs(score) : 0,
      date: date
    });
  }

  return records.length > 0 ? records : null;
}

// 解析Word文件
async function parseWordFile(filePath, filename) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  const lines = text.split('\n').filter(l => l.trim());
  const store = extractStoreFromFilename(filename);

  // 检测格式：结构化（有"姓名："）还是非结构化
  const isStructured = lines.some(l => /姓名[：:]/.test(l));

  if (isStructured) {
    return parseStructuredWord(lines, store);
  } else {
    return parseUnstructuredWord(lines, store);
  }
}

// 解析结构化Word（钟家村/融侨华府格式）
function parseStructuredWord(lines, defaultStore) {
  const records = [];
  let current = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // 姓名
    const nameMatch = trimmed.match(/姓名[：:]\s*(.+)/);
    if (nameMatch) {
      if (current) records.push(current);
      current = { name: nameMatch[1].trim(), idCard: '', store: defaultStore, entry: '', promotionDate: '', items: [] };
      continue;
    }

    if (!current) continue;

    // 身份证
    const idMatch = trimmed.match(/身份证[：:]\s*(\d+)/);
    if (idMatch) { current.idCard = idMatch[1]; continue; }

    // 入职日期
    const entryMatch = trimmed.match(/入职日期[：:]?\s*(.+)/);
    if (entryMatch) { current.entry = entryMatch[1].trim(); continue; }

    // 提干日期
    const promoteMatch = trimmed.match(/提干日期[：:]?\s*(.+)/);
    if (promoteMatch) { current.promotionDate = promoteMatch[1].trim(); continue; }

    // 奖励记录
    const rewardMatch = trimmed.match(/奖励记录[：:]\s*(.+)/);
    if (rewardMatch) {
      const content = rewardMatch[1].trim();
      if (!/无/.test(content)) {
        current.items.push({ type: 'honor', content: content, month: parseMonth(content) || '2026-01', date: parseDate(content) });
      }
      continue;
    }

    // 处罚记录
    const punishMatch = trimmed.match(/处罚记录[：:]\s*(.+)/);
    if (punishMatch) {
      const content = punishMatch[1].trim();
      if (!/无/.test(content)) {
        current.items.push({ type: 'shame', content: content, month: parseMonth(content) || '2026-01', date: parseDate(content) });
      }
      continue;
    }

    // 编号条目 (1、 2、 等)
    const numMatch = trimmed.match(/^\d+[、.．]\s*(.+)/);
    if (numMatch) {
      const content = numMatch[1].trim();
      const type = detectType(content);
      const month = parseMonth(content) || '2026-01';
      current.items.push({ type, content, month, date: parseDate(content) });
    }
  }

  if (current) records.push(current);

  // 转换为统一格式
  const allRecords = [];
  records.forEach(emp => {
    // 按月份分组
    const byMonth = {};
    emp.items.forEach(item => {
      const m = item.month || '2026-01';
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(item);
    });

    Object.entries(byMonth).forEach(([month, items]) => {
      items.forEach(item => {
        allRecords.push({
          name: emp.name,
          idCard: emp.idCard,
          store: emp.store,
          month: month,
          type: item.type,
          title: item.content,
          description: '',
          score: 0,
          date: item.date
        });
      });
    });
  });

  return allRecords;
}

// 解析非结构化Word（范湖万达格式）
function parseUnstructuredWord(lines, defaultStore) {
  const records = [];
  let currentName = '';
  let currentItems = [];

  const isName = (line) => {
    const trimmed = line.trim();
    return trimmed.length >= 2 && trimmed.length <= 4 &&
      /^[\u4e00-\u9fa5]+$/.test(trimmed) &&
      !/荣誉|扣分|处罚|奖励|无/.test(trimmed);
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (isName(trimmed)) {
      // 保存上一个员工
      if (currentName && currentItems.length > 0) {
        records.push({ name: currentName, items: [...currentItems] });
      }
      currentName = trimmed;
      currentItems = [];
      continue;
    }

    if (!currentName) continue;

    // 荣誉条目
    const honorMatch = trimmed.match(/(?:荣誉|奖励)\s*\d*[.、．]?\s*[：:]?\s*(.+)/i) ||
                       trimmed.match(/^荣誉\s*[；;]?\s*(.+)/);
    if (honorMatch || trimmed.startsWith('荣誉')) {
      const content = honorMatch ? honorMatch[1] : trimmed.replace(/^荣誉\s*[；;]?\s*/, '');
      if (content && !/无/.test(content)) {
        currentItems.push({
          type: 'honor',
          content: content.trim(),
          month: parseMonth(content) || '2026-01',
          date: parseDate(content)
        });
      }
      continue;
    }

    // 扣分条目
    const shameMatch = trimmed.match(/(?:扣分|处罚)\s*\d*[.、．]?\s*[：:]?\s*(.+)/);
    if (shameMatch || trimmed.startsWith('扣分')) {
      const content = shameMatch ? shameMatch[1] : trimmed.replace(/^扣分\s*\d*[.、．]?\s*[：:]?\s*/, '');
      if (content && !/无/.test(content)) {
        currentItems.push({
          type: 'shame',
          content: content.trim(),
          month: parseMonth(content) || '2026-01',
          date: parseDate(content)
        });
      }
    }
  }

  // 保存最后一个员工
  if (currentName && currentItems.length > 0) {
    records.push({ name: currentName, items: currentItems });
  }

  // 转换为统一格式
  const allRecords = [];
  records.forEach(emp => {
    const byMonth = {};
    emp.items.forEach(item => {
      const m = item.month || '2026-01';
      if (!byMonth[m]) byMonth[m] = [];
      byMonth[m].push(item);
    });

    Object.entries(byMonth).forEach(([month, items]) => {
      items.forEach(item => {
        allRecords.push({
          name: emp.name,
          idCard: '',
          store: defaultStore,
          month: month,
          type: item.type,
          title: item.content,
          description: '',
          score: 0,
          date: item.date
        });
      });
    });
  });

  return allRecords;
}

// 预览导入 - 解析文件返回按 门店-姓名-月份 分组的数据
app.post('/api/import/preview', authenticate, requireAdmin, importUpload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: '请上传文件' });
  }

  try {
    const filePath = req.file.path;
    // 修复中文文件名编码问题（multer 可能将 UTF-8 误读为 Latin-1）
    let filename = req.file.originalname;
    try {
      filename = Buffer.from(filename, 'latin1').toString('utf-8');
    } catch (e) { /* 使用原始文件名 */ }
    console.log('[导入] 文件名:', filename);
    const ext = filename.toLowerCase().split('.').pop();

    let rawRecords;
    if (['xlsx', 'xls'].includes(ext)) {
      rawRecords = parseExcelFile(filePath, filename);
    } else if (ext === 'docx') {
      rawRecords = await parseWordFile(filePath, filename);
    } else {
      return res.status(400).json({ error: '不支持的文件格式' });
    }

    if (!rawRecords || rawRecords.length === 0) {
      return res.status(400).json({ error: '未能从文件中解析出数据' });
    }

    // 按 门店-姓名-月份 分组
    const grouped = {};
    rawRecords.forEach(r => {
      const store = (r.store && r.store.trim()) || '未知门店';
      const name = (r.name && r.name.trim()) || '未知姓名';
      const month = (r.month && r.month.trim()) || '未知月份';
      const key = `${store}||${name}||${month}`;

      if (!grouped[key]) {
        grouped[key] = { store, name, idCard: r.idCard || '', month, items: [] };
      }
      grouped[key].items.push({
        type: r.type,
        title: r.title,
        description: r.description || '',
        date: r.date || '2026-01-01'
      });
      // 更新身份证号（取最新的非空值）
      if (r.idCard && !grouped[key].idCard) {
        grouped[key].idCard = r.idCard;
      }
    });

    // 匹配系统中已有的员工
    const result = Object.values(grouped).map(g => {
      let employee = null;
      if (g.idCard) {
        employee = dbGet('SELECT * FROM employees WHERE id_number = ?', [g.idCard]);
      }
      if (!employee) {
        employee = dbGet('SELECT * FROM employees WHERE name = ? AND store_name = ?', [g.name, g.store]);
      }

      return {
        store: g.store,
        name: g.name,
        idCard: g.idCard,
        month: g.month,
        items: g.items,
        matchedEmployeeId: employee ? employee.id : null,
        matchedEmployeeName: employee ? employee.name : null,
        isNewEmployee: !employee
      };
    });

    // 按门店-姓名-月份排序
    result.sort((a, b) => {
      if (a.store !== b.store) return a.store.localeCompare(b.store);
      if (a.name !== b.name) return a.name.localeCompare(b.name);
      return a.month.localeCompare(b.month);
    });

    // 统计
    const stats = {
      totalRecords: result.length,
      totalItems: rawRecords.length,
      newEmployees: result.filter(r => r.isNewEmployee).length,
      matchedEmployees: result.filter(r => !r.isNewEmployee).length,
      stores: [...new Set(result.map(r => r.store))]
    };

    // 保存解析结果到临时文件供确认导入使用
    const importId = Date.now().toString();
    const tempPath = join(importDir, `import_${importId}.json`);
    fs.writeFileSync(tempPath, JSON.stringify({ importId, file: filename, records: result, stats }), 'utf-8');

    res.json({ importId, records: result, stats });
  } catch (err) {
    console.error('导入预览失败:', err);
    res.status(500).json({ error: '解析文件失败: ' + err.message });
  }
});

// 确认导入
app.post('/api/import/confirm', authenticate, requireAdmin, (req, res) => {
  const { importId } = req.body;
  if (!importId) {
    return res.status(400).json({ error: '缺少导入ID' });
  }

  const tempPath = join(importDir, `import_${importId}.json`);
  if (!fs.existsSync(tempPath)) {
    return res.status(400).json({ error: '导入数据已过期，请重新上传' });
  }

  try {
    const data = JSON.parse(fs.readFileSync(tempPath, 'utf-8'));
    const { records } = data;
    let createdEmployees = 0;
    let createdRecords = 0;
    let createdItems = 0;

    records.forEach(group => {
      let employeeId = group.matchedEmployeeId;

      // 如果员工不存在，创建新员工
      if (!employeeId && group.name && group.store) {
        try {
          const idNumber = group.idCard || null;
          const result = dbRun(
            'INSERT INTO employees (name, id_number, store_name, promotion_date) VALUES (?, ?, ?, ?)',
            [group.name, idNumber, group.store, '2026-01-01']
          );
          employeeId = result.lastInsertRowid;
          createdEmployees++;
        } catch (err) {
          // 如果身份证号重复，尝试查找
          const existing = dbGet('SELECT * FROM employees WHERE name = ? AND store_name = ?', [group.name, group.store]);
          if (existing) {
            employeeId = existing.id;
          } else {
            console.error(`创建员工 ${group.name} 失败:`, err.message);
            return;
          }
        }
      }

      if (!employeeId) return;

      // 检查该员工该月份是否已有记录
      const existingRecord = dbGet(
        'SELECT id FROM records WHERE employee_id = ? AND month = ?',
        [employeeId, group.month]
      );

      let recordId;
      if (existingRecord) {
        recordId = existingRecord.id;
      } else {
        const result = dbRun(
          'INSERT INTO records (employee_id, store_name, month, status, submitted_by) VALUES (?, ?, ?, ?, ?)',
          [employeeId, group.store, group.month, 'pending', req.user.id]
        );
        recordId = result.lastInsertRowid;
        createdRecords++;
      }

      // 添加记录明细
      group.items.forEach(item => {
        dbRun(
          'INSERT INTO record_items (record_id, type, title, description, date) VALUES (?, ?, ?, ?, ?)',
          [recordId, item.type, item.title, item.description || '', item.date || '2026-01-01']
        );
        createdItems++;
      });
    });

    saveDb();

    // 清理临时文件
    fs.unlinkSync(tempPath);

    res.json({
      message: `导入成功！数据已提交审核。新建员工 ${createdEmployees} 人，新建记录 ${createdRecords} 条，导入明细 ${createdItems} 条`,
      stats: { createdEmployees, createdRecords, createdItems }
    });
  } catch (err) {
    console.error('确认导入失败:', err);
    res.status(500).json({ error: '导入失败: ' + err.message });
  }
});

// 审核通过记录（管理员）
app.post('/api/records/:id/approve', authenticate, requireAdmin, async (req, res) => {
  const recordId = req.params.id;
  
  try {
    // 更新记录状态为approved
    dbRun(
      'UPDATE records SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
      ['approved', req.user.id, recordId]
    );
    saveDb();
    
    // 获取记录详情用于发送邮件
    const record = dbGet(`
      SELECT r.*, e.name as employee_name, r.store_name
      FROM records r
      LEFT JOIN employees e ON r.employee_id = e.id
      WHERE r.id = ?
    `, [recordId]);
    
    if (record) {
      // 获取该记录的所有明细
      const items = dbAll('SELECT * FROM record_items WHERE record_id = ?', [recordId]);
      
      // 构造邮件数据
      const emailRecords = [{
        store: record.store_name,
        name: record.employee_name,
        month: record.month,
        items: items.map(item => ({
          type: item.type,
          title: item.title,
          description: item.description,
          date: item.date
        }))
      }];
      
      const emailStats = {
        totalRecords: 1,
        totalItems: items.length,
        newEmployees: 0,
        stores: [record.store_name]
      };
      
      // 异步发送邮件
      sendImportEmail(emailRecords, emailStats, `审核通过_${record.store_name}_${record.month}`).catch(err => {
        console.error('[邮箱] 审核通过邮件发送失败:', err.message);
      });
    }
    
    res.json({ message: '审核通过，数据已发送至139邮箱备份' });
  } catch (err) {
    console.error('审核失败:', err);
    res.status(500).json({ error: '审核失败: ' + err.message });
  }
});

// 批量审核通过
app.post('/api/records/batch-approve', authenticate, requireAdmin, async (req, res) => {
  const { recordIds } = req.body;
  
  if (!recordIds || !Array.isArray(recordIds) || recordIds.length === 0) {
    return res.status(400).json({ error: '请提供要审核的记录ID列表' });
  }
  
  try {
    let approvedCount = 0;
    let totalItems = 0;
    const stores = new Set();
    const emailRecords = [];
    
    for (const recordId of recordIds) {
      // 更新状态
      dbRun(
        'UPDATE records SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP WHERE id = ?',
        ['approved', req.user.id, recordId]
      );
      
      // 获取记录详情
      const record = dbGet(`
        SELECT r.*, e.name as employee_name, r.store_name
        FROM records r
        LEFT JOIN employees e ON r.employee_id = e.id
        WHERE r.id = ?
      `, [recordId]);
      
      if (record) {
        approvedCount++;
        stores.add(record.store_name);
        
        const items = dbAll('SELECT * FROM record_items WHERE record_id = ?', [recordId]);
        totalItems += items.length;
        
        emailRecords.push({
          store: record.store_name,
          name: record.employee_name,
          month: record.month,
          items: items.map(item => ({
            type: item.type,
            title: item.title,
            description: item.description,
            date: item.date
          }))
        });
      }
    }
    
    saveDb();
    
    // 异步发送邮件
    if (emailRecords.length > 0) {
      const emailStats = {
        totalRecords: approvedCount,
        totalItems: totalItems,
        newEmployees: 0,
        stores: [...stores]
      };
      
      sendImportEmail(emailRecords, emailStats, `批量审核通过_${stores.size}个门店`).catch(err => {
        console.error('[邮箱] 批量审核邮件发送失败:', err.message);
      });
    }
    
    res.json({ 
      message: `批量审核通过！${approvedCount}条记录已发送至139邮箱备份`,
      stats: { approvedCount, totalItems }
    });
  } catch (err) {
    console.error('批量审核失败:', err);
    res.status(500).json({ error: '批量审核失败: ' + err.message });
  }
});

// SPA 路由：所有非 /api 请求返回 index.html 或静态文件
const distPath = join(__dirname, '..', 'dist');

// 静态文件 CORS 头（解决 Vite 构建时 crossorigin 属性导致的 CORS 问题）
app.use('/assets', (req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
});

app.get('*', (req, res) => {
  // 如果是静态资源请求（/assets/, /mascot/ 等）
  if (req.path.startsWith('/assets/') || req.path.startsWith('/mascot/') || req.path === '/brand-config.json' || req.path === '/logo.png') {
    const filePath = join(distPath, req.path);
    if (fs.existsSync(filePath)) {
      return res.sendFile(filePath);
    }
  }
  // 其他请求返回 index.html（SPA 路由）
  const indexPath = join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built. Run `npm run build` first.');
  }
});

// 启动服务器
initDatabase().then(() => {
  const PORT = process.env.PORT || 3000;
  app.listen(PORT, () => {
    console.log(`服务器运行在 http://localhost:${PORT}`);
  });
  
  // 启动自动备份(每6小时一次)
  startAutoBackup();
}).catch(err => {
  console.error('数据库初始化失败:', err);
  process.exit(1);
});
