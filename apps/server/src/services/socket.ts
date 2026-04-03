/**
 * Socket.io 服务
 * @module services/socket
 * @description Socket.io 实时通信处理，支持多实例部署
 * 
 * 多实例支持说明：
 * - 使用 Redis 作为 pub/sub 适配器（已在 server.ts 配置）
 * - 用户 socket 映射存储在 Redis 中（支持跨实例查找）
 * - 断线玩家信息存储在 Redis 中（支持跨实例重连检测）
 * - 操作超时使用 Redis keys with TTL
 */

import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ClientEvents, ServerEvents, PlayerAction } from '@poker/shared';

const prisma = new PrismaClient();
import { logger } from '../utils/logger';
import { escapeHtml } from '../utils/serialize';
import { GameService } from './game';
import { auditService } from './audit';

const gameService = new GameService();

// Redis 客户端（用于跨实例共享状态）
let redisClient: any = null;

async function getRedisClient() {
  if (!redisClient && process.env.REDIS_URL) {
    try {
      const { createClient } = require('redis');
      const url = process.env.REDIS_URL;
      redisClient = createClient({ url });
      await redisClient.connect();
      logger.info('Socket service: Redis connected for shared state');
    } catch (error) {
      logger.warn({ error }, 'Socket service: Redis not available, using in-memory fallback');
    }
  }
  return redisClient;
}

// 本地 socket 映射（用于当前实例）
const localUserSockets = new Map<string, Set<string>>();

// 连接限流：每个IP最大连接数
const connectionLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_CONNECTIONS_PER_IP = 10;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// 本地操作超时（每个实例独立管理）
const playerActionTimeouts = new Map<string, Map<string, NodeJS.Timeout>>();

// 初始化 Redis 客户端
getRedisClient();

/**
 * 获取用户的所有 socket ID（跨实例）
 */
async function getUserSocketIds(userId: string): Promise<string[]> {
  const redis = await getRedisClient();
  
  if (redis) {
    try {
      const socketIds = await redis.sMembers(`user_sockets:${userId}`);
      return socketIds || [];
    } catch (error) {
      logger.warn({ error, userId }, 'Redis error getting user sockets, using local fallback');
    }
  }
  
  // 回退到本地映射
  const socketSet = localUserSockets.get(userId);
  return socketSet ? Array.from(socketSet) : [];
}

/**
 * 添加用户 socket 映射
 */
async function addUserSocket(userId: string, socketId: string): Promise<void> {
  // 本地映射
  if (!localUserSockets.has(userId)) {
    localUserSockets.set(userId, new Set());
  }
  localUserSockets.get(userId)!.add(socketId);
  
  // Redis 映射（跨实例共享）
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.sAdd(`user_sockets:${userId}`, socketId);
      await redis.expire(`user_sockets:${userId}`, 86400); // 24小时过期
    } catch (error) {
      logger.warn({ error, userId, socketId }, 'Redis error adding user socket');
    }
  }
}

/**
 * 移除用户 socket 映射
 */
async function removeUserSocket(userId: string, socketId: string): Promise<void> {
  // 本地映射
  const socketSet = localUserSockets.get(userId);
  if (socketSet) {
    socketSet.delete(socketId);
    if (socketSet.size === 0) {
      localUserSockets.delete(userId);
    }
  }
  
  // Redis 映射
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.sRem(`user_sockets:${userId}`, socketId);
    } catch (error) {
      logger.warn({ error, userId, socketId }, 'Redis error removing user socket');
    }
  }
}

/**
 * 向用户的第一个可用 socket 发送消息（用于通知类消息）
 */
async function emitToUserSocket(io: Server, userId: string, event: string, data: any): Promise<void> {
  const socketIds = await getUserSocketIds(userId);
  
  if (socketIds.length > 0) {
    // 只向第一个活跃 socket 发送（游戏中每个用户只用一个设备）
    // Socket.io 会自动处理跨实例消息（通过 Redis adapter）
    io.to(socketIds[0]).emit(event, data);
    
    // 如果有 Redis，记录发送历史用于调试
    const redis = await getRedisClient();
    if (redis) {
      await redis.lPush(`user_events:${userId}`, JSON.stringify({ event, data, ts: Date.now() }));
      await redis.lTrim(`user_events:${userId}`, 0, 99); // 只保留最近100条
    }
  } else {
    logger.debug({ userId, event }, 'No socket found for user');
  }
}

/**
 * 设置玩家操作超时
 */
