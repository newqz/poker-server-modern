# 开发文档 - Poker Server Modern

## 📋 目录

- [环境搭建](#环境搭建)
- [快速开始](#快速开始)
- [项目结构](#项目结构)
- [开发规范](#开发规范)
- [测试指南](#测试指南)
- [调试技巧](#调试技巧)

---

## 环境搭建

### 前置要求

| 工具 | 版本 | 说明 |
|------|------|------|
| Node.js | >= 20.0.0 | 推荐使用 LTS 版本 |
| npm | >= 10.0.0 | Node.js 自带 |
| PostgreSQL | >= 16 | 数据库 |
| Redis | >= 7 | 缓存和消息队列 |
| Docker | >= 24 | 可选，用于本地开发 |

### 1. 克隆项目

```bash
git clone https://github.com/newqz/poker-server-modern.git
cd poker-server-modern
```

### 2. 安装依赖

```bash
# 安装所有 workspace 依赖
npm install
```

### 3. 配置环境变量

```bash
# 复制环境变量模板
cp .env.example .env

# 编辑 .env 文件，修改以下必需配置：
# - POSTGRES_PASSWORD (数据库密码)
# - JWT_SECRET (JWT 密钥，至少 32 字符)
# - JWT_REFRESH_SECRET (刷新密钥，至少 32 字符)
```

### 4. 启动数据库 (使用 Docker)

```bash
# 启动 PostgreSQL 和 Redis
docker-compose -f infra/docker/docker-compose.dev.yml up -d postgres redis

# 初始化数据库
npm run db:migrate

# 生成 Prisma 客户端
npm run db:generate

# 可选：填充初始数据
npm run db:seed
```

### 5. 启动开发服务器

```bash
# 启动后端和前端 (并行)
npm run dev

# 或者分别启动
cd apps/server && npm run dev
cd apps/web && npm run dev
```

### 6. 访问应用

| 服务 | 地址 |
|------|------|
| 前端 | http://localhost:5173 |
| 后端 API | http://localhost:3000 |
| API 文档 | http://localhost:3000/api/v1/docs |
| Redis Commander | http://localhost:8081 (仅开发) |

---

## 快速开始

### 首次运行检查清单

- [ ] Node.js 版本 >= 20
- [ ] .env 文件已创建并配置
- [ ] PostgreSQL 和 Redis 已启动
- [ ] 数据库已初始化 (`npm run db:migrate`)
- [ ] 依赖已安装 (`npm install`)

### 验证安装

```bash
# 运行测试
npm test

# 类型检查
npm run typecheck

# 构建检查
npm run build
```

---

## 项目结构

```
poker-server-modern/
├── apps/
│   ├── server/                    # 后端 API 服务
│   │   ├── src/
│   │   │   ├── routes/           # API 路由
│   │   │   │   ├── auth.ts       # 认证 (注册/登录/登出)
│   │   │   │   ├── room.ts       # 房间管理
│   │   │   │   ├── game.ts       # 游戏操作
│   │   │   │   └── user.ts       # 用户信息
│   │   │   ├── services/         # 业务逻辑
│   │   │   │   ├── socket.ts     # WebSocket 处理
│   │   │   │   ├── game.ts       # 游戏服务
│   │   │   │   └── audit.ts      # 审计日志
│   │   │   ├── middleware/       # Express 中间件
│   │   │   │   ├── authenticate.ts
│   │   │   │   ├── errorHandler.ts
│   │   │   │   └── metrics.ts
│   │   │   ├── utils/
│   │   │   │   └── logger.ts
│   │   │   ├── server.ts         # 服务器配置
│   │   │   └── index.ts          # 入口
│   │   └── prisma/
│   │       └── schema.prisma     # 数据库模型
│   │
│   └── web/                      # React 前端
│       └── src/
│           ├── pages/            # 页面组件
│           ├── components/       # 通用组件
│           ├── services/         # API 客户端
│           ├── store/            # 状态管理
│           └── App.tsx
│
├── packages/
│   ├── shared/                   # 共享类型和常量
│   │   └── src/
│   │       ├── types/            # TypeScript 类型定义
│   │       ├── constants/        # 游戏常量
│   │       └── utils/            # 工具函数
│   │
│   └── poker-engine/             # 游戏引擎核心
│       └── src/
│           ├── deck/             # 牌堆管理
│           ├── evaluator/        # 手牌评估
│           ├── game/             # 游戏引擎
│           │   ├── GameEngine.ts # 核心引擎 (使用 Mutex)
│           │   └── BettingRound.ts
│           └── types/
│
├── infra/
│   └── docker/
│       ├── docker-compose.dev.yml
│       └── Dockerfile.server
│
├── docs/                         # 文档
│   ├── DEVELOPMENT.md           # 本文档
│   ├── ARCHITECTURE.md          # 架构设计
│   ├── API.md                   # API 文档
│   ├── SECURITY.md              # 安全指南
│   └── DEPLOYMENT.md           # 部署指南
│
└── .env.example                 # 环境变量模板
```

---

## 开发规范

### 代码风格

- 使用 TypeScript 严格模式
- 使用 ESLint 和 Prettier
- 命名规范：
  - 类名：`PascalCase`
  - 函数/变量：`camelCase`
  - 常量：`UPPER_SNAKE_CASE`
  - 类型/接口：`PascalCase` (前缀 `I` 可选)

### Git 提交规范

使用 [Conventional Commits](https://www.conventionalcommits.org/)：

```
<type>(<scope>): <subject>

Types:
- feat: 新功能
- fix: 修复 bug
- docs: 文档变更
- style: 代码格式
- refactor: 重构
- test: 测试相关
- chore: 构建/工具

Examples:
feat(auth): add refresh token rotation
fix(game): resolve race condition in processAction
docs(api): update user endpoint documentation
```

### 模块设计原则

1. **单一职责**：每个模块只做一件事
2. **最小暴露**：内部实现对外部不可见
3. **不可变优先**：优先使用不可变数据结构
4. **错误处理**：所有错误必须被捕获和处理

### 安全准则

1. **永远不**在代码中硬编码 secrets
2. **永远不**将 `.env` 文件提交到 Git
3. **永远不**在错误信息中泄露敏感数据
4. **永远验证**所有用户输入

---

## 测试指南

### 运行测试

```bash
# 运行所有测试
npm test

# 运行特定包的测试
npm test --workspace=@poker/engine

# 带覆盖率
npm run test:coverage --workspace=@poker/engine
```

### 编写测试

```typescript
// packages/poker-engine/src/game/GameEngine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine';

describe('GameEngine', () => {
  let engine: GameEngine;

  beforeEach(() => {
    engine = new GameEngine('game-1', 'room-1', {
      maxPlayers: 9,
      minPlayers: 2,
      smallBlind: 10,
      bigBlind: 20,
      minBuyIn: 1000,
      maxBuyIn: 10000,
      timeLimit: 30
    });
  });

  it('should add players correctly', () => {
    engine.addPlayer('user-1', 'Alice', 0, 1000);
    engine.addPlayer('user-2', 'Bob', 1, 1000);
    
    const state = engine.getState();
    expect(state.players).toHaveLength(2);
  });

  it('should start game with at least 2 players', () => {
    engine.addPlayer('user-1', 'Alice', 0, 1000);
    
    expect(() => engine.start(0)).toThrow('NEED_AT_LEAST_2_PLAYERS');
  });
});
```

---

## 调试技巧

### 后端调试

```bash
# 启动时显示详细日志
LOG_LEVEL=debug npm run dev --workspace=@poker/server

# 使用 Node.js 调试器
node --inspect apps/server/dist/index.js
```

### 前端调试

```bash
# 启动带 sourcemap 的开发服务器
npm run dev --workspace=@poker/web

# React DevTools 浏览器扩展
# Chrome: https://chrome.google.com/webstore/detail/react-developer-tools
```

### 数据库调试

```bash
# 连接 PostgreSQL
psql postgresql://postgres:password@localhost:5432/poker

# 查看 Redis
redis-cli -h localhost -p 6379
```

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| `MODULE_NOT_FOUND` | 运行 `npm install` |
| `DATABASE_URL` 错误 | 检查 `.env` 中的数据库连接 |
| 端口被占用 | 检查 3000/5173/5432/6379 端口 |
| `prisma generate` 失败 | 确保 PostgreSQL 可连接 |

---

## 下一步

- [架构设计](ARCHITECTURE.md) - 深入了解系统架构
- [API 文档](API.md) - API 接口详解
- [安全指南](SECURITY.md) - 安全最佳实践
- [部署指南](DEPLOYMENT.md) - 生产环境部署

---

**最后更新**: 2026-04-02
