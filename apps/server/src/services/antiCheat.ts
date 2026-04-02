/**
 * 反作弊服务
 * @module services/antiCheat
 * @description 检测异常行为，防止作弊和攻击
 */

import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

// 风险阈值配置
const THRESHOLDS = {
  // 玩家行为
  MAXActionsPerSecond: 5,           // 每秒最大动作数
  MINActionIntervalMs: 200,         // 最小动作间隔 (毫秒)
  
  // 资金异常
  MAXBalanceChangePercent: 500,    // 单局余额变化最大值 (%)
  MAXBuyInPerHour: 50,             // 每小时最大买入次数
  MAXWinRate: 0.85,               // 最大胜率 (异常高)
  
  // 伙牌检测
  MAXSameIPPlayers: 2,            // 同IP最大玩家数
  MAXSimilarActionPattern: 0.9,   // 动作模式相似度阈值
  
  // 账户安全
  MAXLoginAttemptsPerHour: 10,    // 每小时最大登录尝试
  MAXAccountAgeHoursForLargeWin: 24, // 大额盈利的最小账户年龄
};

interface PlayerAction {
  playerId: string;
  action: string;
  timestamp: Date;
  gameId: string;
  amount?: number;
}

interface RiskScore {
  playerId: string;
  totalScore: number;
  flags: RiskFlag[];
  checkedAt: Date;
}

interface RiskFlag {
  type: RiskFlagType;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  details?: Record<string, any>;
}

type RiskFlagType =
  | 'RAPID_ACTIONS'
  | 'IMPOSSIBLE_REACTION_TIME'
  | 'SUSPICIOUS_WIN_RATE'
  | 'BALANCE_ANOMALY'
  | 'MULTIPLE_ACCOUNTS_SAME_IP'
  | 'COLLUSION_DETECTED'
  | 'BOT_LIKE_BEHAVIOR'
  | 'UNUSUAL_BETTING_PATTERN';

/**
 * 反作弊服务
 * 检测和标记可疑行为
 */
export class AntiCheatService {
  // 玩家动作缓存: playerId -> RecentAction[]
  private actionCache = new Map<string, PlayerAction[]>();
  private readonly CACHE_TTL_MS = 60 * 1000; // 1分钟

  /**
   * 记录玩家动作
   */
  async recordAction(
    playerId: string,
    gameId: string,
    action: string,
    amount?: number
  ): Promise<void> {
    const now = new Date();
    
    // 添加到缓存
    if (!this.actionCache.has(playerId)) {
      this.actionCache.set(playerId, []);
    }
    
    const actions = this.actionCache.get(playerId)!;
    actions.push({
      playerId,
      action,
      timestamp: now,
      gameId,
      amount
    });
    
    // 清理过期动作
    const cutoff = new Date(now.getTime() - this.CACHE_TTL_MS);
    const validActions = actions.filter(a => a.timestamp > cutoff);
    this.actionCache.set(playerId, validActions);
    
    // 异步执行风险检查
    this.checkRisks(playerId).catch(err => {
      logger.error({ playerId, error: err }, 'Risk check failed');
    });
  }

  /**
   * 检查玩家风险
   */
  async checkRisks(playerId: string): Promise<RiskScore> {
    const flags: RiskFlag[] = [];
    let totalScore = 0;
    
    // 1. 检查动作速度异常
    const speedFlag = await this.checkActionSpeed(playerId);
    if (speedFlag) {
      flags.push(speedFlag);
      totalScore += this.severityToScore(speedFlag.severity);
    }
    
    // 2. 检查反应时间异常 (不可能的反应)
    const reactionFlag = await this.checkImpossibleReaction(playerId);
    if (reactionFlag) {
      flags.push(reactionFlag);
      totalScore += this.severityToScore(reactionFlag.severity);
    }
    
    // 3. 检查胜率异常
    const winRateFlag = await this.checkSuspiciousWinRate(playerId);
    if (winRateFlag) {
      flags.push(winRateFlag);
      totalScore += this.severityToScore(winRateFlag.severity);
    }
    
    // 4. 检查同IP多账号
    const multiFlag = await this.checkMultipleAccounts(playerId);
    if (multiFlag) {
      flags.push(multiFlag);
      totalScore += this.severityToScore(multiFlag.severity);
    }
    
    // 5. 检查余额异常
    const balanceFlag = await this.checkBalanceAnomaly(playerId);
    if (balanceFlag) {
      flags.push(balanceFlag);
      totalScore += this.severityToScore(balanceFlag.severity);
    }
    
    // 保存风险报告到数据库
    if (flags.length > 0) {
      await this.saveRiskReport(playerId, totalScore, flags);
    }
    
    return {
      playerId,
      totalScore,
      flags,
      checkedAt: new Date()
    };
  }

