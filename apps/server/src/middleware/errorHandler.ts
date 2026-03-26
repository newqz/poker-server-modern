/**
 * 错误处理中间件
 * @module middleware/errorHandler
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import type { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
  // 敏感错误不应在响应中暴露详情
  exposeDetails?: boolean;
}

// 不暴露详情的错误码
const SAFE_ERROR_CODES = new Set([
  'INVALID_CREDENTIALS',
  'ACCOUNT_LOCKED',
  'NO_TOKEN',
  'INVALID_TOKEN',
  'ROOM_NOT_FOUND',
  'USER_NOT_FOUND',
  'INVALID_ACTION'
]);

export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const errorCode = err.code || 'INTERNAL_ERROR';
  const isProduction = process.env.NODE_ENV === 'production';
  
  // 日志记录：错误详情仅在非生产环境记录 stack
  const logData = {
    code: errorCode,
    statusCode,
    path: req.path,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('user-agent')
  };
  
  if (isProduction) {
    // 生产环境只记录错误消息，不记录堆栈
    logger.error({ ...logData, error: err.message }, 'Request error');
  } else {
    // 开发环境记录完整信息
    logger.error({ ...logData, error: err.message, stack: err.stack }, 'Request error');
  }

  // 决定响应消息
  let message: string;
  if (isProduction && !err.exposeDetails && !SAFE_ERROR_CODES.has(errorCode)) {
    // 生产环境且非安全错误码，返回通用消息
    message = 'An error occurred. Please try again later.';
  } else {
    // 开发环境或安全错误码，可以返回原始消息
    message = err.message;
  }

  res.status(statusCode).json({
    success: false,
    error: {
      code: errorCode,
      message
    }
  });
}
