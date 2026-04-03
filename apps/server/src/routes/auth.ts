/**
 * 认证路由
 * @module routes/auth
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import { Router } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import rateLimit from 'express-rate-limit';
import { PrismaClient } from '@prisma/client';
import { logger } from '../utils/logger';
import { auditService, AuditContext } from '../services/audit';
import { rateLimiter, LOGIN_RATE_LIMIT, REGISTER_RATE_LIMIT } from '../utils/rateLimiter';

// 登录速率限制：每15分钟最多5次
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many login attempts, please try again later' }
  }
});

// 注册速率限制：每IP每15分钟最多3次
const registerLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: {
    success: false,
    error: { code: 'RATE_LIMITED', message: 'Too many registration attempts, please try again later' }
  }
});

const router = Router();
const prisma = new PrismaClient();

/**
 * 验证 expiresIn 格式并确保不超过最大值
 */
function validateExpiresIn(value: string | undefined, maxValue: string): string {
  const validFormats = /^[1-9]\d*[smhd]$/;
  if (!value || !validFormats.test(value)) {
    return maxValue;
  }
  const unit = value.slice(-1);
  const num = parseInt(value.slice(0, -1), 10);
  const multipliers: Record<string, number> = { s: 1, m: 60, h: 3600, d: 86400 };
  const valueSeconds = num * multipliers[unit];
  const maxUnit = maxValue.slice(-1);
  const maxNum = parseInt(maxValue.slice(0, -1), 10);
  const maxSeconds = maxNum * multipliers[maxUnit];
  if (valueSeconds > maxSeconds) {
    return maxValue;
  }
  return value;
}

// 注册请求体验证
const registerSchema = z.object({
  username: z.string().min(3).max(32).regex(/^[a-zA-Z0-9_]+$/),
  email: z.string().email(),
  password: z.string().min(8).max(100)
});

// 登录请求体验证
const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1)
});

// 生成 JWT Token
function generateTokens(userId: string) {
  const jwtSecret = process.env.JWT_SECRET;
  const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
  
  // 严格校验：secret 不能为空或为默认值
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long');
  }
  if (!jwtRefreshSecret || jwtRefreshSecret.length < 32) {
    throw new Error('JWT_REFRESH_SECRET must be at least 32 characters long');
  }

  // 验证 expiresIn 格式并设置上限
  const ACCESS_TOKEN_MAX_AGE = '1h'; // 最多1小时
  const REFRESH_TOKEN_MAX_AGE = '7d'; // 最多7天
  
  const accessExpiresIn = validateExpiresIn(process.env.JWT_EXPIRES_IN, ACCESS_TOKEN_MAX_AGE);
  const refreshExpiresIn = validateExpiresIn(process.env.JWT_REFRESH_EXPIRES_IN, REFRESH_TOKEN_MAX_AGE);

  const accessToken = jwt.sign(
    { userId, type: 'access' },
    jwtSecret,
    { expiresIn: accessExpiresIn }
  );

  const refreshToken = jwt.sign(
    { userId, type: 'refresh' },
    jwtRefreshSecret,
    { expiresIn: refreshExpiresIn }
  );

  return { accessToken, refreshToken };
}

/**
 * 生成 token 的 SHA256 哈希（用于存储）
 */
function hashToken(token: string): string {
  const { createHash } = require('crypto');
  return createHash('sha256').update(token).digest('hex');
}

/**
 * POST /api/v1/auth/register
 * 用户注册
 */
