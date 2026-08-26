import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== 开始构建前端 ===\n');

// 删除旧的dist目录
const distPath = path.join(__dirname, 'dist');
if (fs.existsSync(distPath)) {
  console.log('删除旧的dist目录...');
  fs.rmSync(distPath, { recursive: true, force: true });
}

// 运行vite build
console.log('运行 vite build...\n');
try {
  execSync('npx vite build', { stdio: 'inherit', cwd: __dirname });
  console.log('\n✅ 构建成功!');
  
  // 检查dist目录是否存在
  if (fs.existsSync(distPath)) {
    console.log('✅ dist目录已生成');
    const files = fs.readdirSync(distPath);
    console.log(`包含 ${files.length} 个文件/文件夹`);
  } else {
    console.log('❌ dist目录未生成');
  }
} catch (error) {
  console.error(' 构建失败:', error.message);
  process.exit(1);
}
