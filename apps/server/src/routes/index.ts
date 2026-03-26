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
import { authenticate } from '../middleware/authenticate';
import { verifySignature } from '../middleware/requestSignature';

export function setupRoutes(app: Application): void {
  // API 版本前缀
  const API_PREFIX = '/api/v1';

  // 健康检查 (已在 server.ts 中定义，这里不再重复)
  
  // 认证路由 - 无需认证，但有速率限制（在 auth.ts 中实现）
  app.use(`${API_PREFIX}/auth`, authRouter);
  
  // 房间路由 - 需要认证 + 可选签名验证
  app.use(`${API_PREFIX}/rooms`, authenticate, roomRouter);
  
  // 游戏路由 - 需要认证
  app.use(`${API_PREFIX}/games`, authenticate, gameRouter);
  
  // 用户路由 - 需要认证
  app.use(`${API_PREFIX}/users`, authenticate, userRouter);

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
