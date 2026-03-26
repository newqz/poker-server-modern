#!/bin/bash
# 数据库种子脚本

set -e

echo "🌱 导入数据库种子数据..."

cd apps/server
npx prisma db seed

echo "✅ 种子数据导入完成"
