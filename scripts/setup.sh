#!/bin/bash
# 项目初始化脚本

set -e

echo "🎲 初始化 Poker Server Modern 项目..."

# 检查 Node.js 版本
if ! command -v node &> /dev/null; then
    echo "❌ Node.js 未安装"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 版本需要 >= 20, 当前版本: $(node -v)"
    exit 1
fi

echo "✅ Node.js 版本检查通过: $(node -v)"

# 安装依赖
echo "📦 安装依赖..."
npm install

# 构建共享包
echo "🔨 构建共享类型包..."
npm run build --workspace=@poker/shared

# 启动开发环境
echo "🚀 启动开发环境..."
echo ""
echo "使用以下命令启动服务:"
echo "  docker-compose -f infra/docker/docker-compose.dev.yml up -d"
echo ""
echo "服务启动后:"
echo "  - API: http://localhost:3000"
echo "  - Web: http://localhost:5173"
echo "  - PostgreSQL: localhost:5432"
echo "  - Redis: localhost:6379"
echo "  - Redis Commander: http://localhost:8081"
