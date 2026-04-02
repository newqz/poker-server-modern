# API 文档 - Poker Server Modern

## 📋 目录

- [基础信息](#基础信息)
- [认证](#认证-api)
- [房间](#房间-api)
- [游戏](#游戏-api)
- [用户](#用户-api)
- [WebSocket](#websocket-api)
- [错误码](#错误码)

---

## 基础信息

### Base URL

```
开发环境: http://localhost:3000/api/v1
生产环境: https://api.yourdomain.com/api/v1
```

### 认证方式

除 `/auth/*` 端点外，所有 API 需要 JWT Access Token：

```
Authorization: Bearer <access_token>
```

### 请求格式

```headers
Content-Type: application/json
Accept: application/json
```

### 响应格式

```json
{
  "success": true,
  "data": { ... }
}
```

错误响应：

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human readable message"
  }
}
```

---

## 认证 API

### 注册用户

```
POST /auth/register
```

**请求体**：

```json
{
  "username": "alice",
  "email": "alice@example.com",
  "password": "SecurePassword123"
}
```

**字段说明**：

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| username | string | 是 | 3-32字符，字母数字下划线 |
| email | string | 是 | 有效邮箱格式 |
| password | string | 是 | 8-100字符 |

**响应**：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "alice",
      "email": "alice@example.com",
      "balance": 10000
    },
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

---

### 用户登录

```
POST /auth/login
```

**请求体**：

```json
{
  "email": "alice@example.com",
  "password": "SecurePassword123"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "user": {
      "id": "uuid",
      "username": "alice",
      "email": "alice@example.com",
      "balance": 10000
    },
    "accessToken": "eyJhbG..."
  }
}
```

**Cookie**：
- `refreshToken`: httpOnly, secure, sameSite=strict, 7天

---

### 刷新 Token

```
POST /auth/refresh
```

**请求体** (可选):

```json
{
  "refreshToken": "eyJhbG..."
}
```

或使用 Cookie 自动发送。

**响应**：

```json
{
  "success": true,
  "data": {
    "accessToken": "eyJhbG...",
    "refreshToken": "eyJhbG..."
  }
}
```

---

### 用户登出

```
POST /auth/logout
```

**响应**：

```json
{
  "success": true,
  "message": "Logged out successfully"
}
```

---

## 房间 API

### 创建房间

```
POST /rooms
```

**请求头**：
```
Authorization: Bearer <access_token>
```

**请求体**：

```json
{
  "name": "Alice's Room",
  "maxPlayers": 6,
  "smallBlind": 10,
  "bigBlind": 20,
  "minBuyIn": 1000,
  "maxBuyIn": 5000,
  "isPrivate": false,
  "password": "optional"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "code": "ABC123",
    "name": "Alice's Room",
    "maxPlayers": 6,
    "smallBlind": 10,
    "bigBlind": 20,
    "status": "WAITING",
    "members": [...]
  }
}
```

---

### 获取房间列表

```
GET /rooms
```

**查询参数**：

| 参数 | 类型 | 说明 |
|------|------|------|
| status | string | 筛选状态 (WAITING/PLAYING) |
| limit | number | 返回数量 (默认20) |
| offset | number | 偏移量 |

**响应**：

```json
{
  "success": true,
  "data": {
    "rooms": [...],
    "total": 100,
    "limit": 20,
    "offset": 0
  }
}
```

---

### 加入房间

```
POST /rooms/:code/join
```

**请求体**：

```json
{
  "password": "room-password-if-private"
}
```

**响应**：

```json
{
  "success": true,
  "data": {
    "roomId": "uuid",
    "seatNumber": 2,
    "members": [...]
  }
}
```

---

### 离开房间

```
POST /rooms/:id/leave
```

**响应**：

```json
{
  "success": true
}
```

---

## 游戏 API

### 玩家准备

```
POST /games/:roomId/ready
```

**响应**：

```json
{
  "success": true,
  "data": {
    "canStart": false,
    "memberCount": 2
  }
}
```

---

### 开始游戏

```
POST /games/:roomId/start
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "game-uuid",
    "state": {
      "status": "PREFLOP",
      "round": "PREFLOP",
      "players": [...],
      "communityCards": [],
      "pot": 30
    }
  }
}
```

---

### 执行游戏动作

```
POST /games/:id/action
```

**请求体**：

```json
{
  "action": "RAISE",
  "amount": 100
}
```

**动作类型**：

| action | amount | 说明 |
|--------|--------|------|
| FOLD | - | 弃牌 |
| CHECK | - | 过牌 |
| CALL | - | 跟注 |
| RAISE | 金额 | 加注 |
| ALL_IN | - | 全押 |

**响应**：

```json
{
  "success": true,
  "data": {
    "roomId": "uuid",
    "gameState": {
      "status": "PREFLOP",
      "currentPlayerSeat": 1,
      "pot": 130
    },
    "nextPlayerId": "uuid",
    "chipChange": {
      "playerId": "uuid",
      "deducted": 100,
      "addedToPot": 100,
      "newBalance": 9900
    }
  }
}
```

---

### 获取游戏状态

```
GET /games/:id
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "game-uuid",
    "status": "PREFLOP",
    "round": "PREFLOP",
    "communityCards": [],
    "players": [
      {
        "userId": "uuid",
        "seatNumber": 0,
        "chips": 1000,
        "isFolded": false,
        "isAllIn": false
      }
    ],
    "pot": 30,
    "currentPlayerSeat": 1
  }
}
```

---

## 用户 API

### 获取当前用户

```
GET /users/me
```

**响应**：

```json
{
  "success": true,
  "data": {
    "id": "uuid",
    "username": "alice",
    "email": "alice@example.com",
    "balance": 10000,
    "stats": {
      "totalGames": 50,
      "totalWins": 20,
      "winRate": 0.4
    }
  }
}
```

---

### 更新用户信息

```
PATCH /users/me
```

**请求体**：

```json
{
  "username": "new-alice",
  "avatarUrl": "https://example.com/avatar.jpg"
}
```

---

## WebSocket API

### 连接

```javascript
const socket = io('http://localhost:3000', {
  auth: {
    token: 'access_token'
  }
});
```

### 事件

#### 加入房间

```javascript
socket.emit('room:join', { roomId: 'uuid' });
```

#### 离开房间

```javascript
socket.emit('room:leave', { roomId: 'uuid' });
```

#### 房间状态更新

```javascript
socket.on('room:update', (data) => {
  // { roomId, members, status }
});
```

#### 游戏动作

```javascript
// 客户端发送
socket.emit('game:action', {
  gameId: 'uuid',
  action: 'RAISE',
  amount: 100
});

