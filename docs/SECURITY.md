# 安全指南 - Poker Server Modern

## ⚠️ 重要提醒

**本项目存在已知安全风险，不适合直接部署到生产环境。**

在部署前，必须解决所有 P0 阻断性问题。详见 [../PRODUCTION_READINESS.md](../PRODUCTION_READINESS.md)

---

## 📋 目录

- [认证安全](#认证安全)
- [资金安全](#资金安全)
- [游戏公平性](#游戏公平性)
- [网络安全](#网络安全)
- [数据保护](#数据保护)
- [安全检查清单](#安全检查清单)

---

## 认证安全

### ✅ 已实现

1. **密码哈希**：bcrypt (cost factor 12)
2. **JWT Token**：
   - Access Token: 1小时有效期
   - Refresh Token: 7天有效期，存储哈希而非明文
3. **恒定时间比较**：防止 Timing Attack
4. **登录限流**：5次/15分钟
5. **账号锁定**：5次失败后锁定15分钟
6. **Token 家族追踪**：检测被盗用的 token

### ❌ 已知问题

1. 登录失败追踪使用内存 Map，多实例部署不生效
2. Token 存储在 httpOnly Cookie，但仍需完善 CSRF 保护

### 🔧 强化建议

```typescript
// 1. 使用 Redis 实现分布式限流
const redisClient = createClient({ url: process.env.REDIS_URL });
await redisClient.connect();

// 2. 添加 CSRF Token
// POST /api/v1/auth/login 需要同时验证 CSRF Token
```

---

## 资金安全

### ✅ 已实现

1. **数据库事务**：资金变动使用 Prisma Transaction
2. **乐观锁**：检查余额是否足够
3. **审计日志**：所有资金变动记录
4. **状态回滚**：事务失败时回滚 GameEngine 状态
5. **Mutex 保护**：processAction 使用互斥锁防止竞态

### ❌ 已知问题

1. `balance` 字段无数据库非负约束
2. 边池 (Side Pot) 计算可能存在 bug
3. 未实现用户每日提现限额

### 🔧 强化建议

```sql
-- 添加数据库约束
ALTER TABLE "users" ADD CONSTRAINT balance_non_negative 
  CHECK (balance >= 0);

-- 添加触发器
CREATE OR REPLACE FUNCTION prevent_negative_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.balance < 0 THEN
    RAISE EXCEPTION 'Balance cannot be negative';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER users_balance_check
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION prevent_negative_balance();
```

---

## 游戏公平性

### ✅ 已实现

1. **服务器权威**：客户端仅显示，服务器做决策
2. **手牌加密**：断线重连时验证手牌
3. **动作验证**：所有动作在服务器端验证
4. **状态过滤**：玩家只能看到自己的手牌

### ❌ 缺失功能

1. **可验证随机**：未实现玩家可验证的发牌
2. **时间戳验证**：未防止变速挂
3. **AI 机器人检测**：未实现
4. **伙牌检测**：未实现

### 🔧 强化建议

```typescript
// 可验证随机发牌示例
interface HandSeed {
  handId: string;
  serverSeedHash: string;  // 提前公开哈希
  clientSeeds: string[];   // 客户端种子
  combinedSeed: string;    // 组合后公开
}

// 发牌流程
async function dealCards(gameId: string, playerIds: string[]) {
  // 1. 服务器生成种子
  const serverSeed = crypto.randomBytes(32);
  const serverSeedHash = sha256(serverSeed);
  
  // 2. 收集客户端种子
  const clientSeeds = await Promise.all(
    playerIds.map(p => waitForClientSeed(p))
  );
  
  // 3. 生成组合种子
  const combinedSeed = sha256(
    serverSeed + clientSeeds.join('')
  );
  
  // 4. 使用组合种子洗牌
  const deck = shuffleWithSeed(combinedSeed);
  
  // 5. 公开服务器种子（牌局结束后）
  revealServerSeed(gameId, serverSeed);
}
```

---

## 网络安全

### ✅ 已实现

1. **Helmet**：安全头部配置
2. **CORS**：跨域限制
3. **Rate Limiting**：API 限流
4. **Input Validation**：Zod schema 验证
5. **HTTPS**：生产环境需配置

### ❌ 缺失功能

1. **TLS 配置**：需在反向代理层配置
2. **DDoS 防护**：需使用 CDN/WAF
3. **IP 黑名单**：需实现动态封禁

### 🔧 强化建议

```yaml
# Nginx 配置示例
server {
    listen 443 ssl http2;
    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    
    # 限流
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;
    
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://backend;
    }
}
```

---

## 数据保护

### 敏感数据清单

| 数据类型 | 存储方式 | 风险等级 |
|---------|---------|---------|
| 用户密码 | bcrypt 哈希 | 高 |
| JWT Secret | 环境变量 | 极高 |
| Refresh Token | SHA256 哈希 | 高 |
| 用户余额 | PostgreSQL BigInt | 极高 |
| 手牌信息 | 内存 (+ Redis) | 高 |
| IP 地址 | PostgreSQL | 中 |
| 操作日志 | ClickHouse | 低 |

### 🔧 强化建议

```typescript
// 1. 敏感字段加密存储
import { encrypt, decrypt } from './crypto';

class UserService {
  async createUser(data: CreateUserInput) {
    const encrypted = {
      ...data,
      // 只加密特定字段
    };
    return this.prisma.user.create({ data: encrypted });
  }
}

// 2. 日志脱敏
function sanitizeForLog(obj: any): any {
  const sensitive = ['password', 'token', 'secret', 'balance'];
  const sanitized = { ...obj };
  
  for (const key of Object.keys(sanitized)) {
    if (sensitive.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '***REDACTED***';
    }
  }
  
  return sanitized;
}
```

---

## 安全检查清单

### 部署前必须完成

- [ ] 修改所有默认密码
- [ ] 配置强 JWT Secret (至少 32 字符)
- [ ] 启用 HTTPS/TLS
- [ ] 配置防火墙，只开放必要端口
- [ ] 设置数据库备份策略
- [ ] 配置日志聚合和告警
- [ ] 实现 Rate Limiting
- [ ] 添加健康检查端点
- [ ] 测试所有认证流程
- [ ] 安全代码审查通过

### 定期检查任务

| 任务 | 频率 | 说明 |
|------|------|------|
| 依赖安全扫描 | 每周 | `npm audit` |
| 日志审查 | 每天 | 检查异常行为 |
| 渗透测试 | 每季度 | 专业安全测试 |
| 密钥轮换 | 每季度 | JWT Secret 等 |
| 备份恢复演练 | 每月 | 确保可恢复 |

### 环境配置检查

```bash
# .env.production 检查清单
NODE_ENV=production
DATABASE_URL=postgresql://user:STRONG_PASSWORD@host:5432/db
REDIS_PASSWORD=STRONG_PASSWORD
JWT_SECRET=AT_LEAST_32_CHARACTERS_LONG_RANDOM_STRING
JWT_REFRESH_SECRET=ANOTHER_32_CHARACTERS_LONG_RANDOM_STRING
SNAPSHOT_SECRET=ANOTHER_SECURE_SECRET
CORS_ORIGIN=https://yourdomain.com
```

---

## 报告安全漏洞

如果您发现安全漏洞，请：

1. **不要**在 GitHub Issue 中公开
2. 发送邮件至项目维护者
3. 提供详细信息和复现步骤
4. 我们将在 48 小时内响应

---

**最后更新**: 2026-04-02
