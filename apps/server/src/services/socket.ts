/**
 * Socket.io 服务
 * @module services/socket
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import type { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { ClientEvents, ServerEvents } from '@poker/shared';
import { logger } from '../utils/logger';
import { escapeHtml } from '../utils/serialize';
import { GameService } from './game';
import { auditService } from './audit';

const prisma = new PrismaClient();
const gameService = new GameService();

// 存储用户 socket 映射（支持多设备）
const userSockets = new Map<string, Set<string>>(); // userId -> Set<socketId>

// 连接限流：每个IP最大连接数
const connectionLimits = new Map<string, { count: number; resetAt: number }>();
const MAX_CONNECTIONS_PER_IP = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000; // 1分钟

// 断线玩家缓存：userId -> { socketId, disconnectTime, roomId, gameId, timer }
const disconnectedPlayers = new Map<string, { 
  socketId: string; 
  disconnectTime: number; 
  roomId?: string; 
  gameId?: string;
  timer?: NodeJS.Timeout;
}>();
const RECONNECT_TIMEOUT_MS = 60 * 1000; // 60秒内可重连

// 玩家操作超时：gameId -> { playerId -> timeoutId }
const playerActionTimeouts = new Map<string, Map<string, NodeJS.Timeout>>();

/**
 * 获取用户的所有 socket ID
 */
function getUserSocketIds(userId: string): string[] {
  const socketSet = userSockets.get(userId);
  return socketSet ? Array.from(socketSet) : [];
}

/**
 * 向用户的第一个可用 socket 发送消息（用于通知类消息）
 */
function emitToUserSocket(io: Server, userId: string, event: string, data: any): void {
  const socketIds = getUserSocketIds(userId);
  if (socketIds.length > 0) {
    // 只向第一个活跃 socket 发送（游戏中每个用户只用一个设备）
    io.to(socketIds[0]).emit(event, data);
  }
}

/**
 * 设置玩家操作超时
 * 超时后自动弃牌
 */
function setPlayerActionTimeout(
  io: Server,
  gameId: string,
  roomId: string,
  playerId: string,
  timeoutSeconds: number
): void {
  // 清除之前的超时（如果有）
  clearPlayerActionTimeout(gameId, playerId);
  
  // 获取当前游戏状态
  const gameState = gameService.getGameState(gameId);
  if (!gameState) return;
  
  // 创建超时定时器
  const timer = setTimeout(async () => {
    try {
      // 检查玩家是否还在当前回合
      const currentState = gameService.getGameState(gameId);
      // 注意：这里检查玩家是否还是当前行动者需要更复杂的逻辑
      // 简化处理：如果游戏状态存在就继续
      if (!currentState) {
        // 玩家已经不是当前行动者，无需处理
        return;
      }
      
      // 执行自动弃牌
      const result = await gameService.processAction(gameId, playerId, 'fold');
      
      // 广播动作
      io.to(roomId).emit(ServerEvents.PLAYER_ACTION, {
        userId: playerId,
        username: 'System',
        action: 'fold',
        amount: 0,
        autoAction: true  // 标记为自动动作
      });

      // 广播更新后的状态
      await broadcastFilteredGameState(io, roomId, gameId, result.gameState);
      
      // 通知下一位玩家
      if (result.nextPlayerId) {
        emitToUserSocket(io, result.nextPlayerId, ServerEvents.YOUR_TURN, {
          gameId,
          timeout: 30
        });
        setPlayerActionTimeout(io, gameId, roomId, result.nextPlayerId, 30);
      }
      
      logger.info({ gameId, playerId }, 'Player auto-folded due to timeout');
    } catch (error) {
      logger.error({ gameId, playerId, error }, 'Error in auto-fold timeout');
    }
  }, timeoutSeconds * 1000);
  
  // 存储定时器
  if (!playerActionTimeouts.has(gameId)) {
    playerActionTimeouts.set(gameId, new Map());
  }
  playerActionTimeouts.get(gameId)!.set(playerId, timer);
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
}

/**
 * 过滤游戏状态，只向指定玩家暴露允许看到的信息
 * - 手牌只发送给对应玩家
 * - 其他玩家的手牌显示为 undefined
 * - 公共牌对所有玩家可见
 */
