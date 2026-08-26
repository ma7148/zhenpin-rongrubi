# 臻品足道荣辱榜 - 快速部署检查清单

## ✅ 部署前准备

- [ ] 已安装Git (https://git-scm.com/downloads)
- [ ] 已注册GitHub账号 (https://github.com/)
- [ ] 已创建GitHub仓库 `zhenpin-rongrubang`
- [ ] 已复制仓库地址

---

## 🚀 第1步: 上传代码到GitHub (5分钟)

在项目根目录打开PowerShell,依次执行:

```powershell
# 初始化Git
git init

# 添加所有文件
git add .

# 提交
git commit -m "Initial commit"

# 关联远程仓库(替换为您的实际地址)
git remote add origin https://github.com/YOUR_USERNAME/zhenpin-rongrubang.git

# 推送
git branch -M main
git push -u origin main
```

**完成标志**: GitHub仓库页面能看到您的代码

---

## 🚀 第2步: 部署后端到Railway (10分钟)

### 2.1 注册并登录
1. 访问 https://railway.app/
2. 点击 "Login" → "Sign in with GitHub"
3. 授权登录

### 2.2 创建项目
1. 点击 "New Project"
2. 选择 "Deploy from GitHub repo"
3. 选择 `zhenpin-rongrubang` 仓库

### 2.3 配置环境变量
在Railway项目页面 → Variables标签,添加:

```
NODE_ENV=production
JWT_SECRET=a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0
EMAIL_USER=your-email@qq.com
EMAIL_PASS=your-password
EMAIL_HOST=smtp.qq.com
EMAIL_PORT=587
```

### 2.4 添加数据库
1. 点击 "+ New" → "Database" → "PostgreSQL"
2. 等待创建完成

### 2.5 获取后端地址
1. 点击服务 → "Settings" → "Domains"
2. 复制域名,类似: `https://xxx-production.up.railway.app`

**完成标志**: Railway显示服务运行中,状态为绿色

---

## 🚀 第3步: 部署前端到Vercel (5分钟)

### 3.1 注册并登录
1. 访问 https://vercel.com/
2. 点击 "Sign Up" → "Continue with GitHub"
3. 授权登录

### 3.2 导入项目
1. 点击 "Add New..." → "Project"
2. 选择 "Import Git Repository"
3. 选择 `zhenpin-rongrubang` 仓库

### 3.3 配置环境
- Framework Preset: **Vite**
- Root Directory: `./`
- Build Command: `npm run build`
- Output Directory: `dist`

添加环境变量:
```
VITE_API_URL=https://YOUR_RAILWAY_BACKEND.railway.app
```
(替换为第2步获取的Railway地址)

### 3.4 部署
点击 "Deploy" 按钮

**完成标志**: Vercel显示部署成功,提供访问地址

---

## ✅ 测试访问

### 访问前端
打开浏览器访问Vercel提供的地址,例如:
```
https://zhenpin-rongrubang.vercel.app
```

### 登录测试
- 管理员: `admin` / `admin123`
- 查询员: `boss1` / `boss123`

### 验证功能
- [ ] 能正常登录
- [ ] 能看到员工列表
- [ ] 能查看荣辱记录
- [ ] API请求正常(无跨域错误)

---

##  常见问题排查

### 问题1: 前端无法连接后端API
**原因**: 环境变量配置错误  
**解决**: 
1. 检查Vercel的 `VITE_API_URL` 是否正确
2. 重新部署前端(Vercel → Deployments → Redeploy)

### 问题2: Railway后端启动失败
**原因**: 缺少环境变量或依赖  
**解决**:
1. 检查Railway的Logs标签,查看错误信息
2. 确认所有环境变量已配置
3. 确认 `package.json` 中有正确的启动脚本

### 问题3: 数据库连接失败
**原因**: PostgreSQL未正确配置  
**解决**:
1. 确认Railway中已添加PostgreSQL服务
2. 检查后端代码是否使用正确的数据库连接方式

---

## 📞 需要帮助?

如果遇到任何问题,请截图错误信息发给我,我会帮您解决!

---

## 🎉 部署成功后的优势

✅ **24小时在线** - 不用担心办公室电脑关机  
✅ **稳定访问** - 固定的HTTPS域名  
✅ **自动备份** - Railway自动保存数据  
✅ **免费使用** - Vercel永久免费,Railway每月$5额度  
✅ **全球加速** - Vercel CDN自动优化访问速度  

---

**预计总耗时**: 20-30分钟  
**难度等级**: ⭐⭐ (中等,按步骤操作即可)
