#!/bin/bash
# ============================================
# Poker Server Modern - 服务器快速部署脚本
# 在服务器上执行: bash quick-deploy.sh
# ============================================

set -e

REMOTE_URL="https://raw.githubusercontent.com/your-username/poker-server-modern/main"
PROJECT_DIR="/opt/poker-server"

echo "🎲 Poker Server Modern - 快速部署"
echo "==================================="

# 检查 root 权限
if [ "$EUID" -ne 0 ]; then 
    echo "❌ 请使用 sudo 或 root 用户运行"
    exit 1
fi

echo ""
echo "📦 Step 1/10: 安装基础依赖..."
apt-get update -qq
apt-get install -y -qq curl wget git nginx software-properties-common

echo ""
echo "📦 Step 2/10: 安装 Node.js 20..."
if ! command -v node &> /dev/null || [ "$(node -v | cut -d'v' -f2 | cut -d'.' -f1)" != "20" ]; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash - >/dev/null 2>&1
    apt-get install -y -qq nodejs
fi
echo "✅ Node.js $(node -v)"

echo ""
echo "🐳 Step 3/10: 安装 Docker..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com | sh > /dev/null 2>&1
    systemctl enable docker >/dev/null 2>&1
    systemctl start docker
fi
echo "✅ Docker $(docker --version | cut -d' ' -f3 | cut -d',' -f1)"

echo ""
echo "🐳 Step 4/10: 安装 Docker Compose..."
if ! command -v docker-compose &> /dev/null; then
    curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose >/dev/null 2>&1
    chmod +x /usr/local/bin/docker-compose
fi
echo "✅ Docker Compose $(docker-compose --version | cut -d' ' -f3 | cut -d',' -f1)"

echo ""
echo "📁 Step 5/10: 准备项目目录..."
mkdir -p $PROJECT_DIR
cd $PROJECT_DIR

# 检查是否有项目文件
if [ ! -f "package.json" ]; then
    echo "⚠️  未找到项目文件，请确保已上传项目到 $PROJECT_DIR"
    echo ""
    echo "上传命令(在本地执行):"
    echo "  tar czf poker-server.tar.gz poker-server-modern/ --exclude=node_modules"
    echo "  scp poker-server.tar.gz root@43.106.106.92:/opt/"
    echo ""
    echo "然后在服务器执行:"
    echo "  cd /opt && tar xzf poker-server.tar.gz && mv poker-server-modern poker-server"
    exit 1
fi

echo ""
echo "📦 Step 6/10: 安装项目依赖..."
npm install --silent --progress=false

echo ""
echo "🔨 Step 7/10: 构建共享包..."
cd packages/shared
npm install --silent --progress=false >/dev/null 2>&1
npm run build >/dev/null 2>&1
cd ../poker-engine
npm install --silent --progress=false >/dev/null 2>&1
npm run build >/dev/null 2>&1
cd ../..

echo ""
echo "🔧 Step 8/10: 配置后端..."
cd apps/server
npm install --silent --progress=false >/dev/null 2>&1

# 创建生产环境配置
cat > .env << EOF
NODE_ENV=production
PORT=3000
DATABASE_URL=postgresql://postgres:poker123@localhost:5432/poker?schema=public
REDIS_URL=redis://localhost:6379
JWT_SECRET=$(openssl rand -base64 32)
JWT_REFRESH_SECRET=$(openssl rand -base64 32)
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
LOG_LEVEL=info
EOF

echo "✅ 环境变量已创建"
cd ../..

echo ""
echo "🐳 Step 9/10: 启动数据库..."
cd infra/docker

# 创建生产环境 docker-compose
cat > docker-compose.prod.yml << 'EOF'
version: '3.8'

services:
  postgres:
    image: postgres:16-alpine
    container_name: poker-postgres
    restart: always
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=poker123
      - POSTGRES_DB=poker
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "127.0.0.1:5432:5432"
    networks:
      - poker-network

  redis:
    image: redis:7-alpine
    container_name: poker-redis
    restart: always
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    ports:
      - "127.0.0.1:6379:6379"
    networks:
      - poker-network

volumes:
  postgres_data:
  redis_data:

networks:
  poker-network:
    driver: bridge
EOF

docker-compose -f docker-compose.prod.yml up -d
echo "⏳ 等待数据库启动..."
sleep 10

cd ../../apps/server

echo ""
echo "🗄️  Step 10/10: 数据库迁移..."
npx prisma migrate deploy >/dev/null 2>&1
npx prisma generate >/dev/null 2>&1
cd ../..

echo ""
echo "🔨 构建前端..."
cd apps/web
npm install --silent --progress=false >/dev/null 2>&1
cat > .env << EOF
VITE_API_URL=http://43.106.106.92:3000
VITE_WS_URL=ws://43.106.106.92:3000
EOF
npm run build >/dev/null 2>&1
cd ../..

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
        proxy_read_timeout 86400;
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
        proxy_read_timeout 86400;
    }
}
EOF

ln -sf /etc/nginx/sites-available/poker-server /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "🔧 创建系统服务..."
cat > /etc/systemd/system/poker-server.service << 'EOF'
[Unit]
Description=Poker Server Modern
After=network.target docker.service
Requires=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=/opt/poker-server/apps/server
Environment=NODE_ENV=production
Environment=PATH=/usr/bin:/usr/local/bin
ExecStart=/usr/bin/npm run start
Restart=always
RestartSec=10
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable poker-server

echo ""
echo "==================================="
echo "✅ 部署完成!"
echo ""
echo "🚀 启动服务:"
echo "  systemctl start poker-server"
echo ""
echo "📊 查看日志:"
echo "  journalctl -u poker-server -f"
echo ""
echo "🌐 访问地址:"
echo "  http://43.106.106.92"
echo ""
echo "📝 重要信息:"
echo "  - 项目目录: $PROJECT_DIR"
echo "  - 后端配置: $PROJECT_DIR/apps/server/.env"
echo "  - Nginx配置: /etc/nginx/sites-available/poker-server"
echo ""
echo "🔧 常用命令:"
echo "  启动: systemctl start poker-server"
echo "  停止: systemctl stop poker-server"
echo "  重启: systemctl restart poker-server"
echo "  状态: systemctl status poker-server"
echo "==================================="