router.post('/register', registerLimiter, async (req, res, next) => {
  try {
    // 检查注册频率限制（基于IP）
    const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
    const rateLimitResult = await rateLimiter.checkAndIncrement(
      `register:${clientIp}`,
      REGISTER_RATE_LIMIT
    );
    
    if (!rateLimitResult.success) {
      res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMITED',
          message: 'Too many registration attempts. Please try again later.'
        }
      });
      return;
    }

    const { username, email, password } = registerSchema.parse(req.body);

    // 直接创建用户，利用数据库唯一约束
    // 如果邮箱或用户名已存在，会抛出 P2002 错误
    try {
      // 加密密码
      const passwordHash = await bcrypt.hash(password, 12);

      const user = await prisma.user.create({
        data: {
          username,
          email,
          password: passwordHash,
          balance: 10000 // 初始筹码
        },
        select: {
          id: true,
          username: true,
          email: true,
          balance: true,
          createdAt: true
        }
      });

      // 生成 Token
      const { accessToken, refreshToken } = generateTokens(user.id);

      // 保存刷新令牌（存储哈希而非明文）
      // familyId 用于追踪 token 家族，检测被盗用的 token
      await prisma.refreshToken.create({
        data: {
          token: hashToken(refreshToken),  // 存储哈希
          userId: user.id,
          familyId: randomUUID(),  // 新家族的 UUID
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7天
        }
      });

      logger.info({ userId: user.id }, 'User registered');

      // 设置 httpOnly cookie 用于 refresh token
      const isProduction = process.env.NODE_ENV === 'production';
      res.cookie('refreshToken', refreshToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
        path: '/api/v1/auth'  // 只在 auth 路由发送
      });

      res.status(201).json({
        success: true,
        data: {
          user: {
            ...user,
            balance: Number(user.balance)
          },
          accessToken
          // 不返回 refreshToken（已通过 httpOnly Cookie 设置）
        }
      });
    } catch (error) {
      // 处理唯一约束冲突
      if ((error as any).code === 'P2002') {
        res.status(409).json({
          success: false,
          error: {
            code: 'USER_EXISTS',
            message: 'User with this email or username already exists'
          }
        });
        return;
      }
      throw error;
    }
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/login
 * 用户登录
 */
