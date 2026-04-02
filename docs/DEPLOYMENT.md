# 部署指南 - Poker Server Modern

## 📋 目录

- [环境要求](#环境要求)
- [开发环境部署](#开发环境部署)
- [生产环境部署](#生产环境部署)
- [Docker 部署](#docker-部署)
- [Kubernetes 部署](#kubernetes-部署)
- [监控与日志](#监控与日志)
- [故障排除](#故障排除)

---

## 环境要求

### 硬件要求

| 环境 | CPU | 内存 | 存储 | 实例数 |
|------|-----|------|------|--------|
| 开发 | 2核 | 4GB | 20GB | 1 |
| 小规模 | 4核 | 8GB | 50GB | 1 |
| 中规模 | 8核 | 16GB | 100GB | 3 |
| 大规模 | 16核 | 32GB | 200GB | 10+ |

### 软件要求

| 软件 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20 LTS | 后端运行 |
| PostgreSQL | >= 16 | 主数据库 |
| Redis | >= 7 | 缓存/消息队列 |
| Docker | >= 24 | 容器化 |
| Kubernetes | >= 1.28 | 编排 (可选) |

---

## 开发环境部署

### 快速启动

```bash
# 1. 克隆并安装
git clone https://github.com/newqz/poker-server-modern.git
cd poker-server-modern
npm install

# 2. 配置环境变量
cp .env.example .env
# 编辑 .env，设置安全的密码和密钥

# 3. 启动基础设施
docker-compose -f infra/docker/docker-compose.dev.yml up -d postgres redis

# 4. 初始化数据库
npm run db:migrate
npm run db:generate

# 5. 启动开发服务器
npm run dev
```

### 验证安装

```bash
# 检查后端健康
curl http://localhost:3000/health

# 检查 WebSocket
curl -i -N \
  -H "Upgrade: websocket" \
  -H "Connection: Upgrade" \
  http://localhost:3000/socket.io/?EIO=4&transport=websocket
```

---

## 生产环境部署

### 前提条件

1. **域名和 SSL 证书**
   - 配置 DNS 指向服务器
   - 获取 SSL 证书 (Let's Encrypt 或商业证书)

2. **安全配置**
   - 修改所有默认密码
   - 配置防火墙规则
   - 启用 Fail2Ban

3. **备份策略**
   - 配置 PostgreSQL 备份
   - 测试备份恢复流程

### 部署检查清单

- [ ] 域名已配置 SSL 证书
- [ ] 所有密码已修改为强密码
- [ ] 数据库备份已配置
- [ ] 监控告警已设置
- [ ] 日志聚合已配置
- [ ] 防火墙只开放必要端口
- [ ] 安全扫描已通过

### 构建生产版本

```bash
# 1. 安装依赖
npm install

# 2. 类型检查
npm run typecheck

# 3. 构建所有包
npm run build

# 4. 运行测试
npm test

# 5. 打包
tar -czvf poker-server-deploy.tar.gz \
  apps/server/dist \
  apps/web/dist \
  packages/*/dist \
  node_modules \
  .env.production \
  infra/docker/docker-compose.prod.yml
```

### 环境变量配置

创建 `.env.production`:

```bash
# 数据库
DATABASE_URL="postgresql://pokeruser:YOUR_SECURE_PASSWORD@db-host:5432/poker"

# Redis
REDIS_URL="redis://:YOUR_REDIS_PASSWORD@redis-host:6379"

# JWT (必须至少32字符)
JWT_SECRET="YOUR_VERY_LONG_AND_SECURE_JWT_SECRET_HERE"
JWT_REFRESH_SECRET="ANOTHER_VERY_LONG_AND_SECURE_REFRESH_SECRET"

# 服务器
NODE_ENV=production
PORT=3000
CORS_ORIGIN="https://yourdomain.com"

# 安全
SNAPSHOT_SECRET="YOUR_SNAPSHOT_VERIFICATION_SECRET"
```

---

## Docker 部署

### 生产用 docker-compose

创建 `infra/docker/docker-compose.prod.yml`:

```yaml
version: '3.8'

services:
  server:
    image: poker-server:${VERSION:-latest}
    container_name: poker-server
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=${DATABASE_URL}
      - REDIS_URL=${REDIS_URL}
      - JWT_SECRET=${JWT_SECRET}
      - JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
      - SNAPSHOT_SECRET=${SNAPSHOT_SECRET}
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/health"]
      interval: 30s
      timeout: 10s
      retries: 3
    networks:
      - poker-network

  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=${POSTGRES_USER}
      - POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
      - POSTGRES_DB=${POSTGRES_DB}
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped
    networks:
      - poker-network

  redis:
    image: redis:7-alpine
    command: redis-server --requirepass ${REDIS_PASSWORD}
    volumes:
      - redis_data:/data
    restart: unless-stopped
    networks:
      - poker-network

volumes:
  postgres_data:
  redis_data:

networks:
  poker-network:
    driver: bridge
```

### 启动命令

```bash
# 构建镜像
docker build -f infra/docker/Dockerfile.server -t poker-server:latest .

# 启动服务
docker-compose -f infra/docker/docker-compose.prod.yml up -d

# 查看日志
docker-compose -f infra/docker/docker-compose.prod.yml logs -f server

# 停止服务
docker-compose -f infra/docker/docker-compose.prod.yml down
```

---

## Kubernetes 部署

### 前提条件

- Kubernetes 1.28+
- Helm 3.12+
- Ingress Controller (如 nginx-ingress)
- cert-manager for TLS

### 部署步骤

```bash
# 1. 创建 namespace
kubectl create namespace poker

# 2. 创建 secrets
kubectl create secret generic poker-secrets \
  --from-literal=DATABASE_URL="postgresql://user:pass@host:5432/db" \
  --from-literal=REDIS_URL="redis://:pass@host:6379" \
  --from-literal=JWT_SECRET="your-jwt-secret" \
  --from-literal=JWT_REFRESH_SECRET="your-refresh-secret" \
  --namespace=poker

# 3. 部署
kubectl apply -f infra/k8s/ -n poker

# 4. 检查状态
kubectl get pods -n poker
kubectl get svc -n poker
```

### Kubernetes 资源清单

```yaml
# infra/k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: poker-server
  namespace: poker
spec:
  replicas: 3
  selector:
    matchLabels:
      app: poker-server
  template:
    metadata:
      labels:
        app: poker-server
    spec:
      containers:
        - name: server
          image: poker-server:latest
          ports:
            - containerPort: 3000
          resources:
            requests:
              memory: "512Mi"
              cpu: "250m"
            limits:
              memory: "2Gi"
              cpu: "1000m"
          envFrom:
            - secretRef:
                name: poker-secrets
          livenessProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
---
apiVersion: v1
kind: Service
metadata:
  name: poker-server
  namespace: poker
spec:
  selector:
    app: poker-server
  ports:
    - port: 80
      targetPort: 3000
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: poker-server
  namespace: poker
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  tls:
    - hosts:
        - api.yourdomain.com
      secretName: poker-server-tls
  rules:
    - host: api.yourdomain.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: poker-server
                port:
                  number: 80
```

---

## 监控与日志

### 健康检查端点

```bash
# 基础健康
curl http://localhost:3000/health

# 完整健康 (含依赖)
curl http://localhost:3000/health/ready
```

### 日志配置

```typescript
// apps/server/src/utils/logger.ts
// 生产环境应使用结构化日志
const logger = {
  level: process.env.LOG_LEVEL || 'info',
  format: 'json',  // 生产环境用 JSON 格式
};
```

### 监控指标

建议使用 Prometheus + Grafana:

| 指标 | 说明 |
|------|------|
| `poker_active_games` | 当前活跃游戏数 |
| `poker_players_online` | 在线玩家数 |
| `poker_game_latency` | 游戏动作延迟 |
| `poker_ws_connections` | WebSocket 连接数 |
| `http_request_duration` | HTTP 请求延迟 |
| `db_connection_pool` | 数据库连接池使用 |

---

## 故障排除

### 常见问题

#### 1. 数据库连接失败

```bash
# 检查 PostgreSQL 日志
docker logs poker-postgres

# 测试连接
psql ${DATABASE_URL} -c "SELECT 1"
```

#### 2. Redis 连接失败

```bash
# 检查 Redis 日志
docker logs poker-redis

# 测试连接
redis-cli -u ${REDIS_URL} ping
```

#### 3. WebSocket 连接问题

```bash
# 检查端口占用
netstat -tlnp | grep 3000

# 测试 WebSocket
wscat -c ws://localhost:3000/socket.io/?EIO=4&transport=websocket
```

#### 4. 内存不足

```bash
# 查看内存使用
free -h
docker stats

# 增加 swap
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### 紧急恢复

```bash
# 1. 停止所有服务
docker-compose down

# 2. 备份数据
docker exec poker-postgres pg_dump -U postgres poker > backup.sql

# 3. 恢复数据库
docker exec -i poker-postgres psql -U postgres poker < backup.sql

# 4. 重启服务
docker-compose up -d
```

---

## 性能优化

### PostgreSQL 优化

```sql
-- 连接池大小
ALTER SYSTEM SET max_connections = 200;

-- 共享缓冲区
ALTER SYSTEM SET shared_buffers = '256MB';

-- 有效缓存大小
ALTER SYSTEM SET effective_cache_size = '512MB';

-- 工作内存
ALTER SYSTEM SET work_mem = '4MB';
```

### Redis 优化

```bash
# redis.conf 优化
maxmemory 256mb
maxmemory-policy allkeys-lru
appendonly yes
appendfsync everysec
```

---

## 备份策略

### 数据库备份

```bash
#!/bin/bash
# scripts/backup.sh

DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR=/backups
DATABASE_URL="postgresql://user:pass@host:5432/db"

# 每日全量备份
pg_dump -Fc ${DATABASE_URL} > ${BACKUP_DIR}/poker_${DATE}.dump

# 保留最近 30 天
find ${BACKUP_DIR} -name "poker_*.dump" -mtime +30 -delete

# 上传至 S3 (可选)
# aws s3 cp ${BACKUP_DIR}/poker_${DATE}.dump s3://your-bucket/backups/
```

### 恢复流程

```bash
# 停止服务
docker-compose stop server

# 恢复数据库
pg_restore -Fc -d ${DATABASE_URL} /backups/poker_20260402_120000.dump

# 重启服务
docker-compose start server
```

---

**最后更新**: 2026-04-02
