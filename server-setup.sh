#!/bin/bash
# 在服务器上执行此脚本
# ssh root@43.106.106.92 后粘贴以下内容

cd /opt

# 安装基础工具
apt-get update -y
apt-get install -y curl git nginx

# 安装 Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# 安装 Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# 安装 Docker Compose
curl -L "https://github.com/docker/compose/releases/download/v2.23.0/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
chmod +x /usr/local/bin/docker-compose

# 克隆项目（你需要替换为实际的项目地址）
# git clone https://github.com/your-username/poker-server-modern.git poker-server

echo "================================"
echo "基础环境安装完成!"
echo ""
echo "Node.js: $(node -v)"
echo "NPM: $(npm -v)"
echo "Docker: $(docker --version)"
echo ""
echo "下一步:"
echo "1. 上传项目代码到 /opt/poker-server"
echo "2. 执行: cd /opt/poker-server && ./quick-deploy.sh"
echo "================================"
