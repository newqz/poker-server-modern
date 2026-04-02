/**
 * 路由配置
 * @module routes/index
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import type { Application } from 'express';
import { authRouter } from './auth';
import { roomRouter } from './room';
import { gameRouter } from './game';
import { userRouter } from './user';
import { adminRouter } from './admin';
import { authenticate } from '../middleware/authenticate';
import { verifySignature } from '../middleware/requestSignature';
import {
  defaultRateLimit,
  authRateLimit,
  gameActionRateLimit,
  searchRateLimit,
  strictRateLimit
} from '../middleware/rateLimit';

export function setupRoutes(app: Application): void {
  // API 版本前缀
  const API_PREFIX = '/api/v1';

  // 全局限流 - 默认
  app.use(`${API_PREFIX}`, defaultRateLimit);

  // 认证路由 - 使用更严格的限流
  app.use(`${API_PREFIX}/auth`, authRateLimit, authRouter);

  // 房间路由 - 需要认证
  app.use(`${API_PREFIX}/rooms`, authenticate, roomRouter);

  // 游戏路由 - 需要认证 + 游戏限流
  app.use(`${API_PREFIX}/games`, gameActionRateLimit, authenticate, gameRouter);

  // 用户路由 - 需要认证
  app.use(`${API_PREFIX}/users`, authenticate, userRouter);

  // 管理后台路由 - 需要认证 + 严格限流
  app.use(`${API_PREFIX}/admin`, strictRateLimit, authenticate, adminRouter);

  // 404 处理 - 不暴露内部路径信息
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found'
      }
    });
  });
}