  /**
   * 检查动作速度异常
   */
  private async checkActionSpeed(playerId: string): Promise<RiskFlag | null> {
    const actions = this.actionCache.get(playerId) || [];
    const now = Date.now();
    const recentActions = actions.filter(a => now - a.timestamp.getTime() < 10000);
    
    if (recentActions.length < 5) return null;
    
    // 计算平均每秒动作数
    const timeSpan = now - recentActions[0].timestamp.getTime();
    const actionsPerSecond = (recentActions.length / timeSpan) * 1000;
    
    if (actionsPerSecond > THRESHOLDS.MAXActionsPerSecond) {
      return {
        type: 'RAPID_ACTIONS',
        severity: actionsPerSecond > THRESHOLDS.MAXActionsPerSecond * 2 ? 'high' : 'medium',
        description: `动作速度异常: ${actionsPerSecond.toFixed(2)} 动作/秒`,
        details: {
          actionsPerSecond,
          threshold: THRESHOLDS.MAXActionsPerSecond,
          recentActionCount: recentActions.length
        }
      };
    }
    
    return null;
  }

  /**
   * 检查不可能的反应时间
   * 人类平均反应时间约 200-300ms
   */
  private async checkImpossibleReaction(playerId: string): Promise<RiskFlag | null> {
    const actions = this.actionCache.get(playerId) || [];
    const now = Date.now();
    const recentActions = actions
      .filter(a => now - a.timestamp.getTime() < 30000)
      .sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    if (recentActions.length < 2) return null;
    
    // 检查连续动作间隔
    for (let i = 1; i < recentActions.length; i++) {
      const interval = recentActions[i].timestamp.getTime() - recentActions[i - 1].timestamp.getTime();
      
      if (interval < THRESHOLDS.MINActionIntervalMs && interval > 0) {
        return {
          type: 'IMPOSSIBLE_REACTION_TIME',
          severity: interval < 50 ? 'critical' : 'high',
          description: `反应时间异常快: ${interval}ms (人类极限约 150-200ms)`,
          details: {
            intervalMs: interval,
            threshold: THRESHOLDS.MINActionIntervalMs,
            action: recentActions[i].action
          }
        };
      }
    }
    
    return null;
  }

  /**
   * 检查胜率异常
   */
  private async checkSuspiciousWinRate(playerId: string): Promise<RiskFlag | null> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const stats = await prisma.gamePlayer.aggregate({
      where: {
        userId: playerId,
        isWinner: true,
        createdAt: { gte: thirtyDaysAgo }
      },
      _count: true
    });
    
    const totalGames = await prisma.gamePlayer.count({
      where: {
        userId: playerId,
        createdAt: { gte: thirtyDaysAgo }
      }
    });
    
    if (totalGames < 20) return null; // 样本量不足
    
    const winRate = stats._count / totalGames;
    
    if (winRate > THRESHOLDS.MAXWinRate) {
      return {
        type: 'SUSPICIOUS_WIN_RATE',
        severity: winRate > 0.95 ? 'critical' : 'high',
        description: `胜率异常高: ${(winRate * 100).toFixed(1)}% (30天内 ${totalGames} 局)`,
        details: {
          winRate,
          threshold: THRESHOLDS.MAXWinRate,
          totalGames,
          wins: stats._count
        }
      };
    }
    
