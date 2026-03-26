#!/bin/bash
# 一键部署到远程服务器
# 在本地运行此脚本

set -e

SERVER_IP="43.106.106.92"
SERVER_USER="root"
SERVER_PASS="N-1008-1008"
PROJECT_NAME="poker-server-modern"
LOCAL_DIR="/root/.openclaw-coding/workspace/poker-server-modern"
REMOTE_DIR="/opt/poker-server"

echo "🚀 Poker Server Modern - 一键部署"
echo "=================================="
echo "服务器: $SERVER_IP"
echo ""

# 检查本地项目
if [ ! -d "$LOCAL_DIR" ]; then
    echo "❌ 本地项目不存在: $LOCAL_DIR"
    exit 1
fi

# 打包项目
echo "📦 打包项目..."
cd $(dirname $LOCAL_DIR)
tar czf /tmp/poker-server.tar.gz $(basename $LOCAL_DIR) --exclude=node_modules --exclude=dist --exclude=.git
echo "✅ 打包完成: /tmp/poker-server.tar.gz"

# 检查 sshpass
if ! command -v sshpass &> /dev/null; then
    echo "📦 安装 sshpass..."
    apt-get update && apt-get install -y sshpass 2>/dev/null || yum install -y sshpass 2>/dev/null || echo "请手动安装 sshpass"
fi

# 上传到服务器
echo ""
echo "📤 上传到服务器..."
sshpass -p "$SERVER_PASS" scp -o StrictHostKeyChecking=no /tmp/poker-server.tar.gz $SERVER_USER@$SERVER_IP:/tmp/

# 在服务器上解压并部署
echo ""
echo "🔧 在服务器上部署..."
sshpass -p "$SERVER_PASS" ssh -o StrictHostKeyChecking=no $SERVER_USER@$SERVER_IP << 'REMOTE_SCRIPT'
# 创建目录
mkdir -p /opt/poker-server
cd /opt

# 解压
rm -rf poker-server-old
mv poker-server poker-server-old 2>/dev/null || true
tar xzf /tmp/poker-server.tar.gz
mv poker-server-modern poker-server
cd poker-server

# 运行部署脚本
chmod +x deploy.sh
./deploy.sh
REMOTE_SCRIPT

echo ""
echo "=================================="
echo "🎉 部署完成!"
echo ""
echo "访问地址:"
echo "  http://$SERVER_IP"
echo ""
echo "查看日志:"
echo "  ssh root@$SERVER_IP 'journalctl -u poker-server -f'"
