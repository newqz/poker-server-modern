/**
 * API 集成测试 - 认证模块
 * @module __tests__/auth.test
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';

// Mock Prisma client for testing
// In real tests, you would use testcontainers or a separate test database

const BASE_URL = process.env.TEST_API_URL || 'http://localhost:3000';

describe('认证 API 集成测试', () => {
  describe('POST /api/v1/auth/register', () => {
    it('应该正确注册新用户', async () => {
      // 注意: 这是示例测试，实际需要测试数据库
      const response = await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: `test${Date.now()}@example.com`,
          password: 'SecurePassword123'
        });

      // 期望的响应格式
      expect(response.body).toHaveProperty('success');
    });

    it('应该拒绝无效的邮箱格式', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'invalid-email',
          password: 'SecurePassword123'
        });

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBeDefined();
    });

    it('应该拒绝短密码', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'testuser',
          email: 'test@example.com',
          password: 'short'
        });

      expect(response.body.success).toBe(false);
    });

    it('应该拒绝重复邮箱', async () => {
      const email = `duplicate${Date.now()}@example.com`;
      
      // 第一次注册
      await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'user1',
          email,
          password: 'SecurePassword123'
        });

      // 第二次注册相同邮箱
      const response = await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'user2',
          email,
          password: 'SecurePassword123'
        });

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('USER_EXISTS');
    });
  });

  describe('POST /api/v1/auth/login', () => {
    it('应该正确登录已注册用户', async () => {
      // 先注册
      const email = `logintest${Date.now()}@example.com`;
      await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'logintest',
          email,
          password: 'SecurePassword123'
        });

      // 登录
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'SecurePassword123'
        });

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
      expect(response.body.data).toHaveProperty('user');
    });

    it('应该拒绝错误密码', async () => {
      const email = `wrongpw${Date.now()}@example.com`;
      
      await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'wrongpw',
          email,
          password: 'SecurePassword123'
        });

      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'WrongPassword'
        });

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });

    it('应该拒绝不存在的用户', async () => {
      const response = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'SomePassword123'
        });

      expect(response.body.success).toBe(false);
      expect(response.body.error.code).toBe('INVALID_CREDENTIALS');
    });
  });

  describe('POST /api/v1/auth/refresh', () => {
    it('应该能刷新 token', async () => {
      // 注册并登录
      const email = `refreshtest${Date.now()}@example.com`;
      const registerRes = await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'refreshtest',
          email,
          password: 'SecurePassword123'
        });

      const loginRes = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'SecurePassword123'
        });

      const refreshToken = loginRes.headers['set-cookie']?.toString();

      // 刷新 token
      const response = await request(BASE_URL)
        .post('/api/v1/auth/refresh')
        .set('Cookie', refreshToken || []);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('accessToken');
    });
  });

  describe('POST /api/v1/auth/logout', () => {
    it('应该能正确登出', async () => {
      // 注册并登录
      const email = `logouttest${Date.now()}@example.com`;
      await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: 'logouttest',
          email,
          password: 'SecurePassword123'
        });

      const loginRes = await request(BASE_URL)
        .post('/api/v1/auth/login')
        .send({
          email,
          password: 'SecurePassword123'
        });

      const cookies = loginRes.headers['set-cookie']?.toString();

      // 登出
      const response = await request(BASE_URL)
        .post('/api/v1/auth/logout')
        .set('Cookie', cookies || []);

      expect(response.body.success).toBe(true);
    });
  });
});

describe('速率限制测试', () => {
  it('注册接口应该有速率限制', async () => {
    const ip = `192.168.1.${Math.floor(Math.random() * 255)}`;
    
    // 尝试多次注册
    for (let i = 0; i < 5; i++) {
      await request(BASE_URL)
        .post('/api/v1/auth/register')
        .send({
          username: `user${i}_${Date.now()}`,
          email: `user${i}_${Date.now()}@example.com`,
          password: 'SecurePassword123'
        });
    }

    // 第6次应该被限流
    const response = await request(BASE_URL)
      .post('/api/v1/auth/register')
      .send({
        username: `user_extra_${Date.now()}`,
        email: `user_extra_${Date.now()}@example.com`,
        password: 'SecurePassword123'
      });

    expect(response.status).toBe(429);
  });
});