    return null;
  }

  /**
   * 检查同IP多账号
   */
  private async checkMultipleAccounts(playerId: string): Promise<RiskFlag | null> {
    // 获取玩家最近的IP
    const recentLogin = await prisma.auditLog.findFirst({
      where: {
        userId: playerId,
        action: 'USER_LOGIN',
        success: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (!recentLogin?.ipAddress) return null;
    
    // 查找同IP的其他活跃用户
    const sameIPUsers = await prisma.auditLog.groupBy({
      by: ['userId'],
      where: {
        ipAddress: recentLogin.ipAddress,
        action: 'USER_LOGIN',
        success: true,
        createdAt: {
          gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 最近7天
        }
      }
    });
    
    if (sameIPUsers.length > THRESHOLDS.MAXSameIPPlayers) {
      return {
        type: 'MULTIPLE_ACCOUNTS_SAME_IP',
        severity: sameIPUsers.length > 4 ? 'high' : 'medium',
        description: `同IP多账号: ${sameIPUsers.length} 个账号 (IP: ${recentLogin.ipAddress})`,
        details: {
          ipAddress: recentLogin.ipAddress,
          accountCount: sameIPUsers.length,
          userIds: sameIPUsers.map(u => u.userId)
        }
      };
    }
    
    return null;
  }

  /**
   * 检查余额异常
   */
  private async checkBalanceAnomaly(playerId: string): Promise<RiskFlag | null> {
    const user = await prisma.user.findUnique({
      where: { id: playerId },
      select: {
        balance: true,
        createdAt: true,
        totalGames: true,
        totalWins: true
      }
    });
    
    if (!user) return null;
    
    // 检查短时间内余额大幅增长
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTransactions = await prisma.transaction.findMany({
      where: {
        userId: playerId,
        createdAt: { gte: oneDayAgo },
        type: 'GAME_WIN'
      },
      orderBy: { createdAt: 'desc' }
    });
    
    if (recentTransactions.length < 5) return null;
    
    // 计算总盈利
    const totalProfit = recentTransactions.reduce((sum, t) => sum + Number(t.amount), 0);
    const initialBalance = Number(user.balance) - totalProfit;
    
    if (initialBalance > 0) {
      const profitPercent = (totalProfit / initialBalance) * 100;
      
      if (profitPercent > THRESHOLDS.MAXBalanceChangePercent) {
        return {
          type: 'BALANCE_ANOMALY',
          severity: profitPercent > 1000 ? 'critical' : 'high',
          description: `余额异常增长: 24小时内盈利 ${profitPercent.toFixed(0)}%`,
          details: {
            profitPercent,
            threshold: THRESHOLDS.MAXBalanceChangePercent,
            totalProfit,
            initialBalance
          }
        };
      }
    }
    
    return null;
  }

  /**
   * 伙牌检测 - 检查两个玩家的动作模式相似度
   */
  async checkCollusion(playerIds: string[]): Promise<RiskFlag | null> {
    if (playerIds.length < 2) return null;
    
    // 获取两个玩家的最近动作
    const actions1 = this.actionCache.get(playerIds[0]) || [];
    const actions2 = this.actionCache.get(playerIds[1]) || [];
    
    if (actions1.length < 5 || actions2.length < 5) return null;
    
    // 简化的相似度检测：检查动作时间模式
    const pattern1 = this.extractPattern(actions1);
    const pattern2 = this.extractPattern(actions2);
    const similarity = this.calculatePatternSimilarity(pattern1, pattern2);
    
    if (similarity > THRESHOLDS.MAXSimilarActionPattern) {
      return {
        type: 'COLLUSION_DETECTED',
        severity: similarity > 0.95 ? 'critical' : 'high',
        description: `检测到伙牌行为: 动作模式相似度 ${(similarity * 100).toFixed(1)}%`,
        details: {
          similarity,
          threshold: THRESHOLDS.MAXSimilarActionPattern,
          playerIds
        }
      };
    }
    
    return null;
  }

  /**
   * 提取动作模式
   */
  private extractPattern(actions: PlayerAction[]): number[] {
    if (actions.length < 2) return [];
    
    const intervals: number[] = [];
    for (let i = 1; i < actions.length; i++) {
      intervals.push(actions[i].timestamp.getTime() - actions[i - 1].timestamp.getTime());
    }
    
    return intervals;
  }

  /**
   * 计算模式相似度
   */
  private calculatePatternSimilarity(pattern1: number[], pattern2: number[]): number {
    if (pattern1.length === 0 || pattern2.length === 0) return 0;
    
    // 使用皮尔逊相关系数
    const n = Math.min(pattern1.length, pattern2.length);
    if (n === 0) return 0;
    
    let sumXY = 0, sumX = 0, sumY = 0, sumX2 = 0, sumY2 = 0;
    
    for (let i = 0; i < n; i++) {
      sumXY += pattern1[i] * pattern2[i];
      sumX += pattern1[i];
      sumY += pattern2[i];
      sumX2 += pattern1[i] * pattern1[i];
      sumY2 += pattern2[i] * pattern2[i];
    }
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    if (denominator === 0) return 0;
    return Math.abs(numerator / denominator);
  }

  /**
   * 保存风险报告
   */
  private async saveRiskReport(
    playerId: string,
    score: number,
    flags: RiskFlag[]
  ): Promise<void> {
    try {
      await prisma.auditLog.create({
        data: {
          userId: playerId,
          action: 'ADMIN_ACTION',
          resource: 'anti_cheat',
          resourceId: playerId,
          newValue: {
            riskScore: score,
            flags: flags.map(f => ({
              type: f.type,
              severity: f.severity,
              description: f.description
            }))
          } as any,
          success: true
        }
      });
      
      logger.warn({ playerId, score, flags }, 'Risk report saved');
    } catch (error) {
      logger.error({ playerId, error }, 'Failed to save risk report');
    }
  }

  /**
   * 将严重性转换为分数
   */
  private severityToScore(severity: RiskFlag['severity']): number {
    switch (severity) {
      case 'low': return 10;
      case 'medium': return 25;
      case 'high': return 50;
      case 'critical': return 100;
    }
  }

  /**
   * 获取玩家风险分数
   */
  async getPlayerRiskScore(playerId: string): Promise<RiskScore | null> {
    // 从缓存获取最新检查结果
    const flags = await this.checkRisks(playerId);
    return flags.totalScore > 0 ? flags : null;
  }
}

// 导出单例
export const antiCheatService = new AntiCheatService();
