/**
 * 管理后台 API
 * @module routes/admin
 * @description 管理功能（需管理员权限）
 */

import { Router, Request, Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import { antiCheatService } from '../services/antiCheat';
import { logger } from '../utils/logger';

const router = Router();
const prisma = new PrismaClient();

// 简单的管理员权限检查中间件
// 生产环境应使用更完善的角色权限系统
async function requireAdmin(req: Request, res: Response, next: NextFunction) {
  // TODO: 实现完整的管理员权限检查
  // 目前暂时跳过，实际生产需要检查用户角色
  next();
}

/**
 * GET /api/v1/admin/players/:id/risk
 * 获取玩家风险分数
 */
router.get('/players/:id/risk', requireAdmin, async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const riskScore = await antiCheatService.getPlayerRiskScore(id);
    
    res.json({
      success: true,
      data: {
        playerId: id,
        riskScore: riskScore ? riskScore.totalScore : 0,
        flags: riskScore?.flags || [],
        checkedAt: riskScore?.checkedAt || null
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get player risk score');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get risk score' }
    });
  }
});

/**
 * GET /api/v1/admin/players/risk-summary
 * 获取所有高风险玩家摘要
 */
router.get('/players/risk-summary', requireAdmin, async (req: Request, res: Response) => {
  try {
    const recentFlags = await prisma.auditLog.findMany({
      where: {
        action: 'ADMIN_ACTION',
        resource: 'anti_cheat'
      },
      orderBy: { createdAt: 'desc' },
      take: 100
    });
    
    // 聚合风险分数
    const riskMap = new Map<string, { score: number; flags: number; latest: Date }>();
    
    for (const log of recentFlags) {
      const userId = log.userId!;
      const data = log.newValue as any;
      
      if (riskMap.has(userId)) {
        const existing = riskMap.get(userId)!;
        existing.score = Math.max(existing.score, data.riskScore);
        existing.flags += (data.flags?.length || 0);
      } else {
        riskMap.set(userId, {
          score: data.riskScore,
          flags: data.flags?.length || 0,
          latest: log.createdAt
        });
      }
    }
    
    const highRiskPlayers = Array.from(riskMap.entries())
      .map(([userId, data]) => ({ userId, ...data }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50);
    
    res.json({
      success: true,
      data: {
        totalFlagged: highRiskPlayers.length,
        players: highRiskPlayers
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get risk summary');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get risk summary' }
    });
  }
});

/**
 * GET /api/v1/admin/stats
 * 获取系统统计
 */
router.get('/stats', requireAdmin, async (req: Request, res: Response) => {
  try {
    const [
      totalUsers,
      activeUsers,
      totalGames,
      activeGames
    ] = await Promise.all([
      prisma.user.count(),
      prisma.user.count({
        where: {
          lastLoginAt: {
            gte: new Date(Date.now() - 24 * 60 * 60 * 1000)
          }
        }
      }),
      prisma.game.count(),
      prisma.game.count({
        where: {
          status: { in: ['PREFLOP', 'FLOP', 'TURN', 'RIVER'] }
        }
      })
    ]);
    
    res.json({
      success: true,
      data: {
        users: {
          total: totalUsers,
          active24h: activeUsers
        },
        games: {
          total: totalGames,
          active: activeGames
        }
      }
    });
  } catch (error) {
    logger.error({ error }, 'Failed to get admin stats');
    res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_ERROR', message: 'Failed to get stats' }
    });
  }
});

export { router as adminRouter };
