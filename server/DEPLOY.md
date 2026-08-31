# 臻品足道荣辱榜 - 服务器部署指南

## 系统要求
- Ubuntu 18.04 或更高版本
- Node.js 18.x（脚本会自动安装）
- 内存：建议 512MB 以上
- 磁盘：建议 1GB 以上可用空间

## 快速部署（推荐）

### 1. 上传项目到服务器
```bash
# 在本地电脑执行（Windows PowerShell）
scp -P 22226 -r "E:\商学院\10.臻品足道荣辱榜\程序\臻品足道荣辱榜" root@113.57.105.152:/root/zhenpin-rongrubi
```

### 2. 连接服务器
```bash
ssh root@113.57.105.152 -p 22226
```

### 3. 运行部署脚本
```bash
cd /root/zhenpin-rongrubi
chmod +x server/deploy.sh
bash server/deploy.sh
```

### 4. 配置邮箱密码
```bash
nano .env
# 修改 EMAIL_PASS 为实际的邮箱授权码
# 保存：Ctrl+O，回车，Ctrl+X
```

### 5. 重启应用
```bash
pm2 restart zhenpin-rongrubi
```

### 6. 访问系统
浏览器打开：`http://113.57.105.152:3000`

---

## 手动部署步骤

如果不想用脚本，可以手动执行：

### 1. 安装 Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs
node -v  # 验证安装
```

### 2. 安装 PM2
```bash
npm install -g pm2
```

### 3. 安装项目依赖
```bash
cd /root/zhenpin-rongrubi
npm install --production
```

### 4. 创建环境变量
```bash
cat > .env << 'EOF'
PORT=3000
EMAIL_USER=13972601452@139.com
EMAIL_PASS=你的邮箱授权码
EMAIL_SMTP_HOST=smtp.139.com
EMAIL_SMTP_PORT=465
EOF
```

### 5. 启动应用
```bash
pm2 start server/index.js --name zhenpin-rongrubi
pm2 save
pm2 startup systemd -u root --hp /root
```

### 6. 配置防火墙
```bash
ufw allow 3000/tcp
ufw reload
```

---

## 常用管理命令

```bash
# 查看应用状态
pm2 status

# 查看实时日志
pm2 logs zhenpin-rongrubi

# 重启应用
pm2 restart zhenpin-rongrubi

# 停止应用
pm2 stop zhenpin-rongrubi

# 删除应用
pm2 delete zhenpin-rongrubi

# 查看历史日志
pm2 logs zhenpin-rongrubi --lines 100
```

---

## 使用 Nginx 反向代理（可选）

如果想用 80 端口访问，可以配置 Nginx：

### 1. 安装 Nginx
```bash
apt install -y nginx
```

### 2. 创建配置文件
```bash
nano /etc/nginx/sites-available/rongrubi
```

内容如下：
```nginx
server {
    listen 80;
    server_name 113.57.105.152;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

### 3. 启用配置
```bash
ln -s /etc/nginx/sites-available/rongrubi /etc/nginx/sites-enabled/
nginx -t  # 测试配置
systemctl restart nginx
```

### 4. 访问系统
浏览器打开：`http://113.57.105.152`（无需端口号）

---

## 默认账号

- 管理员账号：`admin`
- 初始密码：请在数据库中查看或重置

重置密码：
```bash
cd /root/zhenpin-rongrubi
node -e "
const bcrypt = require('bcryptjs');
const fs = require('fs');
const dbPath = './server/database/rongrubi.db';
// 使用 SQL 更新密码
const newPassword = bcrypt.hashSync('新密码', 10);
console.log('新密码哈希:', newPassword);
"
```

---

## 故障排查

### 应用无法启动
```bash
# 查看错误日志
pm2 logs zhenpin-rongrubi --err

# 检查端口占用
netstat -tlnp | grep 3000

# 手动启动测试
cd /root/zhenpin-rongrubi
node server/index.js
```

### 无法访问
```bash
# 检查防火墙
ufw status

# 检查应用状态
pm2 status

# 检查端口监听
netstat -tlnp | grep node
```

### 数据库问题
```bash
# 数据库位置
/server/database/rongrubi.db

# 备份数据库
cp /root/zhenpin-rongrubi/server/database/rongrubi.db /root/rongrubi_backup.db
```

---

## 更新应用

```bash
# 1. 上传新版本到服务器
scp -P 22226 -r "E:\商学院\10.臻品足道荣辱榜\程序\臻品足道荣辱榜" root@113.57.105.152:/root/zhenpin-rongrubi

# 2. 连接服务器
ssh root@113.57.105.152 -p 22226

# 3. 重新安装依赖并重启
cd /root/zhenpin-rongrubi
npm install --production
pm2 restart zhenpin-rongrubi
```

---

## 技术支持

如有问题，请检查：
1. PM2 日志：`pm2 logs zhenpin-rongrubi`
2. 系统日志：`journalctl -u pm2-root`
3. 网络连通性：`curl http://localhost:3000`
