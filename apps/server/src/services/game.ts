/**
 * 游戏服务
 * @module services/game
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 * @description 处理游戏逻辑的高层服务
 */

import { PrismaClient, GameStatus, GameRound, PlayerAction, SnapshotType } from '@prisma/client';
import type { Socket } from 'socket.io';
import { GameEngine, GamePlayer } from '@poker/engine';
import { generateRoomCode } from '@poker/shared';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// 内存中存储活跃的游戏实例
const activeGames = new Map<string, GameEngine>();

// 快照保存定时器
let snapshotInterval: NodeJS.Timeout | null = null;
const SNAPSHOT_INTERVAL_MS = 30 * 1000; // 每30秒保存一次快照

// 快照校验用密钥（生产环境应从环境变量读取）
const SNAPSHOT_SECRET = process.env.SNAPSHOT_SECRET || 'dev-only-snapshot-secret';

/**
 * 计算快照校验和
 */
function computeChecksum(data: string): string {
  const { createHmac } = require('crypto');
  return createHmac('sha256', SNAPSHOT_SECRET).update(data).digest('hex');
}

interface CreateRoomData {
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  isPrivate?: boolean;
  password?: string;
}

export class GameService {
  /**
   * 创建房间
   */
  async createRoom(userId: string, data: CreateRoomData) {
    const code = generateRoomCode();

    const room = await prisma.room.create({
      data: {
        code,
        name: data.name,
        maxPlayers: data.maxPlayers,
        smallBlind: data.smallBlind,
        bigBlind: data.bigBlind,
        minBuyIn: data.minBuyIn,
        maxBuyIn: data.maxBuyIn,
        isPrivate: data.isPrivate || false,
        members: {
          create: {
            userId,
            seatNumber: 0,
            isHost: true,
            isReady: false,
            buyInAmount: data.minBuyIn
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true, avatarUrl: true }
            }
          }
        }
      }
    });

    return room;
  }

  /**
   * 加入房间
   * @param roomCode 房间代码
   * @param userId 用户ID
   * @param username 用户名
   * @param socket Socket连接
   * @param password 房间密码（私房需要）
   */
  async joinRoom(roomCode: string, userId: string, username: string, socket: Socket, password?: string) {
    const room = await prisma.room.findUnique({
      where: { code: roomCode },
      include: { members: true }
    });

    if (!room) {
      throw new Error('Room not found');
    }

    if (room.status !== 'WAITING') {
      throw new Error('Game already started');
    }

    if (room.members.length >= room.maxPlayers) {
      throw new Error('Room is full');
    }

    // 验证私房密码
    if (room.passwordHash) {
      if (!password) {
        throw new Error('Password required for private room');
      }
      const bcrypt = require('bcryptjs');
      const isValid = await bcrypt.compare(password, room.passwordHash);
      if (!isValid) {
        throw new Error('Invalid password');
      }
    }

    // 检查是否已在房间
    const existingMember = room.members.find(m => m.userId === userId);
    if (existingMember) {
      return {
        roomId: room.id,
        seatNumber: existingMember.seatNumber,
        members: room.members
      };
    }

    // 查找空座位
    const occupiedSeats = new Set(room.members.map(m => m.seatNumber));
    let seatNumber = 0;
    while (occupiedSeats.has(seatNumber)) {
      seatNumber++;
    }

    await prisma.roomMember.create({
      data: {
        roomId: room.id,
        userId,
        seatNumber,
        buyInAmount: room.minBuyIn
      }
    });

    return {
      roomId: room.id,
      seatNumber,
      members: [...room.members, { userId, seatNumber }]
    };
  }

  /**
   * 玩家准备
   */
  async playerReady(roomId: string, userId: string) {
    // 使用事务确保原子性：更新状态并检查是否所有人都准备好了
    const result = await prisma.$transaction(async (tx) => {
      // 更新准备状态
      await tx.roomMember.update({
        where: {
          roomId_userId: { roomId, userId }
        },
        data: { isReady: true }
      });

      // 检查是否所有玩家都准备好
      const members = await tx.roomMember.findMany({
        where: { roomId }
      });

      const allReady = members.length >= 2 && members.every(m => m.isReady);

      return { canStart: allReady, memberCount: members.length };
    });

    return result;
  }

  /**
   * 开始游戏
   */
  async startGame(roomId: string) {
    const room = await prisma.room.findUnique({
      where: { id: roomId },
      include: {
        members: {
          include: {
            user: {
              select: { id: true, username: true }
            }
          }
        }
      }
    });

    if (!room) {
      throw new Error('Room not found');
    }

    // 创建游戏记录并更新房间状态（使用事务保证原子性）
    const game = await prisma.$transaction(async (tx) => {
      // 创建游戏记录
      const newGame = await tx.game.create({
        data: {
          roomId,
          status: GameStatus.PREFLOP,
          round: GameRound.PREFLOP,
          dealerSeat: 0,
          smallBlindSeat: 1,
          bigBlindSeat: 2,
          mainPot: 0
        }
      });

      // 更新房间状态
      await tx.room.update({
        where: { id: roomId },
        data: { status: 'PLAYING' }
      });

      return newGame;
    });

    // 创建游戏引擎实例
    const gameEngine = new GameEngine(game.id, roomId, {
      maxPlayers: room.maxPlayers,
      minPlayers: 2,
      smallBlind: room.smallBlind,
      bigBlind: room.bigBlind,
      minBuyIn: room.minBuyIn,
      maxBuyIn: room.maxBuyIn,
      timeLimit: 30
    });

    // 添加玩家
    for (const member of room.members) {
      gameEngine.addPlayer(
        member.userId,
        member.user.username,
        member.seatNumber,
        member.buyInAmount
      );
    }

    // 开始游戏
    gameEngine.start(0); // 从座位0开始作为庄家

    // 保存游戏实例
    activeGames.set(game.id, gameEngine);

    return {
      id: game.id,
      state: gameEngine.getState()
    };
  }

  /**
   * 处理玩家动作
   * 筹码变动在数据库事务中完成，确保原子性
   * 
   * 注意：processAction 现在是 async 方法，使用 Mutex 确保线程安全
   */
  async processAction(
    gameId: string,
    userId: string,
    action: PlayerAction,
    amount?: number
  ) {
    const gameEngine = activeGames.get(gameId);
    if (!gameEngine) {
      throw new Error('GAME_NOT_FOUND');
    }

    // 获取当前状态（用于获取游戏轮次信息）
    const currentState = gameEngine.getState();
    const gameRound = currentState.round?.toUpperCase() as GameRound;

    // 保存状态快照，用于事务失败时回滚
    gameEngine.saveSnapshotForRollback();

    // 执行游戏逻辑，获取筹码变动明细
    // 注意：processAction 现在是 async 方法（使用 Mutex）
    const result = await gameEngine.processAction(userId, action as any, amount);
    const { chipChange } = result;

    try {
      // 在事务中处理所有数据库操作
      await prisma.$transaction(async (tx) => {
        // 1. 验证并扣减玩家余额
        if (chipChange.deducted > 0) {
          // 使用乐观锁更新玩家余额
          const updated = await tx.user.updateMany({
            where: {
              id: userId,
              balance: {
                gte: BigInt(chipChange.deducted)
              }
            },
            data: {
              balance: {
                decrement: BigInt(chipChange.deducted)
              }
            }
          });

          if (updated.count === 0) {
            throw new Error('INSUFFICIENT_BALANCE');
          }
        }

        // 2. 记录筹码变动日志
        if (chipChange.deducted > 0) {
          await tx.transaction.create({
            data: {
              userId,
              type: 'GAME_LOSS' as any, // 下注暂时记为损失
              amount: BigInt(chipChange.deducted),
              balanceAfter: BigInt(chipChange.newBalance),
              description: `Game ${gameId}: ${action} ${chipChange.deducted}`
            }
          });
        }

        // 3. 更新游戏底池
        if (chipChange.addedToPot > 0) {
          await tx.game.update({
            where: { id: gameId },
            data: {
              mainPot: {
                increment: BigInt(chipChange.addedToPot)
              }
            }
          });
        }

        // 4. 记录游戏动作
        await tx.gameAction.create({
          data: {
            gameId,
            userId,
            actionType: action,
            amount: amount ? BigInt(amount) : null,
            round: gameRound
          }
        });
      });
    } catch (error) {
      // 数据库事务失败，回滚 GameEngine 状态
      gameEngine.rollback();
      logger.error({ gameId, error }, 'Database transaction failed, rolled back game state');
      throw error;
    }

    // 检查游戏是否结束
    if (result.newState.status === 'ENDED' || result.newState.status === 'SHOWDOWN') {
      await this.endGame(gameId, result.newState);
    } else {
      // 游戏进行中，保存快照
      await this.saveSnapshot(gameId, 'POST_ACTION');
    }

    return {
      roomId: result.newState.roomId,
      gameState: result.newState,
      nextPlayerId: result.nextPlayerId,
      chipChange
    };
  }

  /**
   * 结束游戏
   */
  private async endGame(gameId: string, state: any) {
    // 使用事务确保游戏状态、筹码分配和获胜者更新的原子性
    await prisma.$transaction(async (tx) => {
      // 更新游戏记录
      await tx.game.update({
        where: { id: gameId },
        data: {
          status: GameStatus.ENDED,
          endedAt: new Date()
        }
      });

      // 分配筹码给获胜者
      if (state.winners) {
        for (const winner of state.winners) {
          // 给赢家发放筹码
          await tx.user.update({
            where: { id: winner.playerId },
            data: {
              balance: {
                increment: BigInt(winner.amount)
              }
            }
          });

          // 记录赢家获得筹码
          const user = await tx.user.findUnique({
            where: { id: winner.playerId },
            select: { balance: true }
          });

          await tx.transaction.create({
            data: {
              userId: winner.playerId,
              type: 'GAME_WIN' as any,
              amount: BigInt(winner.amount),
              balanceAfter: user!.balance,
              description: `Game ${gameId} win: ${winner.handDescription}`
            }
          });

          // 更新获胜者信息
          await tx.gamePlayer.updateMany({
            where: {
              gameId,
              userId: winner.playerId
            },
            data: {
              isWinner: true,
              winAmount: BigInt(winner.amount)
            }
          });
        }
      }
    });

    // 清理游戏实例
    activeGames.delete(gameId);

    logger.info({ gameId, winners: state.winners }, 'Game ended');
  }

  /**
   * 离开房间
   */
  async leaveRoom(roomId: string, userId: string) {
    // 使用事务确保删除成员和检查房间状态的原子性
    await prisma.$transaction(async (tx) => {
      // 删除成员
      await tx.roomMember.delete({
        where: {
          roomId_userId: { roomId, userId }
        }
      });

      // 检查房间是否空了
      const remainingMembers = await tx.roomMember.count({
        where: { roomId }
      });

      if (remainingMembers === 0) {
        await tx.room.update({
          where: { id: roomId },
          data: { status: 'ENDED', endedAt: new Date() }
        });
      }
    });
  }

  /**
   * 获取游戏状态
   */
  getGameState(gameId: string) {
    const gameEngine = activeGames.get(gameId);
    if (!gameEngine) {
      return null;
    }
    return gameEngine.getState();
  }

  /**
   * 保存游戏快照到数据库
   */
  async saveSnapshot(gameId: string, type: SnapshotType = 'PERIODIC'): Promise<void> {
    const gameEngine = activeGames.get(gameId);
    if (!gameEngine) {
      logger.warn({ gameId }, 'Cannot save snapshot: game not in memory');
      return;
    }

    const state = gameEngine.getState();
    const stateJson = JSON.stringify(state);
    
    // 校验快照大小（最大 1MB）
    const MAX_SNAPSHOT_SIZE = 1024 * 1024; // 1MB
    if (stateJson.length > MAX_SNAPSHOT_SIZE) {
      logger.error({ gameId, size: stateJson.length }, 'Snapshot exceeds maximum size');
      return;
    }
    
    const checksum = computeChecksum(stateJson);
    
    try {
      await prisma.gameSnapshot.upsert({
        where: { gameId_type: { gameId, type } },
        create: {
          gameId,
          state: state as any,
          type,
          checksum
        },
        update: {
          state: state as any,
          type,
          checksum,
          createdAt: new Date()
        }
      });
      
      logger.debug({ gameId, type }, 'Game snapshot saved');
    } catch (error) {
      logger.error({ gameId, error }, 'Failed to save game snapshot');
    }
  }

  /**
   * 从快照恢复游戏
   */
  async recoverGame(gameId: string): Promise<GameEngine | null> {
    const snapshot = await prisma.gameSnapshot.findFirst({
      where: { gameId }
    });

    if (!snapshot) {
      logger.warn({ gameId }, 'No snapshot found for game recovery');
      return null;
    }

    try {
      const stateJson = JSON.stringify(snapshot.state);
      const expectedChecksum = computeChecksum(stateJson);
      
      // 验证快照完整性
      if (snapshot.checksum && snapshot.checksum !== expectedChecksum) {
        logger.error({ gameId }, 'Snapshot checksum mismatch - possible tampering detected');
        return null;
      }
      
      const state = snapshot.state as any;
      
      // 从房间配置获取游戏参数
      const room = await prisma.room.findUnique({
        where: { id: state.roomId },
        include: { members: true }
      });

      if (!room) {
        logger.error({ gameId, roomId: state.roomId }, 'Room not found for game recovery');
        return null;
      }

      // 重新创建游戏引擎实例
      const gameEngine = new GameEngine(gameId, state.roomId, {
        maxPlayers: room.maxPlayers,
        minPlayers: 2,
        smallBlind: room.smallBlind,
        bigBlind: room.bigBlind,
        minBuyIn: room.minBuyIn,
        maxBuyIn: room.maxBuyIn,
        timeLimit: 30
      });

      // 恢复玩家信息
      for (const player of state.players) {
        gameEngine.addPlayer(
          player.userId,
          player.username,
          player.seatNumber,
          player.chips
        );
      }

      // 使用 restoreFromSnapshot 恢复完整状态
      gameEngine.restoreFromSnapshot(state);
      
      // 恢复下注轮次动作历史
      if (state.bettingRound && state.bettingRound.actions) {
        gameEngine.restoreBettingRoundActions(state.bettingRound.actions);
      }

      // 注册到活跃游戏映射
      activeGames.set(gameId, gameEngine);

      logger.info({ gameId, players: state.players.length }, 'Game recovered from snapshot');
      return gameEngine;
    } catch (error) {
      logger.error({ gameId, error }, 'Failed to recover game from snapshot');
      return null;
    }
  }

  /**
   * 启动快照保存定时器
   */
  startSnapshotScheduler(): void {
    if (snapshotInterval) {
      return; // 已启动
    }

    snapshotInterval = setInterval(async () => {
      for (const [gameId] of activeGames) {
        await this.saveSnapshot(gameId, 'PERIODIC');
      }
    }, SNAPSHOT_INTERVAL_MS);

    logger.info({ intervalMs: SNAPSHOT_INTERVAL_MS }, 'Snapshot scheduler started');
  }

  /**
   * 停止快照保存定时器
   */
  stopSnapshotScheduler(): void {
    if (snapshotInterval) {
      clearInterval(snapshotInterval);
      snapshotInterval = null;
      logger.info('Snapshot scheduler stopped');
    }
  }

  /**
   * 服务器关闭前保存所有游戏快照
   */
  async saveAllSnapshots(): Promise<void> {
    logger.info({ count: activeGames.size }, 'Saving snapshots for all active games');
    
    const promises = Array.from(activeGames.keys()).map(gameId => 
      this.saveSnapshot(gameId, 'PRE_SHUTDOWN')
    );
    
    await Promise.all(promises);
    logger.info('All game snapshots saved');
  }

  /**
   * 启动时恢复所有进行中的游戏
   */
  async recoverAllGames(): Promise<number> {
    // 查找所有状态不是 ENDED 的游戏
    const activeDbGames = await prisma.game.findMany({
      where: {
        status: {
          not: 'ENDED'
        }
      }
    });

    let recoveredCount = 0;

    for (const game of activeDbGames) {
      const gameEngine = await this.recoverGame(game.id);
      if (gameEngine) {
        activeGames.set(game.id, gameEngine);
        recoveredCount++;
      }
    }

    logger.info({ 
      activeDbGames: activeDbGames.length, 
      recovered: recoveredCount 
    }, 'Game recovery complete');

    return recoveredCount;
  }
}

// 导出单例
export const gameService = new GameService();
