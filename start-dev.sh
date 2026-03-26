#!/bin/bash
# 完整的项目启动脚本

set -e

echo "🎲 Poker Server Modern - 启动脚本"
echo "=================================="

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# 检查 Node.js
if ! command -v node &> /dev/null; then
    echo -e "${RED}❌ Node.js 未安装${NC}"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo -e "${RED}❌ Node.js 版本需要 >= 20, 当前版本: $(node -v)${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Node.js 版本检查通过: $(node -v)${NC}"

# 检查 Docker
if ! command -v docker &> /dev/null; then
    echo -e "${YELLOW}⚠️  Docker 未安装，将跳过数据库启动${NC}"
    USE_DOCKER=false
else
    USE_DOCKER=true
fi

# 安装根目录依赖
echo ""
echo "📦 安装根目录依赖..."
npm install

# 构建共享包
echo ""
echo "🔨 构建共享类型包..."
cd packages/shared
npm install
npm run build
cd ../..

# 构建游戏引擎
echo ""
echo "🔨 构建扑克引擎..."
cd packages/poker-engine
npm install
npm run build
cd ../..

# 设置后端
echo ""
echo "🔧 设置后端服务..."
cd apps/server
npm install

# 检查环境变量
if [ ! -f .env ]; then
    echo -e "${YELLOW}⚠️  创建 .env 文件 (请修改配置)${NC}"
    cp .env.example .env
fi

# 如果使用 Docker，启动数据库
if [ "$USE_DOCKER" = true ]; then
    echo ""
    echo "🐳 启动数据库服务..."
    cd ../../infra/docker
    docker-compose -f docker-compose.dev.yml up -d postgres redis
    cd ../../apps/server
    
    # 等待数据库就绪
    echo "⏳ 等待数据库就绪..."
    sleep 5
    
    # 运行数据库迁移
    echo ""
    echo "🗄️  运行数据库迁移..."
    npx prisma migrate dev --name init || true
    npx prisma generate
fi

cd ../..

# 设置前端
echo ""
echo "🔧 设置前端应用..."
cd apps/web
npm install
if [ ! -f .env ]; then
    echo "VITE_API_URL=http://localhost:3000" > .env
    echo "VITE_WS_URL=ws://localhost:3000" >> .env
fi
cd ../..

echo ""
echo -e "${GREEN}✅ 项目设置完成!${NC}"
echo ""
echo "=================================="
echo "🚀 启动命令:"
echo ""
echo "1. 启动后端 (终端1):"
echo "   cd apps/server && npm run dev"
echo ""
echo "2. 启动前端 (终端2):"
echo "   cd apps/web && npm run dev"
echo ""
echo "=================================="
echo "📱 访问地址:"
echo "   - Web: http://localhost:5173"
echo "   - API: http://localhost:3000"
echo "   - Health: http://localhost:3000/health"

if [ "$USE_DOCKER" = true ]; then
    echo "   - Redis Commander: http://localhost:8081"
fi