async function setPlayerActionTimeout(
  io: Server,
  gameId: string,
  roomId: string,
  playerId: string,
  timeoutSeconds: number
): Promise<void> {
  // 清除之前的超时
  clearPlayerActionTimeout(gameId, playerId);
  
  const timer = setTimeout(async () => {
    try {
      const gameState = gameService.getGameState(gameId);
      if (!gameState) return;
      
      // 执行自动弃牌
      const result = await gameService.processAction(gameId, playerId, PlayerAction.FOLD);
      
      // 广播动作（使用 Redis adapter 确保跨实例）
      io.to(roomId).emit(ServerEvents.PLAYER_ACTION, {
        userId: playerId,
        username: 'System',
        action: PlayerAction.FOLD,
        amount: 0,
        autoAction: true
      });

      // 广播更新后的状态
      await broadcastFilteredGameState(io, roomId, gameId, result.gameState);
      
      // 通知下一位玩家
      if (result.nextPlayerId) {
        await emitToUserSocket(io, result.nextPlayerId, ServerEvents.YOUR_TURN, {
          gameId,
          timeout: 30
        });
        await setPlayerActionTimeout(io, gameId, roomId, result.nextPlayerId, 30);
      }
      
      logger.info({ gameId, playerId }, 'Player auto-folded due to timeout');
    } catch (error) {
      logger.error({ gameId, playerId, error }, 'Error in auto-fold timeout');
    }
  }, timeoutSeconds * 1000);
  
  // 存储定时器（本地）
  if (!playerActionTimeouts.has(gameId)) {
    playerActionTimeouts.set(gameId, new Map());
  }
  playerActionTimeouts.get(gameId)!.set(playerId, timer);
  
  // 同时存储到 Redis（用于多实例协调）
  const redis = await getRedisClient();
  if (redis) {
    try {
      await redis.set(`action_timeout:${gameId}:${playerId}`, Date.now().toString(), {
        EX: timeoutSeconds + 10
      });
    } catch (error) {
      logger.warn({ error, gameId, playerId }, 'Redis error storing action timeout');
    }
  }
}

/**
 * 清除玩家操作超时
 */
function clearPlayerActionTimeout(gameId: string, playerId: string): void {
  const gameTimeouts = playerActionTimeouts.get(gameId);
  if (gameTimeouts) {
    const timer = gameTimeouts.get(playerId);
    if (timer) {
      clearTimeout(timer);
      gameTimeouts.delete(playerId);
    }
  }
  
  // 清除 Redis 中的记录
  const redis = getRedisClient() as any;
  if (redis) {
    redis.del(`action_timeout:${gameId}:${playerId}`).catch(() => {});
  }
}

/**
 * 过滤游戏状态，只向指定玩家暴露允许看到的信息
 */
function filterGameStateForPlayer(state: any, targetUserId: string): any {
  if (!state) return null;

  const filteredPlayers = state.players?.map((player: any) => {
    if (player.userId === targetUserId) {
      return { ...player, holeCards: player.holeCards };
    }
    return { ...player, holeCards: undefined };
  }) || [];

  return { ...state, players: filteredPlayers };
}

/**
 * 向房间内所有玩家广播过滤后的游戏状态
 * 使用 Socket.io 的 Redis Adapter 确保跨实例广播
 */
async function broadcastFilteredGameState(
  io: Server,
  roomId: string,
  gameId: string,
  state: any,
  excludeUserId?: string
): Promise<void> {
  // 使用 Socket.io rooms API 获取房间内所有 socket
  // Redis adapter 会自动处理跨实例
  const sockets = await io.in(roomId).fetchSockets();
  
  for (const socket of sockets) {
    const socketAny = socket as any;
    const socketUserId = socketAny.userId || socket.data?.userId;
    
    if (excludeUserId && socketUserId === excludeUserId) {
      continue;
    }
    
    if (!socketUserId) continue;
    
    const filteredState = filterGameStateForPlayer(state, socketUserId);
    socket.emit(ServerEvents.GAME_STATE_UPDATE, { gameId, state: filteredState });
  }
}

function checkConnectionLimit(ip: string): boolean {
  const now = Date.now();
  const limit = connectionLimits.get(ip);
  
  if (!limit || now > limit.resetAt) {
    connectionLimits.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return true;
  }
  
  if (limit.count >= MAX_CONNECTIONS_PER_IP) {
    return false;
  }
  
  limit.count++;
  return true;
}

interface AuthenticatedSocket extends Socket {
  userId?: string;
  username?: string;
}

