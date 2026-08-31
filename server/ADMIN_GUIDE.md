# 服务器管理员快速部署指南

## 一键部署命令

```bash
# 1. 进入项目目录
cd /root/zhenpin-rongrubi

# 2. 运行部署脚本
bash server/deploy.sh

# 3. 编辑邮箱配置（重要！）
nano .env
# 修改 EMAIL_PASS 为实际的邮箱授权码

# 4. 重启应用
pm2 restart zhenpin-rongrubi
```

## 访问地址

- 直接访问：`http://服务器IP:3000`
- 示例：`http://113.57.105.152:3000`

## 必须配置项

### 邮箱授权码获取方法

1. 登录 139 邮箱网页版
2. 进入"设置" → "账户"
3. 找到"POP3/SMTP/IMAP"服务
4. 开启"SMTP 服务"
5. 获取"授权码"（不是登录密码）
6. 将授权码填入 `.env` 文件的 `EMAIL_PASS` 字段

## 验证部署成功

```bash
# 检查应用状态
pm2 status

# 应该看到：
# zhenpin-rongrubi | online | ...

# 测试访问
curl http://localhost:3000

# 应该返回 HTML 内容
```

## 文件结构说明

```
/root/zhenpin-rongrubi/
├── server/
│   ├── index.js              # 主服务器文件
│   ├── database/
│   │   └── rongrubi.db       # SQLite 数据库
│   ├── deploy.sh             # 部署脚本
│   ├── ecosystem.config.js   # PM2 配置
│   ├── .env.example          # 环境变量模板
│   ── DEPLOY.md             # 详细部署文档
├── dist/                     # 前端构建产物
├── package.json
└── ...
```

## 日常维护

### 查看日志
```bash
pm2 logs zhenpin-rongrubi          # 实时日志
pm2 logs zhenpin-rongrubi --lines 100  # 最近 100 行
```

### 重启应用
```bash
pm2 restart zhenpin-rongrubi
```

### 备份数据库
```bash
cp /root/zhenpin-rongrubi/server/database/rongrubi.db /root/rongrubi_backup_$(date +%Y%m%d).db
```

### 更新应用
```bash
# 上传新版本后
cd /root/zhenpin-rongrubi
npm install --production
pm2 restart zhenpin-rongrubi
```

## 故障排查

### 问题 1：应用无法启动
```bash
# 查看错误日志
pm2 logs zhenpin-rongrubi --err

# 手动启动测试
cd /root/zhenpin-rongrubi
node server/index.js
```

### 问题 2：端口被占用
```bash
# 查看端口占用
netstat -tlnp | grep 3000

# 杀掉占用进程
kill -9 <PID>
```

### 问题 3：无法访问
```bash
# 检查防火墙
ufw status

# 开放端口
ufw allow 3000/tcp

# 检查应用是否运行
pm2 status
```

## 安全建议

1. **修改默认密码**：部署后立即修改 admin 账号密码
2. **使用 HTTPS**：建议配置 SSL 证书（可使用 Let's Encrypt 免费证书）
3. **定期备份**：设置定时任务备份数据库
4. **监控日志**：定期检查 PM2 日志，发现异常及时处理

## 设置定时备份（可选）

```bash
# 创建备份脚本
cat > /root/backup_rongrubi.sh << 'EOF'
#!/bin/bash
BACKUP_DIR="/root/backups"
mkdir -p $BACKUP_DIR
cp /root/zhenpin-rongrubi/server/database/rongrubi.db $BACKUP_DIR/rongrubi_$(date +%Y%m%d_%H%M%S).db
# 删除 30 天前的备份
find $BACKUP_DIR -name "rongrubi_*.db" -mtime +30 -delete
EOF

chmod +x /root/backup_rongrubi.sh

# 添加定时任务（每天凌晨 3 点备份）
crontab -e
# 添加以下行：
0 3 * * * /root/backup_rongrubi.sh
```

---

如有问题，请查看完整文档：`server/DEPLOY.md`
