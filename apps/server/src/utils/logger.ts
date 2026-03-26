/**
 * 日志工具
 * @module utils/logger
 * @author ARCH
 * @date 2026-03-26
 * @task BE-003
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV !== 'production';

export const logger = pino({
  level: process.env.LOG_LEVEL || (isDevelopment ? 'debug' : 'info'),
  transport: isDevelopment
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname'
        }
      }
    : undefined,
  base: {
    pid: process.pid,
    env: process.env.NODE_ENV
  }
});