export function setupSocketHandlers(io: Server): void {
  // 中间件：连接限流
  io.use((socket: AuthenticatedSocket, next) => {
    const ip = socket.handshake.address || 'unknown';
    if (!checkConnectionLimit(ip)) {
      logger.warn({ ip }, 'Connection rate limit exceeded');
      return next(new Error('Connection rate limit exceeded'));
    }
    next();
  });

  // 中间件：认证
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token as string;
      
      if (!token) {
        return next(new Error('Authentication error: Token required'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
      socket.userId = decoded.userId;
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.username = user.username;
      
      // 添加到用户 socket 映射（支持多设备）
      await addUserSocket(user.id, socket.id);
      
      // 检查 Redis 中是否有断线记录
      const redis = await getRedisClient();
      if (redis) {
        const disconnectedKey = `disconnected:${user.id}`;
        const disconnected = await redis.get(disconnectedKey);
        
        if (disconnected) {
          const data = JSON.parse(disconnected);
          // 清除断线记录
          await redis.del(disconnectedKey);
          logger.info({ userId: user.id, previousRoom: data.roomId }, 'User reconnected within timeout window');
          
          // 广播重连成功
          if (data.roomId) {
            io.to(data.roomId).emit('player_reconnected', {
              userId: user.id
            });
          }
        }
      }
      
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  io.on('connection', (socket: AuthenticatedSocket) => {
    logger.info({
      socketId: socket.id,
      userId: socket.userId,
      username: socket.username
    }, 'User connected');

    socket.emit(ServerEvents.AUTH_SUCCESS, {
      userId: socket.userId,
      username: socket.username
    });

    // 创建房间
    socket.on(ClientEvents.CREATE_ROOM, async (data) => {
      try {
        if (!socket.userId) return;
        
        const room = await gameService.createRoom(socket.userId, data);
        socket.join(room.id);
        
        socket.emit(ServerEvents.ROOM_CREATED, { room });
      } catch (error: any) {
        socket.emit(ServerEvents.ERROR, {
          code: 'CREATE_ROOM_ERROR',
          message: error.message
        });
      }
    });

    // 加入房间
    socket.on(ClientEvents.JOIN_ROOM, async (data) => {
      try {
        if (!socket.userId || !socket.username) return;
        
        const { roomCode } = data;
        const result = await gameService.joinRoom(roomCode, socket.userId, socket.username, socket);
        
        socket.join(result.roomId);
        
        socket.emit(ServerEvents.ROOM_JOINED, result);
        
        socket.to(result.roomId).emit(ServerEvents.PLAYER_JOINED, {
          userId: socket.userId,
          username: socket.username,
          seatNumber: result.seatNumber
        });
      } catch (error: any) {
        socket.emit(ServerEvents.ERROR, {
          code: 'JOIN_ROOM_ERROR',
          message: error.message
        });
      }
    });

    // 准备游戏
    socket.on(ClientEvents.READY, async (data) => {
      try {
        if (!socket.userId) return;
        
        const { roomId } = data;
        const result = await gameService.playerReady(roomId, socket.userId);
        
        io.to(roomId).emit('player_ready', {
          userId: socket.userId,
          isReady: true
        });

        if (result.canStart) {
          io.to(roomId).emit('game_starting', { countdown: 5 });
          
          setTimeout(async () => {
            const game = await gameService.startGame(roomId);
            await broadcastFilteredGameState(io, roomId, game.id, game.state);
            io.to(roomId).emit(ServerEvents.GAME_STARTED, { gameId: game.id });
          }, 5000);
        }
      } catch (error: any) {
        socket.emit(ServerEvents.ERROR, {
          code: 'READY_ERROR',
          message: error.message
        });
      }
    });

    // 玩家动作
    socket.on(ClientEvents.PLAYER_ACTION, async (data) => {
      try {
        if (!socket.userId) return;
        
        const { gameId, action, amount } = data;
        
        clearPlayerActionTimeout(gameId, socket.userId);
        
        const result = await gameService.processAction(gameId, socket.userId, action, amount);
        
        await auditService.logGameAction(
          { userId: socket.userId, ipAddress: socket.handshake.address },
          gameId,
          socket.userId,
          action,
          amount
        );
        
        io.to(result.roomId).emit(ServerEvents.PLAYER_ACTION, {
          userId: socket.userId,
          username: socket.username,
          action,
          amount
        });

        await broadcastFilteredGameState(
          io,
          result.roomId,
          gameId,
          result.gameState,
          socket.userId
        );

        if (result.nextPlayerId) {
          await emitToUserSocket(io, result.nextPlayerId, ServerEvents.YOUR_TURN, {
            gameId,
            timeout: 30
          });
          setPlayerActionTimeout(io, gameId, result.roomId, result.nextPlayerId, 30);
        }
      } catch (error: any) {
        socket.emit(ServerEvents.ERROR, {
          code: 'ACTION_ERROR',
          message: error.message
        });
      }
    });

    // 聊天消息
    socket.on(ClientEvents.SEND_MESSAGE, async (data) => {
      try {
        if (!socket.userId || !socket.username) return;
        
        const { roomId, message } = data;
        const safeMessage = escapeHtml(message).slice(0, 500);
        
        await prisma.chatMessage.create({
          data: {
            roomId,
            userId: socket.userId,
            message: safeMessage
          }
        });

        io.to(roomId).emit(ServerEvents.CHAT_MESSAGE, {
          userId: socket.userId,
          username: socket.username,
          message: safeMessage,
          timestamp: new Date().toISOString()
        });
      } catch (error: any) {
        socket.emit(ServerEvents.ERROR, {
          code: 'CHAT_ERROR',
          message: error.message
        });
      }
    });

    // 离开房间
    socket.on(ClientEvents.LEAVE_ROOM, async (data) => {
      try {
        if (!socket.userId) return;
        
        const { roomId } = data;
        await gameService.leaveRoom(roomId, socket.userId);
        
        socket.leave(roomId);
        
        io.to(roomId).emit(ServerEvents.PLAYER_LEFT, {
          userId: socket.userId,
          reason: 'left'
        });
      } catch (error: any) {
        logger.error({ error: error.message }, 'Leave room error');
      }
    });

    // 断开连接
    socket.on('disconnect', async () => {
      logger.info({ socketId: socket.id, userId: socket.userId }, 'User disconnected');

      if (!socket.userId) return;

      await removeUserSocket(socket.userId, socket.id);

      // 检查是否还有其他活跃连接
      const remainingSockets = await getUserSocketIds(socket.userId);
      if (remainingSockets.length > 0) {
        logger.info({ 
          userId: socket.userId, 
          remainingConnections: remainingSockets.length 
        }, 'User has other active connections');
        return;
      }

      // 查找当前房间
      let roomId: string | undefined;
      let gameId: string | undefined;
      
      // 尝试从 Redis 获取断线信息
      const redis = await getRedisClient();
      if (redis) {
        // 查找用户所在的房间
        const roomKeys = await redis.keys(`room:*:players`);
        for (const key of roomKeys) {
          const isMember = await redis.sIsMember(key, socket.userId);
          if (isMember) {
            roomId = key.split(':')[1];
            const state = gameService.getGameState(roomId);
            if (state) gameId = state.id;
            break;
          }
        }
      }

      // 设置断线超时（使用 Redis 确保跨实例）
      if (redis && roomId) {
        await redis.set(`disconnected:${socket.userId}`, JSON.stringify({
          socketId: socket.id,
          roomId,
          gameId,
          disconnectTime: Date.now()
        }), { EX: 60 }); // 60秒过期
        
        // 广播断线（给其他实例处理的机会）
        io.to(roomId).emit('player_disconnected', {
          userId: socket.userId,
          reason: 'disconnect'
        });
        
        // 设置60秒后检查，如果仍未重连则自动处理
        setTimeout(async () => {
          const stillDisconnected = await redis.get(`disconnected:${socket.userId}`);
          if (stillDisconnected) {
            const data = JSON.parse(stillDisconnected);
            
            if (roomId && gameId) {
              try {
                const gameState = gameService.getGameState(gameId);
                if (gameState) {
                  const playerInGame = gameState.players?.some(
                    (p: any) => p.userId === socket.userId
                  );
                  
                  if (playerInGame) {
                    const result = await gameService.processAction(gameId, socket.userId!, PlayerAction.FOLD);
                    
                    io.to(roomId).emit(ServerEvents.PLAYER_ACTION, {
                      userId: socket.userId,
                      username: 'System',
                      action: PlayerAction.FOLD,
                      amount: 0,
                      autoAction: true
                    });
                    
                    await broadcastFilteredGameState(io, roomId, gameId, result.gameState);
                    
                    if (result.nextPlayerId) {
                      await emitToUserSocket(io, result.nextPlayerId, ServerEvents.YOUR_TURN, {
                        gameId,
                        timeout: 30
                      });
                      setPlayerActionTimeout(io, gameId, roomId, result.nextPlayerId, 30);
                    }
                  }
                }
              } catch (error) {
                logger.error({ userId: socket.userId, gameId, error }, 'Auto-fold error');
              }
            }
            
            io.to(roomId).emit(ServerEvents.PLAYER_LEFT, {
              userId: socket.userId,
              reason: 'timeout'
            });
          }
        }, 60000);
      }
    });
  });
}
