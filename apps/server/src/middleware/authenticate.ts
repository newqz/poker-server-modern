/**
 * 认证中间件
 * @module middleware/authenticate
 */

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { logger } from '../utils/logger';

export interface AuthenticatedRequest extends Request {
  user?: { userId: string; type: string };
}

/**
 * JWT 认证中间件
 * 验证请求中的 JWT token 并注入用户信息
 */
export function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      success: false,
      error: {
        code: 'NO_TOKEN',
        message: 'Authorization header required'
      }
    });
    return;
  }
  
  const token = authHeader.slice(7);
  const jwtSecret = process.env.JWT_SECRET;
  
  if (!jwtSecret) {
    logger.error('JWT_SECRET not configured');
    res.status(500).json({
      success: false,
      error: {
        code: 'SERVER_ERROR',
        message: 'Server misconfiguration'
      }
    });
    return;
  }
  
  try {
    const decoded = jwt.verify(token, jwtSecret) as { userId: string; type: string };
    req.user = { userId: decoded.userId, type: decoded.type };
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token'
      }
    });
  }
}
