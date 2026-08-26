import Imap from 'imap';
import { simpleParser } from 'mailparser';
import nodemailer from 'nodemailer';
import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import mammoth from 'mammoth';

// 邮箱配置（默认139邮箱IMAP设置）
const DEFAULT_IMAP_CONFIG = {
  host: 'imap.139.com',
  port: 993,
  secure: true,
  authTimeout: 10000
};

const DEFAULT_SMTP_CONFIG = {
  host: 'smtp.139.com',
  port: 465,
  secure: true,
  authTimeout: 10000
};

let imapConfig = null;
let smtpConfig = null;
let checkInterval = null;
let isChecking = false;

// 保存邮箱配置
export function saveEmailConfig(config) {
  imapConfig = {
    ...DEFAULT_IMAP_CONFIG,
    user: config.email,
    password: config.password
  };
  
  smtpConfig = {
    ...DEFAULT_SMTP_CONFIG,
    auth: {
      user: config.email,
      pass: config.password
    }
  };
  
  // 保存到文件
  const configPath = path.join(process.cwd(), 'server', 'email-config.json');
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  
  console.log('[邮箱] 配置已保存');
}

// 加载邮箱配置
export function loadEmailConfig() {
  const configPath = path.join(process.cwd(), 'server', 'email-config.json');
  if (fs.existsSync(configPath)) {
    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    imapConfig = {
      ...DEFAULT_IMAP_CONFIG,
      user: config.email,
      password: config.password
    };
    smtpConfig = {
      ...DEFAULT_SMTP_CONFIG,
      auth: {
        user: config.email,
        pass: config.password
      }
    };
    console.log('[邮箱] 配置已加载');
    return config;
  }
  return null;
}

// 获取邮箱配置
export function getEmailConfig() {
  const configPath = path.join(process.cwd(), 'server', 'email-config.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
  }
  return null;
}

// 连接IMAP并检查新邮件
export async function checkEmails() {
  if (!imapConfig) {
    throw new Error('邮箱未配置');
  }
  
  if (isChecking) {
    throw new Error('正在检查邮件，请稍后');
  }
  
  isChecking = true;
  
  return new Promise((resolve, reject) => {
    const imap = new Imap(imapConfig);
    const results = { checked: 0, imported: 0, errors: [] };
    
    imap.once('ready', () => {
      imap.openBox('INBOX', false, (err, box) => {
        if (err) {
          isChecking = false;
          reject(new Error('打开收件箱失败: ' + err.message));
          return;
        }
        
        // 搜索未读邮件
        imap.search(['UNSEEN'], (err, results_arr) => {
          if (err) {
            isChecking = false;
            reject(new Error('搜索邮件失败: ' + err.message));
            return;
          }
          
          if (!results_arr || results_arr.length === 0) {
            imap.end();
            isChecking = false;
            resolve(results);
            return;
          }
          
          const fetch = imap.fetch(results_arr, { bodies: '' });
          let processed = 0;
          
          fetch.on('message', (msg, seqno) => {
            msg.on('body', (stream, info) => {
              simpleParser(stream, async (err, parsed) => {
                if (err) {
                  results.errors.push(`邮件${seqno}解析失败: ${err.message}`);
                } else {
                  try {
                    const importResult = await processEmail(parsed);
                    results.imported++;
                    results.lastEmail = {
                      from: parsed.from?.text,
                      subject: parsed.subject,
                      date: parsed.date,
                      attachments: importResult.attachments
                    };
                  } catch (e) {
                    results.errors.push(`邮件${seqno}处理失败: ${e.message}`);
                  }
                }
                
                processed++;
                if (processed === results_arr.length) {
                  imap.end();
                }
              });
            });
          });
          
          fetch.once('error', (err) => {
            isChecking = false;
            reject(new Error('获取邮件失败: ' + err.message));
          });
          
          fetch.once('end', () => {
            results.checked = results_arr.length;
            isChecking = false;
            resolve(results);
          });
        });
      });
    });
    
    imap.once('error', (err) => {
      isChecking = false;
      reject(new Error('IMAP连接失败: ' + err.message));
    });
    
    imap.once('end', () => {
      console.log('[邮箱] IMAP连接已关闭');
    });
    
    imap.connect();
  });
}

// 处理单封邮件
async function processEmail(parsed) {
  const result = { attachments: [] };
  
  if (!parsed.attachments || parsed.attachments.length === 0) {
    throw new Error('邮件没有附件');
  }
  
  const importDir = path.join(process.cwd(), 'server', 'import_temp');
  if (!fs.existsSync(importDir)) {
    fs.mkdirSync(importDir, { recursive: true });
  }
  
  for (const attachment of parsed.attachments) {
    const ext = attachment.filename.toLowerCase().split('.').pop();
    
    if (!['xlsx', 'xls', 'docx'].includes(ext)) {
      console.log(`[邮箱] 跳过不支持的文件: ${attachment.filename}`);
      continue;
    }
    
    // 保存附件
    const filePath = path.join(importDir, `${Date.now()}-${attachment.filename}`);
    fs.writeFileSync(filePath, attachment.content);
    
    console.log(`[邮箱] 下载附件: ${attachment.filename}`);
    
    try {
      // 解析文件
      let rawRecords;
      if (['xlsx', 'xls'].includes(ext)) {
        rawRecords = parseExcelFile(filePath, attachment.filename);
      } else if (ext === 'docx') {
        rawRecords = await parseWordFile(filePath, attachment.filename);
      }
      
      if (rawRecords && rawRecords.length > 0) {
        result.attachments.push({
          filename: attachment.filename,
          records: rawRecords.length
        });
        
        // 这里可以调用导入API
        console.log(`[邮箱] 文件解析成功: ${rawRecords.length}条记录`);
      }
    } catch (e) {
      console.error(`[邮箱] 文件解析失败: ${attachment.filename}`, e.message);
      result.attachments.push({
        filename: attachment.filename,
        error: e.message
      });
    }
  }
  
  return result;
}