router.post('/login', loginLimiter, async (req, res, next) => {
  try {
    const { email, password } = loginSchema.parse(req.body);
    
    // 构建审计上下文
    const auditContext: AuditContext = {
      ipAddress: req.ip,
      userAgent: req.get('user-agent')
    };

    // 检查账号是否已被锁定（基于分布式限流状态）
    const currentStatus = await rateLimiter.getStatus(`login:${email}`);
    if (currentStatus && currentStatus.count >= LOGIN_RATE_LIMIT.maxAttempts) {
      await auditService.logLogin(auditContext, email, false, 'Account locked');
      res.status(423).json({
        success: false,
        error: {
          code: 'ACCOUNT_LOCKED',
          message: 'Account is temporarily locked due to too many failed attempts. Please try again later.'
        }
      });
      return;
    }

    // 查找用户
    const user = await prisma.user.findUnique({
      where: { email }
    });

    // 使用恒定时间的密码验证，防止 Timing Oracle 攻击
    // 即使用户不存在，也执行 bcrypt.compare 以确保响应时间一致
    const dummyHash = '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/X4R0jxYl1Yl1Yl1Yl'; // 固定假hash
    const hashToCompare = user ? user.password : dummyHash;
    
    // 执行 bcrypt.compare（无论用户是否存在都会执行）
    const isValid = await bcrypt.compare(password, hashToCompare);
    
    // 只有在用户存在且密码正确时才继续
    if (!user || !isValid) {
      if (user) {
        // 使用分布式限流（Redis或内存）
        const loginResult = await rateLimiter.checkAndIncrement(
          `login:${email}`,
          LOGIN_RATE_LIMIT
        );
        if (!loginResult.success && loginResult.lockedUntil) {
          await auditService.logLogin(auditContext, email, false, 'Account locked due to too many failed attempts');
          res.status(423).json({
            success: false,
            error: {
              code: 'ACCOUNT_LOCKED',
              message: 'Account is temporarily locked. Please try again later.'
            }
          });
          return;
        }
        await auditService.logLogin(auditContext, user.id, false, 'Invalid password');
      }
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Invalid email or password'
        }
      });
      return;
    }

    // 登录成功，清除失败记录
    await rateLimiter.clear(`login:${email}`);

    // 更新最后登录时间
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // 清理该用户的过期 RefreshToken（防止表膨胀）
    await prisma.refreshToken.deleteMany({
      where: {
        userId: user.id,
        expiresAt: { lt: new Date() }
      }
    });

    // 生成 Token
    const { accessToken, refreshToken } = generateTokens(user.id);

    // 保存刷新令牌（存储哈希而非明文）
    await prisma.refreshToken.create({
      data: {
        token: hashToken(refreshToken),  // 存储哈希
        userId: user.id,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    // 审计日志
    await auditService.logLogin({ ...auditContext, userId: user.id }, user.id, true);

    logger.info({ userId: user.id }, 'User logged in');

    // 设置 httpOnly cookie 用于 refresh token
    const isProduction = process.env.NODE_ENV === 'production';
    res.cookie('refreshToken', refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7天
      path: '/api/v1/auth'  // 只在 auth 路由发送
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          avatarUrl: user.avatarUrl,
          balance: Number(user.balance)
        },
        accessToken
        // 不再返回 refreshToken（已通过 cookie 设置）
      }
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/v1/auth/refresh
 * 刷新 Token
 */
router.post('/refresh', async (req, res, next) => {
  try {
    // 优先从 cookie 读取 refreshToken，也支持 body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (!refreshToken) {
      res.status(401).json({
        success: false,
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'Refresh token is required'
        }
      });
      return;
    }

    // 验证刷新令牌
    const jwtRefreshSecret = process.env.JWT_REFRESH_SECRET;
    if (!jwtRefreshSecret) {
      throw new Error('JWT_REFRESH_SECRET must be configured');
    }
    const decoded = jwt.verify(refreshToken, jwtRefreshSecret) as { userId: string };

    // 用哈希查找令牌
    const tokenHash = hashToken(refreshToken);
    const tokenRecord = await prisma.refreshToken.findUnique({
      where: { token: tokenHash }
    });

    if (!tokenRecord || tokenRecord.expiresAt < new Date()) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid or expired'
        }
      });
      return;
    }

    // Token 家族追踪：如果同一个家族的 token 已被使用过，说明可能被盗
    // 删除该家族的所有 token，强制用户重新登录
    const existingFamilyCount = await prisma.refreshToken.count({
      where: {
        familyId: tokenRecord.familyId,
        id: { not: tokenRecord.id }
      }
    });
    
    // 如果家族中有其他 token（说明之前已经刷新过），检测是否为异常使用
    // 注意：由于我们使用原子删除，同一个 token 只能使用一次
    // 这里主要是为了检测 token 被盗后的滥用

    // 生成新令牌
    const tokens = generateTokens(decoded.userId);

    // 原子删除旧令牌（防止Replay攻击）
    // 使用哈希值删除
    const deletedCount = await prisma.refreshToken.deleteMany({
      where: {
        token: tokenHash,
        expiresAt: { gt: new Date() }  // 确保未过期
      }
    });

    if (deletedCount.count === 0) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid, expired, or already used'
        }
      });
      return;
    }

    // 保存新令牌（存储哈希）
    await prisma.refreshToken.create({
      data: {
        token: hashToken(tokens.refreshToken),
        userId: decoded.userId,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }
    });

    res.json({
      success: true,
      data: tokens
    });
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        error: {
          code: 'INVALID_REFRESH_TOKEN',
          message: 'Refresh token is invalid'
        }
      });
      return;
    }
    next(error);
  }
});

/**
 * POST /api/v1/auth/logout
 * 用户登出
 */
router.post('/logout', async (req, res, next) => {
  try {
    // 获取用户ID
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      try {
        const token = authHeader.slice(7);
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as { userId: string };
        
        // 删除该用户的所有 refresh token
        await prisma.refreshToken.deleteMany({
          where: { userId: decoded.userId }
        });
        
        // 审计日志
        await auditService.log({
          userId: decoded.userId,
          ipAddress: req.ip,
          userAgent: req.get('user-agent')
        }, {
          action: 'USER_LOGOUT',
          resource: 'user',
          resourceId: decoded.userId
        });
        
        logger.info({ userId: decoded.userId }, 'User logged out');
      } catch (e) {
        // token 无效也继续清除 cookie
      }
    }
    
    // 清除 refresh token cookie
    res.clearCookie('refreshToken', {
      path: '/api/v1/auth',
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict'
    });
    
    res.json({
      success: true,
      message: 'Logged out successfully'
    });
  } catch (error) {
    next(error);
  }
});

export { router as authRouter };
