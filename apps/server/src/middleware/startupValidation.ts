/**
 * 启动校验中间件
 * @module middleware/startupValidation
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * 验证必需的 环境变量
 */
export function validateEnvironment(): void {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // JWT Secret 校验
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    errors.push('JWT_SECRET is required');
  } else if (jwtSecret.length < 32) {
    errors.push('JWT_SECRET must be at least 32 characters long');
  }
  
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  if (!jwtRefreshSecret) {
    errors.push('JWT_REFRESH_SECRET is required');
  } else if (jwtRefreshSecret.length < 32) {
    errors.push('JWT_REFRESH_SECRET must be at least 32 characters long');
  }
  
  // CORS 校验
  const corsOrigin = process.env.CORS_ORIGIN;
  if (!corsOrigin) {
    errors.push('CORS_ORIGIN is required');
  } else if (corsOrigin === '*') {
    errors.push('CORS_ORIGIN cannot be "*" in production');
  }
  
  // 数据库连接校验
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    errors.push('DATABASE_URL is required');
  } else {
    // 检查是否包含密码
    if (!databaseUrl.includes('@') && !databaseUrl.includes(':5432/')) {
      warnings.push('DATABASE_URL should include authentication credentials');
    }
    // 生产环境检查 SSL
    if (process.env.NODE_ENV === 'production' && !databaseUrl.includes('ssl')) {
      warnings.push('DATABASE_URL should include ssl=true in production');
    }
  }
  
  // Redis 校验
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    warnings.push('REDIS_URL is not configured - multi-instance deployments will not work');
  }
  
  // 生产环境额外检查
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.REQUEST_SIGNING_SECRET) {
      errors.push('REQUEST_SIGNING_SECRET is required in production');
    }
    if (!process.env.REDIS_PASSWORD) {
      warnings.push('REDIS_PASSWORD is not configured');
    }
  }
  
  if (errors.length > 0) {
    logger.error({ errors }, 'Environment validation failed');
    throw new Error(`Environment validation failed: ${errors.join(', ')}`);
  }
  
  if (warnings.length > 0) {
    logger.warn({ warnings }, 'Environment validation warnings');
  }
  
  logger.info('Environment validation passed');
}

/**
 * 启动校验中间件
 */
export function startupValidation(req: Request, res: Response, next: NextFunction): void {
  try {
    validateEnvironment();
    next();
  } catch (error) {
    res.status(500).json({
      success: false,
      error: {
        code: 'ENVIRONMENT_ERROR',
        message: error instanceof Error ? error.message : 'Environment validation failed'
      }
    });
  }
}
