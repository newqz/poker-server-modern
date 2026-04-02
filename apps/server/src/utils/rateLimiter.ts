/**
 * 分布式速率限制器
 * @module utils/rateLimiter
 * @description 基于 Redis 的分布式速率限制实现，支持多实例部署
 */

import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

// 配置常量
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15分钟
const MAX_LOGIN_ATTEMPTS = 5;
const MAX_REGISTER_ATTEMPTS = 3;
const REGISTER_LIMIT_WINDOW_MS = 15 * 60 * 1000;

interface RateLimitConfig {
  maxAttempts: number;
  windowMs: number;
  lockoutMs?: number;
}

interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt?: number;
  lockedUntil?: number;
}

/**
 * 分布式速率限制器
 * 支持多实例部署，通过 Redis 实现共享计数
 */
export class DistributedRateLimiter {
  private redis: RedisClientType | null = null;
  private useMemoryFallback = false;
  private memoryStore = new Map<string, { count: number; resetAt: number }>();

  /**
   * 初始化 Redis 连接
   */
  async initialize(redisUrl?: string): Promise<void> {
    if (!redisUrl) {
      logger.warn('Redis URL not provided, using in-memory rate limiting (not suitable for multi-instance)');
      this.useMemoryFallback = true;
      return;
    }

    try {
      this.redis = createClient({ url: redisUrl });
      await this.redis.connect();
      logger.info('DistributedRateLimiter: Redis connected');
    } catch (error) {
      logger.warn({ error }, 'Failed to connect to Redis, falling back to in-memory rate limiting');
      this.useMemoryFallback = true;
    }
  }

  /**
   * 检查并增加请求计数
   */
  async checkAndIncrement(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    if (this.useMemoryFallback || !this.redis) {
      return this.memoryCheckAndIncrement(key, config);
    }

    return this.redisCheckAndIncrement(key, config);
  }

  /**
   * Redis 实现
   */
  private async redisCheckAndIncrement(key: string, config: RateLimitConfig): Promise<RateLimitResult> {
    const redisKey = `ratelimit:${key}`;
    const windowSec = Math.ceil(config.windowMs / 1000);

    try {
      // 使用 INCR 和 EXPIRE 原子操作
      const count = await this.redis!.incr(redisKey);
      
      if (count === 1) {
        // 首次设置，设置过期时间
        await this.redis!.expire(redisKey, windowSec);
      }

      const remaining = Math.max(0, config.maxAttempts - count);
      const ttl = await this.redis!.ttl(redisKey);
      const resetAt = Date.now() + (ttl * 1000);

      if (count > config.maxAttempts) {
        // 检查是否已被锁定
        const lockKey = `ratelock:${key}`;
        const locked = await this.redis!.get(lockKey);
        
        if (locked) {
          return {
            success: false,
            remaining: 0,
            lockedUntil: parseInt(locked, 10)
          };
        }

        // 需要锁定
        if (config.lockoutMs) {
          const lockKey = `ratelock:${key}`;
          const lockedUntil = Date.now() + config.lockoutMs;
          await this.redis!.setEx(lockKey, Math.ceil(config.lockoutMs / 1000), lockedUntil.toString());
          
          return {
            success: false,
            remaining: 0,
            resetAt,
            lockedUntil
          };
        }

        return {
          success: false,
          remaining: 0,
          resetAt
        };
      }

      return {
        success: true,
        remaining,
        resetAt
      };
    } catch (error) {
      logger.error({ error, key }, 'Redis rate limit error, falling back to allow');
      return { success: true, remaining: config.maxAttempts };
    }
  }

  /**
   * 内存实现（回退）
   */
  private memoryCheckAndIncrement(key: string, config: RateLimitConfig): RateLimitResult {
    const now = Date.now();
    let record = this.memoryStore.get(key);

    if (!record || now > record.resetAt) {
      record = { count: 0, resetAt: now + config.windowMs };
      this.memoryStore.set(key, record);
    }

    record.count++;
    const remaining = Math.max(0, config.maxAttempts - record.count);

    if (record.count > config.maxAttempts) {
      return {
        success: false,
        remaining: 0,
        resetAt: record.resetAt,
        lockedUntil: record.resetAt
      };
    }

    return {
      success: true,
      remaining,
      resetAt: record.resetAt
    };
  }

  /**
   * 清除限制记录
   */
  async clear(key: string): Promise<void> {
    if (this.useMemoryFallback || !this.redis) {
      this.memoryStore.delete(key);
      return;
    }

    try {
      await this.redis!.del(`ratelimit:${key}`);
      await this.redis!.del(`ratelock:${key}`);
    } catch (error) {
      logger.error({ error, key }, 'Failed to clear rate limit');
    }
  }

  /**
   * 获取当前状态（不增加计数）
   */
  async getStatus(key: string): Promise<{ count: number; remaining: number } | null> {
    if (this.useMemoryFallback || !this.redis) {
      const record = this.memoryStore.get(key);
      if (!record) return null;
      return { count: record.count, remaining: Math.max(0, 5 - record.count) };
    }

    try {
      const count = await this.redis!.get(`ratelimit:${key}`);
      if (count === null) return null;
      return { count: parseInt(count, 10), remaining: Math.max(0, 5 - parseInt(count, 10)) };
    } catch {
      return null;
    }
  }

  /**
   * 清理过期记录（内存模式定期清理）
   */
  cleanup(): void {
    if (this.useMemoryFallback) {
      const now = Date.now();
      for (const [key, record] of this.memoryStore.entries()) {
        if (now > record.resetAt + 60000) { // 过期1分钟后清理
          this.memoryStore.delete(key);
        }
      }
    }
  }
}

// 单例实例
export const rateLimiter = new DistributedRateLimiter();

// 预设配置
export const LOGIN_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: MAX_LOGIN_ATTEMPTS,
  windowMs: LOCKOUT_DURATION_MS,
  lockoutMs: LOCKOUT_DURATION_MS
};

export const REGISTER_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: MAX_REGISTER_ATTEMPTS,
  windowMs: REGISTER_LIMIT_WINDOW_MS
};

export const API_RATE_LIMIT: RateLimitConfig = {
  maxAttempts: 100,
  windowMs: 60 * 1000 // 1分钟
};
