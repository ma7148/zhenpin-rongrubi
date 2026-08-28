const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// 邮箱配置
const emailConfig = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'server', 'email-config.json'), 'utf-8'));

const transporter = nodemailer.createTransport({
  host: emailConfig.smtpHost,
  port: emailConfig.smtpPort,
  secure: true,
  auth: {
    user: emailConfig.email,
    pass: emailConfig.password
  }
});

// 创建临时目录
const tempDir = path.join(require('os').tmpdir(), 'zhenpin_code');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// 项目根目录
const projectDir = path.join(__dirname, '..');

// 创建 zip 文件
const zipFileName = `臻品足道荣辱榜_源代码_${new Date().toISOString().slice(0, 10)}.zip`;
const zipFilePath = path.join(tempDir, zipFileName);

console.log('正在打包核心源代码...');

// 只打包必要的源代码文件
const filesToInclude = [
  'src',
  'server/index.js',
  'server/email-service.js',
  'scripts',
  'package.json',
  'vite.config.js',
  'index.html',
  '.gitignore'
];

try {
  // 创建源文件目录
  const srcDir = path.join(tempDir, 'source');
  if (fs.existsSync(srcDir)) {
    fs.rmSync(srcDir, { recursive: true });
  }
  fs.mkdirSync(srcDir, { recursive: true });

  // 复制必要文件
  filesToInclude.forEach(file => {
    const srcPath = path.join(projectDir, file);
    const destPath = path.join(srcDir, file);
    
    if (fs.existsSync(srcPath)) {
      const stat = fs.statSync(srcPath);
      if (stat.isDirectory()) {
        // 递归复制目录
        copyDirSync(srcPath, destPath);
      } else {
        // 复制文件
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
      }
    }
  });

  // 打包
  execSync(`powershell -Command "Compress-Archive -Path '${srcDir}\\*' -DestinationPath '${zipFilePath}' -Force"`, {
    stdio: 'inherit'
  });
  
  console.log('打包完成:', zipFilePath);
  console.log('文件大小:', (fs.statSync(zipFilePath).size / 1024 / 1024).toFixed(2), 'MB');
} catch (err) {
  console.error('打包失败:', err.message);
  process.exit(1);
}

// 递归复制目录
function copyDirSync(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    
    // 跳过不需要的目录
    if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === 'dist') {
      continue;
    }
    
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      // 跳过图片和数据库文件
      if (['.png', '.jpg', '.jpeg', '.db', '.zip'].includes(path.extname(entry.name).toLowerCase())) {
        continue;
      }
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

// 发送邮件
async function sendEmail(to) {
  const mailOptions = {
    from: emailConfig.email,
    to: to,
    subject: '臻品足道荣辱榜 - 完整源代码',
    text: `您好，\n\n附件是臻品足道荣辱榜系统的完整源代码。\n\n包含内容：\n- 前端代码 (src/)\n- 后端代码 (server/)\n- 脚本文件 (scripts/)\n- 配置文件\n\n使用说明：\n1. 解压后运行 npm install 安装依赖\n2. 运行 npm run dev 启动开发环境\n3. 运行 npm run build 构建生产版本\n\n发送时间：${new Date().toLocaleString('zh-CN')}\n\n此邮件由系统自动发送。`,
    html: `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>臻品足道荣辱榜 - 完整源代码</h2>
        <p>您好，</p>
        <p>附件是臻品足道荣辱榜系统的完整源代码。</p>
        <h3>包含内容：</h3>
        <ul>
          <li>前端代码 (src/)</li>
          <li>后端代码 (server/)</li>
          <li>脚本文件 (scripts/)</li>
          <li>配置文件</li>
        </ul>
        <h3>使用说明：</h3>
        <ol>
          <li>解压后运行 <code>npm install</code> 安装依赖</li>
          <li>运行 <code>npm run dev</code> 启动开发环境</li>
          <li>运行 <code>npm run build</code> 构建生产版本</li>
        </ol>
        <p><strong>发送时间：</strong>${new Date().toLocaleString('zh-CN')}</p>
        <p style="color: #666; margin-top: 30px;">此邮件由系统自动发送</p>
      </div>
    `,
    attachments: [
      {
        filename: zipFileName,
        path: zipFilePath
      }
    ]
  };

  await transporter.sendMail(mailOptions);
  console.log(`邮件已发送至: ${to}`);
}

// 发送到两个邮箱
(async () => {
  try {
    console.log('正在发送邮件...');
    await sendEmail('13972601452@139.com');
    await sendEmail('714866146@qq.com');
    console.log('所有邮件发送完成！');
  } catch (err) {
    console.error('邮件发送失败:', err.message);
  } finally {
    // 清理临时文件
    try {
      fs.rmSync(tempDir, { recursive: true });
      console.log('临时文件已清理');
    } catch (e) {
      // 忽略清理错误
    }
  }
})();