// 发送确认邮件
export async function sendConfirmationEmail(to, subject, content) {
  if (!smtpConfig) {
    throw new Error('SMTP未配置');
  }
  
  const transporter = nodemailer.createTransport(smtpConfig);
  
  const mailOptions = {
    from: smtpConfig.auth.user,
    to: to,
    subject: subject || '荣辱榜数据导入确认',
    text: content || '数据已成功导入系统',
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>荣辱榜数据导入确认</h2>
        <p>${content || '数据已成功导入系统'}</p>
        <p style="color: #666; margin-top: 30px;">
          此邮件由臻品足道荣辱榜系统自动发送
        </p>
      </div>
    `
  };
  
  await transporter.sendMail(mailOptions);
  console.log('[邮箱] 确认邮件已发送');
}

// 启动定时检查
export function startEmailCheck(intervalMinutes = 5) {
  if (checkInterval) {
    clearInterval(checkInterval);
  }
  
  console.log(`[邮箱] 开始定时检查，间隔: ${intervalMinutes}分钟`);
  
  checkInterval = setInterval(async () => {
    try {
      const results = await checkEmails();
      if (results.imported > 0) {
        console.log(`[邮箱] 自动导入完成: ${results.imported}封邮件`);
      }
    } catch (e) {
      console.error('[邮箱] 定时检查失败:', e.message);
    }
  }, intervalMinutes * 60 * 1000);
}

// 停止定时检查
export function stopEmailCheck() {
  if (checkInterval) {
    clearInterval(checkInterval);
    checkInterval = null;
    console.log('[邮箱] 定时检查已停止');
  }
}

// 测试邮箱连接
export async function testEmailConnection(config) {
  const testImap = {
    ...DEFAULT_IMAP_CONFIG,
    user: config.email,
    password: config.password
  };
  
  return new Promise((resolve, reject) => {
    const imap = new Imap(testImap);
    
    imap.once('ready', () => {
      imap.end();
      resolve({ success: true, message: '邮箱连接成功' });
    });
    
    imap.once('error', (err) => {
      reject(new Error('邮箱连接失败: ' + err.message));
    });
    
    imap.connect();
  });
}

// 解析Excel文件（复用现有逻辑）
function parseExcelFile(filePath, filename) {
  const workbook = XLSX.readFile(filePath);
  const allRecords = [];
  
  workbook.SheetNames.forEach(sheetName => {
    const sheet = workbook.Sheets[sheetName];
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    
    if (data.length < 2) return;
    
    // 查找表头行
    let headerRowIndex = -1;
    for (let i = 0; i < Math.min(data.length, 5); i++) {
      const row = data[i];
      if (!row) continue;
      const hasDate = row.some(c => c && /^(日期|月份)$/.test(String(c).trim()));
      const hasItem = row.some(c => c && /^(事项摘要|扣分事项|扣分原因|事项|摘要|原因|事由|处罚)$/.test(String(c).trim()));
      const hasScore = row.some(c => c && /^(扣分|分数|得分)$/.test(String(c).trim()));
      if (hasDate && (hasItem || hasScore)) {
        headerRowIndex = i;
        break;
      }
    }
    
    if (headerRowIndex === -1) return;
    
    // 解析数据行
    for (let i = headerRowIndex + 1; i < data.length; i++) {
      const row = data[i];
      if (!row || row.length < 2) continue;
      
      const itemStr = row[1];
      if (!itemStr) continue;
      
      const itemStrClean = String(itemStr).trim();
      if (itemStrClean.includes('合计') || itemStrClean === '') continue;
      
      allRecords.push({
        sheet: sheetName,
        item: itemStrClean
      });
    }
  });
  
  return allRecords.length > 0 ? allRecords : null;
}

// 解析Word文件
async function parseWordFile(filePath, filename) {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = result.value;
  const lines = text.split('\n').filter(l => l.trim());
  
  const records = [];
  let currentName = '';
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // 检测姓名
    const nameMatch = trimmed.match(/姓名[：:]\s*([\u4e00-\u9fa5]{2,4})/);
    if (nameMatch) {
      currentName = nameMatch[1];
      continue;
    }
    
    // 检测扣分/荣誉事项
    if (currentName && /扣分|处罚|荣誉|奖励/.test(trimmed)) {
      records.push({
        name: currentName,
        item: trimmed
      });
    }
  }
  
  return records.length > 0 ? records : null;
}
