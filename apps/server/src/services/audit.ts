/**
 * 审计日志服务
 * @module services/audit
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import { PrismaClient, AuditAction } from '@prisma/client';
import { logger } from '../utils/logger';

const prisma = new PrismaClient();

export interface AuditContext {
  userId?: string;
  sessionId?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface AuditLogEntry {
  action: AuditAction;
  resource: string;
  resourceId?: string;
  oldValue?: any;
  newValue?: any;
  success?: boolean;
  errorMessage?: string;
}

/**
 * 审计日志服务
 * 提供统一的审计日志记录接口
 */
export class AuditService {
  // 审计日志保留天数（默认90天）
  private static readonly RETENTION_DAYS = parseInt(process.env.AUDIT_RETENTION_DAYS || '90', 10);
  
  /**
   * 清理过期的审计日志
   * 建议定期运行（如每天一次）
   */
  async cleanupOldLogs(): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - AuditService.RETENTION_DAYS);
    
    try {
      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: {
            lt: cutoffDate
          }
        }
      });
      
      logger.info({ 
        deletedCount: result.count, 
        cutoffDate: cutoffDate.toISOString() 
      }, 'Cleaned up old audit logs');
      
      return result.count;
    } catch (error) {
      logger.error({ error }, 'Failed to cleanup old audit logs');
      return 0;
    }
  }

  /**
   * 启动定期清理任务
   */
  startCleanupScheduler(): void {
    // 每天清理一次
    const ONE_DAY_MS = 24 * 60 * 60 * 1000;
    
    setInterval(() => {
      this.cleanupOldLogs().catch(error => {
        logger.error({ error }, 'Scheduled audit log cleanup failed');
      });
    }, ONE_DAY_MS);
    
    logger.info({ retentionDays: AuditService.RETENTION_DAYS }, 'Audit log cleanup scheduler started');
  }

  /**
   * 记录审计日志
   * @param context 审计上下文
   * @param entry 审计日志条目
   * @param critical 是否为关键操作（失败时需要回滚）
   */
  async log(context: AuditContext, entry: AuditLogEntry, critical: boolean = false): Promise<void> {
    try {
      // 规范化 IP 地址（处理 X-Forwarded-For 代理）
      const normalizedIp = this.normalizeIpAddress(context.ipAddress);
      
      await prisma.auditLog.create({
        data: {
          userId: context.userId,
          sessionId: context.sessionId,
          ipAddress: normalizedIp,
          userAgent: context.userAgent,
          action: entry.action,
          resource: entry.resource,
          resourceId: entry.resourceId,
          oldValue: this.serializeValue(entry.oldValue),
          newValue: this.serializeValue(entry.newValue),
          success: entry.success ?? true,
          errorMessage: entry.errorMessage
        }
      });
    } catch (error) {
      // 审计日志失败不应影响主业务流程，只记录错误
      logger.error({ error, entry }, 'Failed to write audit log');
      
      // 关键操作的审计失败需要重新抛出异常，触发事务回滚
      if (critical) {
        throw error;
      }
    }
  }

  /**
   * 规范化 IP 地址
   * 处理 X-Forwarded-For 头中的多个 IP，取第一个真实的外部 IP
   */
  private normalizeIpAddress(ip: string | undefined): string | undefined {
    if (!ip) return undefined;
    
    // 处理 IPv6 本地地址
    if (ip === '::1' || ip === '127.0.0.1') {
      return 'localhost';
    }
    
    // 处理 X-Forwarded-For（可能包含多个 IP，格式: client, proxy1, proxy2）
    if (ip.includes(',')) {
      const ips = ip.split(',').map(i => i.trim());
      // 取第一个非本地、非私有IP的地址
      for (const candidate of ips) {
        if (candidate && !this.isPrivateIp(candidate)) {
          return candidate;
        }
      }
      // 如果都是私有IP，取第一个
      return ips[0];
    }
    
    return ip;
  }

  /**
   * 检查是否为私有 IP
   */
  private isPrivateIp(ip: string): boolean {
    // 简化的私有IP检查
    return (
      ip.startsWith('10.') ||
      ip.startsWith('192.168.') ||
      ip.startsWith('172.16.') || ip.startsWith('172.17.') || ip.startsWith('172.18.') ||
      ip.startsWith('172.19.') || ip.startsWith('172.20.') || ip.startsWith('172.21.') ||
      ip.startsWith('172.22.') || ip.startsWith('172.23.') || ip.startsWith('172.24.') ||
      ip.startsWith('172.25.') || ip.startsWith('172.26.') || ip.startsWith('172.27.') ||
      ip.startsWith('172.28.') || ip.startsWith('172.29.') || ip.startsWith('172.30.') ||
      ip.startsWith('172.31.') ||
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip.startsWith('fc00:') ||
      ip.startsWith('fe80:')
    );
  }

  /**
   * 序列化值，处理 BigInt 等特殊类型
   */
  private serializeValue(value: any): any {
    if (value === null || value === undefined) {
      return undefined;
    }
    return JSON.parse(JSON.stringify(value, (key, val) => {
      if (typeof val === 'bigint') {
        return val.toString();
      }
      return val;
    }));
  }

  /**
   * 快捷方法：记录用户登录
   */
  async logLogin(context: AuditContext, userId: string, success: boolean, errorMessage?: string): Promise<void> {
    await this.log(context, {
      action: 'USER_LOGIN',
      resource: 'user',
      resourceId: userId,
      success,
      errorMessage
    });
  }

  /**
   * 快捷方法：记录房间创建
   */
  async logRoomCreate(context: AuditContext, roomId: string, roomData: any): Promise<void> {
    await this.log(context, {
      action: 'ROOM_CREATE',
      resource: 'room',
      resourceId: roomId,
      newValue: roomData
    });
  }

  /**
   * 快捷方法：记录游戏动作
   */
  async logGameAction(
    context: AuditContext, 
    gameId: string, 
    playerId: string, 
    actionType: string, 
    amount?: number
  ): Promise<void> {
    await this.log(context, {
      action: 'GAME_ACTION',
      resource: 'game',
      resourceId: gameId,
      newValue: { playerId, actionType, amount }
    });
  }

  /**
   * 快捷方法：记录余额变更
   */
  async logBalanceUpdate(
    context: AuditContext,
    userId: string,
    oldBalance: bigint,
    newBalance: bigint,
    reason: string
  ): Promise<void> {
    await this.log(context, {
      action: 'BALANCE_UPDATE',
      resource: 'user',
      resourceId: userId,
      oldValue: { balance: oldBalance.toString() },
      newValue: { balance: newBalance.toString(), reason }
    });
  }

  /**
   * 查询审计日志
   */
  async query(params: {
    userId?: string;
    action?: AuditAction;
    resource?: string;
    resourceId?: string;
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }) {
    const where: any = {};
    
    if (params.userId) where.userId = params.userId;
    if (params.action) where.action = params.action;
    if (params.resource) where.resource = params.resource;
    if (params.resourceId) where.resourceId = params.resourceId;
    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) where.createdAt.gte = params.startDate;
      if (params.endDate) where.createdAt.lte = params.endDate;
    }

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: params.limit || 50,
        skip: params.offset || 0
      }),
      prisma.auditLog.count({ where })
    ]);

    return { logs, total };
  }
}

// 导出单例
export const auditService = new AuditService();
