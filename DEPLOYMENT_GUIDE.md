# 臻品足道荣辱榜 - Vercel + Railway 云端部署指南

## 📋 部署概览

本指南将帮助您将系统部署到云端,实现24小时在线访问,无需担心办公室电脑关机。

**部署架构**:
- **前端**: Vercel (永久免费)
- **后端**: Railway (每月$5免费额度)
- **数据库**: Railway PostgreSQL 或 Supabase (免费)
- **域名**: 自动分配HTTPS域名

---

## 🚀 完整部署步骤

### 第1步: 安装Git并创建GitHub仓库

#### 1.1 安装Git
1. 访问 https://git-scm.com/downloads
2. 下载Windows版本安装包
3. 双击安装,一路点击"Next"(下一步)
4. 安装完成后,打开新的PowerShell窗口验证:
   ```powershell
   git --version
   ```

#### 1.2 创建GitHub账号
1. 访问 https://github.com/
2. 点击右上角 "Sign up" 注册账号
3. 使用邮箱注册,设置用户名和密码
4. 验证邮箱完成注册

#### 1.3 创建新仓库
1. 登录后,点击右上角 "+" → "New repository"
2. Repository name: `zhenpin-rongrubang` (或其他名称)
3. 选择 "Public" (公开)
4. 点击 "Create repository"
5. **复制仓库地址**,类似: `https://github.com/yourname/zhenpin-rongrubang.git`

#### 1.4 上传代码到GitHub
在项目根目录打开PowerShell,执行:

```powershell
# 初始化Git
git init

# 添加所有文件
git add .

# 提交代码
git commit -m "Initial commit: 臻品足道荣辱榜系统"

# 关联远程仓库(替换为您的仓库地址)
git remote add origin https://github.com/yourname/zhenpin-rongrubang.git

# 推送到GitHub
git push -u origin main
```

如果提示分支名称问题,使用:
```powershell
git branch -M main
git push -u origin main
```

---

### 第2步: 部署后端到Railway

#### 2.1 注册Railway账号
1. 访问 https://railway.app/
2. 点击 "Login" → "Sign in with GitHub"
3. 授权GitHub账号登录

#### 2.2 创建新项目
1. 登录后,点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择刚才创建的仓库 `zhenpin-rongrubang`
4. Railway会自动检测项目结构

#### 2.3 配置环境变量
在Railway项目页面:
1. 点击 "Variables" 标签
2. 添加以下环境变量:

```
NODE_ENV=production
JWT_SECRET=your-random-secret-key-here-12345678901234567890
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-email-password
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=587
```

**重要**: 
- `JWT_SECRET`: 生成一个随机字符串(至少32位)
- 邮箱配置用于发送验证码和备份

#### 2.4 添加PostgreSQL数据库
1. 在Railway项目页面,点击 "+ New"
2. 选择 "Database" → "PostgreSQL"
3. 等待数据库创建完成
4. Railway会自动提供连接信息

#### 2.5 修改后端代码支持PostgreSQL

需要修改 `server/index.js` 中的数据库连接。

**当前使用的是SQLite**,需要改为PostgreSQL。

我会帮您准备一个兼容版本的代码。

---

### 第3步: 部署前端到Vercel

#### 3.1 注册Vercel账号
1. 访问 https://vercel.com/
2. 点击 "Sign Up" → "Continue with GitHub"
3. 授权GitHub账号登录

#### 3.2 导入项目
1. 登录后,点击 "Add New..." → "Project"
2. 选择 "Import Git Repository"
3. 选择 `zhenpin-rongrubang` 仓库
4. Vercel会自动检测为Vite项目

#### 3.3 配置构建设置
在导入页面:
- **Framework Preset**: Vite
- **Root Directory**: `./` (根目录)
- **Build Command**: `npm run build`
- **Output Directory**: `dist`

点击 "Environment Variables",添加:
```
VITE_API_URL=https://your-backend.railway.app
```
(替换为您的Railway后端地址)

#### 3.4 部署
点击 "Deploy" 按钮,Vercel会自动构建并部署前端。

部署完成后会获得一个地址,类似:
```
https://zhenpin-rongrubang.vercel.app
```

---

### 第4步: 配置前后端连接

#### 4.1 获取Railway后端地址
1. 在Railway项目页面,找到您的服务
2. 点击 "Settings" → "Domains"
3. 复制生成的域名,类似: `https://xxx-production.up.railway.app`

#### 4.2 更新Vercel环境变量
1. 在Vercel项目页面,点击 "Settings" → "Environment Variables"
2. 编辑 `VITE_API_URL`,设置为Railway后端地址
3. 重新部署前端(点击 "Redeploy")

#### 4.3 更新vercel.json
修改 `vercel.json` 中的后端地址:
```json
{
  "routes": [
    {
      "src": "/api/(.*)",
      "dest": "https://your-railway-backend.railway.app/api/$1"
    }
  ]
}
```

---

## ✅ 部署完成!

### 访问地址
- **前端**: `https://zhenpin-rongrubang.vercel.app`
- **后端API**: `https://xxx-production.up.railway.app/api`

### 登录信息
- 管理员: `admin` / `admin123`
- 查询员: `boss1` / `boss123`

---

## 🔧 常见问题

### Q1: Railway的$5免费额度够用吗?
A: 完全够用!小项目每月只需$1-2,免费额度足够长期使用。

### Q2: 数据库迁移怎么办?
A: Railway提供免费的PostgreSQL数据库,我会帮您准备数据迁移脚本。

### Q3: 文件上传怎么处理?
A: Railway有临时存储,或使用云存储(如Cloudinary免费版)。

### Q4: 如何绑定自定义域名?
A: Vercel和Railway都支持绑定自己的域名(需要在域名服务商处配置DNS)。

---

##  需要帮助?

如果在部署过程中遇到问题,请告诉我具体的错误信息,我会帮您解决!

---

## 🎯 下一步优化建议

1. **使用Supabase替代Railway PostgreSQL**(更稳定,免费额度更大)
2. **配置Cloudinary处理文件上传**(免费图片存储)
3. **添加监控和日志**(Railway自带基础监控)
4. **配置自动备份**(每天自动备份数据库)
