# Poker Server Modern - 手动部署指南

## 📦 部署包已准备就绪

**文件位置**: `/root/.openclaw-coding/workspace/poker-server-deploy.tar.gz`  
**文件大小**: 119KB  
**包含内容**: 完整项目代码（不含依赖）

---

## 🚀 部署步骤

### 第一步：下载部署包

将以下文件下载到你的本地电脑：
- `poker-server-deploy.tar.gz`

### 第二步：上传到服务器

**使用 SFTP 或 SCP 上传:**

```bash
# 使用 scp (在你的本地电脑执行)
scp /path/to/poker-server-deploy.tar.gz root@47.236.54.71:/opt/

# 或使用 sftp
sftp root@47.236.54.71
sftp> put /path/to/poker-server-deploy.tar.gz /opt/
```

**如果密码登录失败，需要先在服务器端启用密码认证:**

SSH 登录服务器后编辑：
```bash
sudo nano /etc/ssh/sshd_config
# 修改以下行：
PasswordAuthentication yes
PermitRootLogin yes
# 保存后重启 SSH
sudo systemctl restart sshd
```

### 第三步：在服务器上部署

SSH 登录服务器后执行：

```bash
# 1. 解压项目
cd /opt
tar xzf poker-server-deploy.tar.gz
mv poker-server-modern poker-server
cd poker-server

# 2. 执行部署脚本
chmod +x quick-deploy.sh
./quick-deploy.sh
```

### 第四步：启动服务

```bash
# 启动后端服务
systemctl start poker-server

# 查看日志
journalctl -u poker-server -f

# 查看状态
systemctl status poker-server
```

---

## 🌐 访问地址

部署完成后访问：
- **Web**: http://47.236.54.71
- **API**: http://47.236.54.71/api
- **Health**: http://47.236.54.71/api/v1/health

---

## 🔧 常用命令

```bash
# 查看服务状态
systemctl status poker-server

# 重启服务
systemctl restart poker-server

# 查看日志
journalctl -u poker-server -f

# 查看 Nginx 日志
tail -f /var/log/nginx/error.log

# 进入项目目录
cd /opt/poker-server

# 查看 Docker 容器
docker ps

# 重启数据库
docker-compose -f infra/docker/docker-compose.prod.yml restart
```

---

## ⚠️ 安全建议

部署后请立即执行：

```bash
# 1. 修改 JWT 密钥
cd /opt/poker-server/apps/server
nano .env
# 修改 JWT_SECRET 和 JWT_REFRESH_SECRET

# 2. 重启服务
systemctl restart poker-server

# 3. 配置防火墙
ufw allow 80/tcp
ufw allow 443/tcp
ufw enable
```

---

## 🆘 故障排查

### 问题1: 无法连接数据库
```bash
# 检查数据库容器
docker ps | grep postgres

# 手动启动数据库
cd /opt/poker-server/infra/docker
docker-compose -f docker-compose.prod.yml up -d
```

### 问题2: 前端无法访问
```bash
# 检查 Nginx
nginx -t
systemctl status nginx

# 检查前端文件是否存在
ls -la /opt/poker-server/apps/web/dist/
```

### 问题3: 后端无法启动
```bash
# 检查 Node.js
node -v

# 检查日志
journalctl -u poker-server -n 100

# 手动启动测试
cd /opt/poker-server/apps/server
npm run start
```

---

## 📞 获取帮助

如果部署遇到问题，请检查：
1. 服务器是否安装了 Node.js 20: `node -v`
2. Docker 是否运行: `docker ps`
3. 端口是否被占用: `netstat -tlnp | grep 3000`

---

**部署完成！** 🎉
