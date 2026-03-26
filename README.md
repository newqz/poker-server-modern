# Poker Server Modern
# 德州扑克服务器 - 现代版

[![GitHub stars](https://img.shields.io/github/stars/newqz/poker-server-modern)](https://github.com/newqz/poker-server-modern/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

> 🎮 This project is created by [boardgame-studio](https://github.com/newqz/boardgame-studio) - An AI Agent team for converting physical board games into online experiences.
> 
> 🎮 本项目由 [boardgame-studio](https://github.com/newqz/boardgame-studio) 创建 - 一个用于将实体桌游转换为在线体验的 AI Agent 团队。

---

A production-ready Texas Hold'em poker server with real-time multiplayer support, built with Node.js, TypeScript, Socket.io, and PostgreSQL.

一款生产就绪的德州扑克服务器，支持实时多人游戏，基于 Node.js、TypeScript、Socket.io 和 PostgreSQL 构建。

---

## Features | 功能特点

- 🃏 **Texas Hold'em Poker** - Complete game logic with betting rounds, hand evaluation, and winner determination
- ⚡ **Real-time Multiplayer** - Socket.io based communication for instant game updates
- 🔐 **Secure Authentication** - JWT-based auth with refresh tokens and httpOnly cookies
- 🎯 **Game State Filtering** - Players only see their own hole cards
- 📊 **Production Ready** - Metrics, health checks, graceful shutdown, audit logging
- 🔄 **Transaction Safety** - Atomic chip transactions with rollback support
- 🐳 **Docker Support** - Easy deployment with Docker and Docker Compose
- 🤖 **AI Powered** - Built with [boardgame-studio](https://github.com/newqz/boardgame-studio) AI Agent technology

---

## Related Projects | 相关项目

| Project | 描述 |
|---------|------|
| [boardgame-studio](https://github.com/newqz/boardgame-studio) | AI Agent team for converting physical board games into online experiences |
| [poker-server-modern](https://github.com/newqz/poker-server-modern) | This project - Texas Hold'em poker server |

---

## Tech Stack | 技术栈

| Component | 技术 | Description |
|-----------|------|-------------|
| Backend | 后端 | Node.js, Express, TypeScript |
| Database | 数据库 | PostgreSQL with Prisma ORM |
| Cache | 缓存 | Redis for Socket.io adapter |
| Real-time | 实时通信 | Socket.io |
| Frontend | 前端 | React + Vite |
| AI | 人工智能 | [boardgame-studio](https://github.com/newqz/boardgame-studio) |

---

## Project Structure | 项目结构

```
poker-server-modern/
├── apps/
│   ├── server/              # Backend API server | 后端 API 服务
│   │   ├── src/
│   │   │   ├── routes/         # API endpoints | API 端点
│   │   │   ├── services/       # Business logic | 业务逻辑
│   │   │   ├── middleware/      # Express middleware | 中间件
│   │   │   └── utils/          # Utilities | 工具函数
│   │   └── prisma/            # Database schema | 数据库 schema
│   └── web/                   # Frontend React app | 前端 React 应用
├── packages/
│   ├── shared/               # Shared types and utilities | 共享类型和工具
│   └── poker-engine/         # Game logic engine | 游戏逻辑引擎
└── infra/
    └── docker/               # Docker configuration | Docker 配置
```

---

## Getting Started | 快速开始

### Prerequisites | 环境要求

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- npm or pnpm

### Installation | 安装

```bash
# Clone the repository | 克隆仓库
git clone https://github.com/newqz/poker-server-modern.git
cd poker-server-modern

# Install dependencies | 安装依赖
npm install

# Generate Prisma client | 生成 Prisma 客户端
cd apps/server && npx prisma generate

# Start PostgreSQL and Redis (Docker) | 启动数据库
docker-compose -f infra/docker/docker-compose.yml up -d

# Run database migrations | 运行数据库迁移
npx prisma db push

# Start development server | 启动开发服务器
npm run dev
```

### Production Build | 生产构建

```bash
# Build all packages | 构建所有包
npm run build

# Start production server | 启动生产服务器
cd apps/server && npm start
```

---

## API Endpoints | API 端点

| Method | Endpoint | Description | 描述 |
|--------|----------|-------------|------|
| POST | /api/v1/auth/register | Register new user | 注册新用户 |
| POST | /api/v1/auth/login | User login | 用户登录 |
| POST | /api/v1/auth/refresh | Refresh access token | 刷新访问令牌 |
| POST | /api/v1/auth/logout | Logout user | 用户登出 |
| GET | /api/v1/rooms | List game rooms | 获取游戏房间列表 |
| POST | /api/v1/rooms | Create game room | 创建游戏房间 |
| POST | /api/v1/games/:id/join | Join a game | 加入游戏 |
| POST | /api/v1/games/:id/action | Perform game action | 执行游戏动作 |

---

## Environment Variables | 环境变量

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/poker"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
CORS_ORIGIN="http://localhost:5173"
```

---

## Architecture Epics | 架构特性

### Epic 1: Chip Transaction Atomicity | 筹码交易原子性
- ActionResult interface with chip change tracking
- JSON snapshot rollback for game state
- Prisma $transaction for atomic operations

### Epic 2: Frontend Data Filtering | 前端数据过滤
- filterGameStateForPlayer function
- Per-socket filtered broadcast
- Hole cards hidden from other players

### Epic 3: httpOnly Cookie Authentication | httpOnly Cookie 认证
- Access token in memory, refresh token in httpOnly cookie
- authenticate middleware
- Secure cookie in production

---

## License | 许可证

MIT License - see [LICENSE](LICENSE) for details.
MIT 许可证 - 详见 [LICENSE](LICENSE)。

---

## Contributing | 贡献

Contributions are welcome! Please feel free to submit a Pull Request.
欢迎贡献！请随时提交 Pull Request。

This project is powered by [boardgame-studio](https://github.com/newqz/boardgame-studio).
本项目由 [boardgame-studio](https://github.com/newqz/boardgame-studio) 提供支持。
