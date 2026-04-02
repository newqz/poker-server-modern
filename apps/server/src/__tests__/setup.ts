/**
 * 测试环境设置
 * @module __tests__/setup
 */

import { beforeAll, afterAll } from 'vitest';

// 全局测试设置
beforeAll(() => {
  // 设置测试环境变量
  process.env.NODE_ENV = 'test';
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || 'postgresql://test:test@localhost:5432/poker_test';
  process.env.REDIS_URL = process.env.TEST_REDIS_URL || 'redis://localhost:6379';
  process.env.JWT_SECRET = 'test-jwt-secret-at-least-32-chars-long';
  process.env.JWT_REFRESH_SECRET = 'test-jwt-refresh-secret-at-least-32-chars';
});

afterAll(() => {
  // 清理测试数据
});
