#!/bin/bash
# 数据库迁移脚本

set -e

ENV=${1:-development}

echo "🗄️  执行数据库迁移 [$ENV]..."

cd apps/server

if [ "$ENV" = "production" ]; then
    npx prisma migrate deploy
else
    npx prisma migrate dev
fi

echo "✅ 数据库迁移完成"
