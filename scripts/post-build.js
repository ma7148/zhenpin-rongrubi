// 构建后处理：去除 index.html 中的 crossorigin 属性
// 解决 Vite 构建时自动添加 crossorigin 导致的 CORS 问题
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const indexPath = path.join(__dirname, '..', 'dist', 'index.html');

if (fs.existsSync(indexPath)) {
  let html = fs.readFileSync(indexPath, 'utf-8');
  // 移除 crossorigin 属性
  html = html.replace(/\s+crossorigin/g, '');
  fs.writeFileSync(indexPath, html);
  console.log('[构建后处理] 已去除 index.html 中的 crossorigin 属性');
} else {
  console.log('[构建后处理] dist/index.html 不存在，跳过');
}
