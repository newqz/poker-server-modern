/**
 * 游戏路由
 * @module routes/game
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/games/history
 * 获取游戏历史
 */
router.get('/history', async (req, res, next) => {
  try {
    // TODO: 实现游戏历史查询
    res.json({
      success: true,
      data: [],
      meta: { page: 1, limit: 20, total: 0, hasMore: false }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/games/:id
 * 获取游戏详情
 */
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;

    const game = await prisma.game.findUnique({
      where: { id },
      include: {
        players: {
          include: {
            user: {
              select: {
                id: true,
                username: true,
                avatarUrl: true
              }
            }
          }
        },
        actions: {
          orderBy: { createdAt: 'asc' }
        }
      }
    });

    if (!game) {
      res.status(404).json({
        success: false,
        error: {
          code: 'GAME_NOT_FOUND',
          message: 'Game not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: game
    });
  } catch (error) {
    next(error);
  }
});

export { router as gameRouter };
