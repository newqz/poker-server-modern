/**
 * 房间路由
 * @module routes/room
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { generateRoomCode } from '@poker/shared';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// 创建房间请求体验证
const createRoomSchema = z.object({
  name: z.string().min(1).max(64),
  maxPlayers: z.number().int().min(2).max(10).default(9),
  smallBlind: z.number().int().positive(),
  bigBlind: z.number().int().positive(),
  minBuyIn: z.number().int().positive(),
  maxBuyIn: z.number().int().positive(),
  isPrivate: z.boolean().default(false),
  password: z.string().optional()
});

/**
 * GET /api/v1/rooms
 * 获取房间列表
 */
router.get('/', async (req, res, next) => {
  try {
    const { status = 'WAITING', page = '1', limit = '20' } = req.query;
    
    const pageNum = parseInt(page as string, 10);
    const limitNum = Math.min(parseInt(limit as string, 10), 50);
    const skip = (pageNum - 1) * limitNum;

    const where = status ? { status: status as any } : {};

    const [rooms, total] = await Promise.all([
      prisma.room.findMany({
        where,
        skip,
        take: limitNum,
        orderBy: { createdAt: 'desc' },
        include: {
          members: {
            select: {
              userId: true,
              seatNumber: true,
              isReady: true,
              isHost: true
            }
          },
          _count: {
            select: { members: true }
          }
        }
      }),
      prisma.room.count({ where })
    ]);

    res.json({
      success: true,
      data: rooms,
      meta: {
        page: pageNum,
        limit: limitNum,
        total,
        hasMore: skip + rooms.length < total
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/rooms
 * 创建房间
 */
router.post('/', async (req, res, next) => {
  try {
    const data = createRoomSchema.parse(req.body);
    
    // 从 Authorization header 获取用户ID
    const authHeader = req.headers.authorization;
    let userId: string;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), process.env.JWT_SECRET!) as { userId: string };
        userId = decoded.userId;
      } catch (e) {
        res.status(401).json({
          success: false,
          error: { code: 'INVALID_TOKEN', message: 'Invalid or expired token' }
        });
        return;
      }
    } else {
      res.status(401).json({
        success: false,
        error: { code: 'NO_TOKEN', message: 'Authorization header required' }
      });
      return;
    }
    
    // 生成唯一房间代码（最多重试10次）
    let code: string;
    let isUnique = false;
    let attempts = 0;
    const MAX_CODE_GENERATION_ATTEMPTS = 10;
    
    while (!isUnique && attempts < MAX_CODE_GENERATION_ATTEMPTS) {
      code = generateRoomCode();
      const existing = await prisma.room.findUnique({ where: { code } });
      if (!existing) {
        isUnique = true;
      } else {
        attempts++;
      }
    }
    
    if (!isUnique) {
      res.status(503).json({
        success: false,
        error: { code: 'ROOM_UNAVAILABLE', message: 'Unable to generate unique room code, please try again' }
      });
      return;
    }

    const room = await prisma.room.create({
      data: {
        code: code!,
        name: data.name,
        maxPlayers: data.maxPlayers,
        smallBlind: data.smallBlind,
        bigBlind: data.bigBlind,
        minBuyIn: data.minBuyIn,
        maxBuyIn: data.maxBuyIn,
        isPrivate: data.isPrivate,
        passwordHash: data.password ? await bcrypt.hash(data.password, 10) : null,
        members: {
          create: {
            userId,
            seatNumber: 0,
            isHost: true,
            isReady: true,
            buyInAmount: data.minBuyIn
          }
        }
      },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true
              }
            }
          }
        }
      }
    });

    logger.info({ roomId: room.id, code: room.code }, 'Room created');

    res.status(201).json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/rooms/:code
 * 获取房间详情
 */
router.get('/:code', async (req, res, next) => {
  try {
    const { code } = req.params;

    const room = await prisma.room.findUnique({
      where: { code },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true
              }
            }
          },
          orderBy: { seatNumber: 'asc' }
        },
        games: {
          where: { status: { not: 'ENDED' } },
          take: 1
        }
      }
    });

    if (!room) {
      res.status(404).json({
        success: false,
        error: {
          code: 'ROOM_NOT_FOUND',
          message: 'Room not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: room
    });
  } catch (error) {
    next(error);
  }
});

export { router as roomRouter };