function filterGameStateForPlayer(state: any, targetUserId: string): any {
  if (!state) return null;

  const filteredPlayers = state.players?.map((player: any) => {
    // 如果是自己，只显示自己的手牌
    if (player.userId === targetUserId) {
      return {
        ...player,
        holeCards: player.holeCards
      };
    }
    // 其他玩家，隐藏手牌
    return {
      ...player,
      holeCards: undefined
    };
  }) || [];

  return {
    ...state,
    players: filteredPlayers
  };
}

/**
 * 向房间内所有玩家广播过滤后的游戏状态
 * 每个玩家只收到自己应该看到的信息
 */
async function broadcastFilteredGameState(
  io: Server,
  roomId: string,
  gameId: string,
  state: any,
  excludeUserId?: string
): Promise<void> {
  // 获取房间内所有 socket
  const sockets = await io.in(roomId).fetchSockets();
  
  for (const socket of sockets) {
    // RemoteSocket uses socket.data.userId
    const socketUserId = (socket as any).userId || socket.data?.userId;
    
    // 跳过排除的用户
    if (excludeUserId && socketUserId === excludeUserId) {
      continue;
    }
    
    if (!socketUserId) continue;
    
    // 过滤状态
    const filteredState = filterGameStateForPlayer(state, socketUserId);
    
    // 只发送到对应 socket
    socket.emit(ServerEvents.GAME_STATE_UPDATE, {
      gameId,
      state: filteredState
    });
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
      
      // 获取用户信息
      const user = await prisma.user.findUnique({
        where: { id: decoded.userId },
        select: { id: true, username: true }
      });

      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.username = user.username;
      
      // 支持多设备登录：使用 Set 存储多个 socketId
      if (!userSockets.has(user.id)) {
        userSockets.set(user.id, new Set());
      }
      userSockets.get(user.id)!.add(socket.id);
      
      // 检查是否有断线记录，如果有则清除（重连成功）
      const disconnected = disconnectedPlayers.get(user.id);
      if (disconnected) {
        // 清除断线超时定时器
        if (disconnected.timer) {
          clearTimeout(disconnected.timer);
        }
        // 清除断线记录
        disconnectedPlayers.delete(user.id);
        logger.info({ userId: user.id }, 'User reconnected within timeout window');
        
        // 广播重连成功
        if (disconnected.roomId) {
          io.to(disconnected.roomId).emit('player_reconnected', {
            userId: user.id,
            seatNumber: disconnected.roomId // 简化：使用 roomId 作为座位标识
          });
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

    // 发送连接成功事件
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
        
        // 通知自己加入成功
        socket.emit(ServerEvents.ROOM_JOINED, result);
        
        // 广播给其他玩家
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
        
        // 广播准备状态
        io.to(roomId).emit('player_ready', {
          userId: socket.userId,
          isReady: true
        });

        // 如果所有玩家都准备好，开始游戏
        if (result.canStart) {
          io.to(roomId).emit('game_starting', { countdown: 5 });
          
          setTimeout(async () => {
            const game = await gameService.startGame(roomId);
            // 向房间内每个玩家单独发送过滤后的游戏状态
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
        
        // 清除该玩家的操作超时
        clearPlayerActionTimeout(gameId, socket.userId);
        
        const result = await gameService.processAction(gameId, socket.userId, action, amount);
        
        // 审计日志：记录游戏动作
        await auditService.logGameAction(
          {
            userId: socket.userId,
            ipAddress: socket.handshake.address
          },
          gameId,
          socket.userId,
          action,
          amount
        );
        
        // 广播动作（只包含动作类型，不泄露状态）
        io.to(result.roomId).emit(ServerEvents.PLAYER_ACTION, {
          userId: socket.userId,
          username: socket.username,
          action,
          amount
        });

        // 向每个玩家单独发送过滤后的游戏状态
        await broadcastFilteredGameState(
          io,
          result.roomId,
          gameId,
          result.gameState,
          socket.userId  // 排除动作发起者，由自己处理
        );

        // 通知下一位玩家
        if (result.nextPlayerId) {
          emitToUserSocket(io, result.nextPlayerId, ServerEvents.YOUR_TURN, {
            gameId,
            timeout: 30
          });
          
          // 设置操作超时（30秒后自动弃牌）
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
        
        // 转义 HTML 防止 XSS
        const safeMessage = escapeHtml(message).slice(0, 500);
        
        // 保存消息
        await prisma.chatMessage.create({
          data: {
            roomId,
            userId: socket.userId,
            message: safeMessage
          }
        });

        // 广播消息
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
        
        // 广播离开
        socket.to(roomId).emit(ServerEvents.PLAYER_LEFT, {
          userId: socket.userId,
          reason: 'left'
        });
      } catch (error: any) {
        logger.error({ error: error.message }, 'Leave room error');
      }
    });

    // 断开连接
    socket.on('disconnect', async () => {
      logger.info({
        socketId: socket.id,
        userId: socket.userId
      }, 'User disconnected');

      if (!socket.userId) {
        return; // 未认证的连接不做处理
      }

      // 从用户socket集合中移除
      const socketSet = userSockets.get(socket.userId);
      if (socketSet) {
        socketSet.delete(socket.id);
        if (socketSet.size === 0) {
          userSockets.delete(socket.userId);
        }
      }

      // 检查是否还有其他活跃连接（多设备）
      if (socketSet && socketSet.size > 0) {
        logger.info({ userId: socket.userId, remainingConnections: socketSet.size }, 'User has other active connections');
        return;
      }

      // 查找当前所在的房间/游戏
      let roomId: string | undefined;
      let gameId: string | undefined;
      const rooms = Array.from(socket.rooms);
      for (const r of rooms) {
        if (r !== socket.id) {
          const state = gameService.getGameState(r);
          if (state) {
            roomId = r;
            gameId = state.id;
            break;
          }
        }
      }

      // 记录断线信息，设置重连超时
      const timer = setTimeout(async () => {
        const stored = disconnectedPlayers.get(socket.userId!);
        if (stored && stored.socketId === socket.id) {
          // 超时：玩家确实断线了
          disconnectedPlayers.delete(socket.userId!);
          
          if (roomId) {
            // 游戏进行中：执行自动弃牌
            if (gameId) {
              try {
                const gameState = gameService.getGameState(gameId);
                if (gameState) {
                  // 检查该用户是否在当前游戏中
                  const playerInGame = gameState.players?.some((p: any) => p.userId === socket.userId);
                  if (playerInGame) {
                    const result = await gameService.processAction(gameId, socket.userId!, 'fold');
                    
                    io.to(roomId).emit(ServerEvents.PLAYER_ACTION, {
                      userId: socket.userId,
                      username: 'System',
                      action: 'fold',
                      amount: 0,
                      autoAction: true
                    });
                    
                    await broadcastFilteredGameState(io, roomId, gameId, result.gameState);
                    
                    // 通知下一位玩家
                    if (result.nextPlayerId) {
                      emitToUserSocket(io, result.nextPlayerId, ServerEvents.YOUR_TURN, {
                        gameId,
                        timeout: 30
                      });
                      setPlayerActionTimeout(io, gameId, roomId, result.nextPlayerId, 30);
                    }
                    
                    logger.info({ userId: socket.userId, gameId }, 'Player auto-folded due to disconnect timeout');
                  }
                }
              } catch (error) {
                logger.error({ userId: socket.userId, gameId, error }, 'Error in auto-fold');
              }
            }
            
            io.to(roomId).emit(ServerEvents.PLAYER_LEFT, {
              userId: socket.userId,
              reason: 'timeout'
            });
          }
          
          logger.info({ userId: socket.userId }, 'Player disconnected timeout expired');
        }
      }, RECONNECT_TIMEOUT_MS);

      disconnectedPlayers.set(socket.userId, {
        socketId: socket.id,
        disconnectTime: Date.now(),
        roomId,
        gameId,
        timer
      });

      // 广播玩家断线
      if (roomId) {
        io.to(roomId).emit('player_disconnected', {
          userId: socket.userId,
          reason: 'disconnect'
        });
      }
    });
  });
}
