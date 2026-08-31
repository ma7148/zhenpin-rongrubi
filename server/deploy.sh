#!/bin/bash

# 臻品足道荣辱榜 - Ubuntu 服务器部署脚本
# 使用方法：bash deploy.sh

set -e

echo "========================================="
echo "  臻品足道荣辱榜 - 开始部署"
echo "========================================="

# 1. 更新系统
echo "[1/7] 更新系统..."
apt update && apt upgrade -y

# 2. 安装 Node.js 18.x
echo "[2/7] 安装 Node.js..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
    apt install -y nodejs
    echo "Node.js 安装完成：$(node -v)"
else
    echo "Node.js 已安装：$(node -v)"
fi

# 3. 安装 PM2 进程管理器
echo "[3/7] 安装 PM2..."
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
    echo "PM2 安装完成"
else
    echo "PM2 已安装"
fi

# 4. 安装项目依赖
echo "[4/7] 安装项目依赖..."
cd /root/zhenpin-rongrubi
npm install --production

# 5. 创建环境变量配置
echo "[5/7] 配置环境变量..."
if [ ! -f .env ]; then
    cat > .env << 'EOF'
# 服务器端口
PORT=3000

# 邮箱配置（用于发送验证码）
EMAIL_USER=13972601452@139.com
EMAIL_PASS=your_email_password_here
EMAIL_SMTP_HOST=smtp.139.com
EMAIL_SMTP_PORT=465
EOF
    echo "已创建 .env 文件，请编辑填写正确的邮箱密码"
else
    echo ".env 文件已存在"
fi

# 6. 启动应用
echo "[6/7] 启动应用..."
pm2 delete zhenpin-rongrubi 2>/dev/null || true
pm2 start server/index.js --name zhenpin-rongrubi
pm2 save
pm2 startup systemd -u root --hp /root

echo "[7/7] 配置防火墙..."
if command -v ufw &> /dev/null; then
    ufw allow 3000/tcp
    ufw reload
    echo "已开放 3000 端口"
else
    echo "ufw 未安装，跳过防火墙配置"
fi

echo ""
echo "========================================="
echo "  部署完成！"
echo "========================================="
echo ""
echo "访问地址：http://$(curl -s ifconfig.me):3000"
echo ""
echo "常用命令："
echo "  查看日志：pm2 logs zhenpin-rongrubi"
echo "  重启应用：pm2 restart zhenpin-rongrubi"
echo "  停止应用：pm2 stop zhenpin-rongrubi"
echo "  查看状态：pm2 status"
echo ""
