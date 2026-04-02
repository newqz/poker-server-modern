/**
 * API 速率限制中间件
 * @module middleware/rateLimit
 * @description 基于 Redis 的分布式 API 速率限制
 */

import { Request, Response, NextFunction } from 'express';
import { rateLimiter } from '../utils/rateLimiter';
import { logger } from '../utils/logger';

export interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix?: string;
}

/**
 * 创建速率限制中间件
 */
export function createRateLimitMiddleware(options: RateLimitOptions) {
  const { windowMs, maxRequests, keyPrefix = 'api' } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // 使用 IP 或用户 ID 作为 key
    const identifier = req.userId || req.ip || 'unknown';
    const key = `${keyPrefix}:${identifier}`;

    try {
      const result = await rateLimiter.checkAndIncrement(key, {
        maxAttempts: maxRequests,
        windowMs: windowMs
      });

      // 设置速率限制响应头
      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', result.remaining.toString());
      if (result.resetAt) {
        res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetAt / 1000).toString());
      }

      if (!result.success) {
        logger.warn({
          ip: req.ip,
          path: req.path,
          userId: req.userId
        }, 'API rate limit exceeded');

        res.status(429).json({
          success: false,
          error: {
            code: 'RATE_LIMITED',
            message: 'Too many requests, please try again later'
          }
        });
        return;
      }

      next();
    } catch (error) {
      // 速率限制出错时，放行请求
      logger.error({ error }, 'Rate limit middleware error, allowing request');
      next();
    }
  };
}

// 预设速率限制

export const defaultRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 100,
  keyPrefix: 'api'
});

export const authRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 20,
  keyPrefix: 'auth'
});

export const gameActionRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 30,
  keyPrefix: 'game'
});

export const searchRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 50,
  keyPrefix: 'search'
});

export const strictRateLimit = createRateLimitMiddleware({
  windowMs: 60 * 1000,
  maxRequests: 10,
  keyPrefix: 'strict'
});