// 服务器响应
socket.on('game:action:result', (data) => {
  // { success, gameState, nextPlayerId }
});
```

#### 游戏状态更新

```javascript
socket.on('game:state', (data) => {
  // { gameId, state }
});
```

#### 错误

```javascript
socket.on('error', (error) => {
  // { code, message }
});
```

---

## 错误码

### 认证错误 (1xxx)

| 错误码 | HTTP状态 | 说明 |
|--------|---------|------|
| INVALID_CREDENTIALS | 401 | 邮箱或密码错误 |
| ACCOUNT_LOCKED | 423 | 账号被锁定 |
| TOKEN_EXPIRED | 401 | Token 已过期 |
| INVALID_TOKEN | 401 | Token 无效 |
| RATE_LIMITED | 429 | 请求过于频繁 |

### 房间错误 (2xxx)

| 错误码 | HTTP状态 | 说明 |
|--------|---------|------|
| ROOM_NOT_FOUND | 404 | 房间不存在 |
| ROOM_FULL | 400 | 房间已满 |
| ROOM_STARTED | 400 | 游戏已开始 |
| INVALID_PASSWORD | 403 | 房间密码错误 |

### 游戏错误 (3xxx)

| 错误码 | HTTP状态 | 说明 |
|--------|---------|------|
| GAME_NOT_FOUND | 404 | 游戏不存在 |
| NOT_YOUR_TURN | 400 | 还没轮到你 |
| INVALID_ACTION | 400 | 动作不合法 |
| INSUFFICIENT_CHIPS | 400 | 筹码不足 |
| GAME_ENDED | 400 | 游戏已结束 |

### 服务器错误 (5xxx)

| 错误码 | HTTP状态 | 说明 |
|--------|---------|------|
| INTERNAL_ERROR | 500 | 服务器内部错误 |
| SERVICE_UNAVAILABLE | 503 | 服务暂不可用 |

---

**最后更新**: 2026-04-02
