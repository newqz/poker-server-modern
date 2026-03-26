/**
 * 服务器入口文件
 * @module index
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import dotenv from 'dotenv';
dotenv.config();

import { createServer } from './server';
import { logger } from './utils/logger';

const PORT = process.env.PORT || 3000;

async function main() {
  try {
    const { app, server } = await createServer();
    
    server.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    });

    // 优雅关闭
    process.on('SIGTERM', () => {
      logger.info('SIGTERM received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGINT', () => {
      logger.info('SIGINT received, shutting down gracefully');
      server.close(() => {
        logger.info('Server closed');
        process.exit(0);
      });
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

main();
