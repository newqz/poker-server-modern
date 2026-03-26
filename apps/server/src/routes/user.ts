/**
 * 用户路由
 * @module routes/user
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import { Router } from 'express';
import { PrismaClient } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/authenticate';

const router = Router();
const prisma = new PrismaClient();

/**
 * GET /api/v1/users/me
 * 获取当前用户信息
 */
router.get('/me', async (req: AuthenticatedRequest, res, next) => {
  try {
    // 从中间件注入的 req.user 获取用户ID
    const userId = req.user?.userId || (req.headers['authorization'] as string)?.split(' ')[1];
    
    if (!userId) {
      res.status(401).json({
        success: false,
        error: { code: 'UNAUTHORIZED', message: 'Authentication required' }
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        username: true,
        email: true,
        avatarUrl: true,
        balance: true,
        totalGames: true,
        totalWins: true,
        totalLosses: true,
        createdAt: true
      }
    });

    if (!user) {
      res.status(404).json({
        success: false,
        error: {
          code: 'USER_NOT_FOUND',
          message: 'User not found'
        }
      });
      return;
    }

    res.json({
      success: true,
      data: user
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/me/stats
 * 获取用户统计
 */
router.get('/me/stats', async (req, res, next) => {
  try {
    // TODO: 实现用户统计
    res.status(501).json({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'User stats not implemented' }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/v1/users/leaderboard
 * 获取排行榜
 */
router.get('/leaderboard', async (req, res, next) => {
  try {
    const { type = 'weekly', limit = '10' } = req.query;
    const limitNum = parseInt(limit as string, 10);
    const safeLimit = isNaN(limitNum) ? 10 : Math.min(limitNum, 100);

    // TODO: 实现排行榜逻辑
    res.status(501).json({
      success: false,
      error: { code: 'NOT_IMPLEMENTED', message: 'Leaderboard not implemented' }
    });
  } catch (error) {
    next(error);
  }
});

export { router as userRouter };
