#!/bin/bash
# Poker Server Modern - 服务器部署脚本
# 在远程服务器上运行此脚本

set -e

SERVER_IP="43.106.106.92"
PROJECT_DIR="/opt/poker-server"

echo "🎲 Poker Server Modern - 服务器部署脚本"
echo "=========================================="

# 检查是否为root用户
if [ "$EUID" -ne 0 ]; then
    echo "❌ 请使用 root 用户运行此脚本"
    exit 1
fi

# 更新系统
echo ""
echo "📦 更新系统..."
apt-get update -y

# 安装必要工具
echo ""
echo "🔧 安装必要工具..."
apt-get install -y curl wget git nginx

# 安装 Node.js 20
echo ""
echo "📦 安装 Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt-get install -y nodejs
fi

echo "✅ Node.js 版本: $(node -v)"
echo "✅ NPM 版本: $(npm -v)"

# 安装 Docker
echo ""
echo "🐳 安装 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh
    systemctl enable docker
    systemctl start docker
fi

echo "✅ Docker 版本: $(docker --version)"

# 安装 Docker Compose
echo ""
echo "🐳 安装 Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
    chmod +x /usr/local/bin/docker-compose
fi

echo "✅ Docker Compose 版本: $(docker-compose --version)"

# 创建项目目录
echo ""
echo "📁 创建项目目录..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 检查项目文件是否存在
if [ ! -f "package.json" ]; then
    echo "❌ 项目文件不存在，请先上传项目代码到 $PROJECT_DIR"
    echo ""
    echo "上传方法1 - 使用 SCP:"
    echo "  在本地运行: tar czf poker-server.tar.gz poker-server-modern/"
    echo "  然后: scp poker-server.tar.gz root@$SERVER_IP:$PROJECT_DIR/"
    echo "  在服务器运行: tar xzf poker-server.tar.gz"
    echo ""
    echo "上传方法2 - 使用 Git:"
    echo "  git clone <your-repo-url> $PROJECT_DIR"
    exit 1
fi

# 安装依赖
echo ""
echo "📦 安装项目依赖..."
npm install

# 构建共享包
echo ""
echo "🔨 构建共享包..."
cd packages/shared
npm install
npm run build
cd ../poker-engine
npm install
npm run build
cd ../..

# 设置后端
echo ""
echo "🔧 设置后端服务..."
cd apps/server
npm install

# 创建环境变量文件
if [ ! -f .env ]; then
    echo ""
    echo "📝 创建环境变量文件..."
    # 生成安全的随机密钥
    JWT_SECRET=$(openssl rand -hex 32)
    JWT_REFRESH_SECRET=$(openssl rand -hex 32)
    
    cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:CHANGE_ME@localhost:5432/poker?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=info
CORS_ORIGIN=https://your-domain.com
EOF
    echo "⚠️  请修改 .env 文件中的以下配置:"
    echo "  - DATABASE_URL 中的数据库密码"
    echo "  - CORS_ORIGIN 设置为你的前端域名"
fi

cd ../..

# 设置前端
echo ""
echo "🔧 设置前端应用..."
cd apps/web
npm install

# 创建前端环境变量
if [ ! -f .env ]; then
    cat > .env << EOF
VITE_API_URL=https://$SERVER_IP
VITE_WS_URL=wss://$SERVER_IP
EOF
fi

cd ../..

# 启动数据库
echo ""
echo "🐳 启动数据库服务..."
cd infra/docker
docker-compose -f docker-compose.dev.yml up -d postgres redis

echo "⏳ 等待数据库就绪..."
sleep 10

cd ../../apps/server

# 数据库迁移
echo ""
echo "🗄️  运行数据库迁移..."
npx prisma migrate deploy
npx prisma generate

cd ../..

# 构建前端
echo ""
echo "🔨 构建前端应用..."
cd apps/web
npm run build
cd ../..

# 配置 Nginx
echo ""
echo "🔧 配置 Nginx..."
cat > /etc/nginx/sites-available/poker-server << 'EOF'
server {
    listen 80;
    server_name _;
    
    # 前端静态文件
    location / {
        root /opt/poker-server/apps/web/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }
    
    # API 代理
    location /api {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
    
    # WebSocket 代理
    location /socket.io {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# 启用配置
ln -sf /etc/nginx/sites-available/poker-server /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# 测试并重载 Nginx
nginx -t && systemctl reload nginx

# 创建系统服务
echo ""
echo "🔧 创建系统服务..."
cat > /etc/systemd/system/poker-server.service << 'EOF'
[Unit]
Description=Poker Server Modern
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/poker-server/apps/server
ExecStart=/usr/bin/npm run start
Restart=on-failure
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# 重载 systemd
systemctl daemon-reload
systemctl enable poker-server

echo ""
echo "=========================================="
echo "✅ 部署准备完成!"
echo ""
echo "启动命令:"
echo "  1. 启动后端: systemctl start poker-server"
echo "  2. 查看日志: journalctl -u poker-server -f"
echo ""
echo "访问地址:"
echo "  - Web: http://$SERVER_IP"
echo "  - API: http://$SERVER_IP/api"
echo ""
echo "⚠️  重要提醒:"
echo "  1. 请修改 apps/server/.env 中的 JWT_SECRET"
echo "  2. 生产环境请配置 HTTPS"
echo "  3. 建议修改数据库默认密码"
echo "=========================================="
