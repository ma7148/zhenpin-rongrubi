// 前端代理服务器 - 同时提供静态文件和 API 代理
import express from 'express';
import cors from 'cors';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3001;
const API_TARGET = 'zhenpin-rongrubi-production.up.railway.app';

// 允许所有来源
app.use(cors({ origin: true, credentials: true }));

// API 代理 - 将 /api 请求代理到 Railway（不解析 body，直接转发原始数据）
app.use('/api', (req, res) => {
  const chunks = [];
  req.on('data', chunk => { chunks.push(chunk); });
  req.on('end', () => {
    const body = Buffer.concat(chunks);
    
    const options = {
      hostname: API_TARGET,
      port: 443,
      path: req.originalUrl,
      method: req.method,
      headers: {
        'host': API_TARGET,
        'content-type': req.headers['content-type'] || 'application/json',
        'authorization': req.headers['authorization'] || '',
      }
    };
    
    if (body.length > 0) {
      options.headers['content-length'] = body.length;
    }
    
    const proxyReq = https.request(options, (proxyRes) => {
      const headers = { ...proxyRes.headers };
      headers['access-control-allow-origin'] = '*';
      headers['access-control-allow-headers'] = '*';
      headers['access-control-allow-methods'] = '*';
      
      res.writeHead(proxyRes.statusCode, headers);
      proxyRes.pipe(res);
    });
    
    proxyReq.on('error', (err) => {
      console.error('代理错误:', err.message);
      res.status(502).json({ error: '代理请求失败' });
    });
    
    if (body.length > 0) {
      proxyReq.write(body);
    }
    proxyReq.end();
  });
});

// 静态文件服务
const distPath = path.join(__dirname, 'dist');
app.use(express.static(distPath));

// SPA 路由
app.get('*', (req, res) => {
  const indexPath = path.join(distPath, 'index.html');
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send('Frontend not built');
  }
});

app.listen(PORT, () => {
  console.log(`前端代理服务器运行在 http://localhost:${PORT}`);
  console.log(`API 代理到: https://${API_TARGET}`);
});
