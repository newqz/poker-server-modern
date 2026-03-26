# Poker Server Modern

A production-ready Texas Hold'em poker server with real-time multiplayer support, built with Node.js, TypeScript, Socket.io, and PostgreSQL.

## Features

- 🃏 **Texas Hold'em Poker** - Complete game logic with betting rounds, hand evaluation, and winner determination
- ⚡ **Real-time Multiplayer** - Socket.io based communication for instant game updates
- 🔐 **Secure Authentication** - JWT-based auth with refresh tokens and httpOnly cookies
- 🎯 **Game State Filtering** - Players only see their own hole cards
- 📊 **Production Ready** - Metrics, health checks, graceful shutdown, audit logging
- 🔄 **Transaction Safety** - Atomic chip transactions with rollback support
- 🐳 **Docker Support** - Easy deployment with Docker and Docker Compose

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Cache**: Redis for Socket.io adapter
- **Real-time**: Socket.io
- **Frontend**: React (web app)

## Project Structure

```
poker-server-modern/
├── apps/
│   ├── server/          # Backend API server
│   │   ├── src/
│   │   │   ├── routes/     # API endpoints
│   │   │   ├── services/    # Business logic
│   │   │   ├── middleware/   # Express middleware
│   │   │   └── utils/       # Utilities
│   │   └── prisma/         # Database schema
│   └── web/             # Frontend React app
├── packages/
│   ├── shared/          # Shared types and utilities
│   └── poker-engine/    # Game logic engine
└── infra/
    └── docker/          # Docker configuration
```

## Getting Started

### Prerequisites

- Node.js 20+
- PostgreSQL 16+
- Redis 7+
- npm or pnpm

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd poker-server-modern

# Install dependencies
npm install

# Generate Prisma client
cd apps/server && npx prisma generate

# Start PostgreSQL and Redis (Docker)
docker-compose -f infra/docker/docker-compose.yml up -d

# Run database migrations
npx prisma db push

# Start development server
npm run dev
```

### Production Build

```bash
# Build all packages
npm run build

# Start production server
cd apps/server && npm start
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | /api/v1/auth/register | Register new user |
| POST | /api/v1/auth/login | User login |
| POST | /api/v1/auth/refresh | Refresh access token |
| POST | /api/v1/auth/logout | Logout user |
| GET | /api/v1/rooms | List game rooms |
| POST | /api/v1/rooms | Create game room |
| POST | /api/v1/games/:id/join | Join a game |
| POST | /api/v1/games/:id/action | Perform game action |

## Environment Variables

```env
DATABASE_URL="postgresql://user:pass@localhost:5432/poker"
REDIS_URL="redis://localhost:6379"
JWT_SECRET="your-secret-key"
JWT_REFRESH_SECRET="your-refresh-secret"
CORS_ORIGIN="http://localhost:5173"
```

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.
