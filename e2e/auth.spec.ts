/**
 * 认证 E2E 测试
 * @module e2e/auth.spec
 */

import { test, expect } from './test-setup';

test.describe('认证流程', () => {
  test('注册新用户', async ({ request, apiUrl }) => {
    const timestamp = Date.now();
    const userData = {
      username: `newuser_${timestamp}`,
      email: `newuser_${timestamp}@example.com`,
      password: 'SecurePassword123'
    };

    const response = await request.post(`${apiUrl}/auth/register`, {
      data: userData,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.username).toBe(userData.username);
    expect(data.data.user.email).toBe(userData.email);
    expect(data.data.accessToken).toBeDefined();
  });

  test('登录已有用户', async ({ user, request, apiUrl }) => {
    const response = await request.post(`${apiUrl}/auth/login`, {
      data: {
        email: user.email,
        password: user.password
      },
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.email).toBe(user.email);
    expect(data.data.accessToken).toBeDefined();
  });

  test('登录失败 - 错误密码', async ({ user, request, apiUrl }) => {
    const response = await request.post(`${apiUrl}/auth/login`, {
      data: {
        email: user.email,
        password: 'WrongPassword'
      }
    });

    expect(response.status()).toBe(401);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('INVALID_CREDENTIALS');
  });

  test('注册失败 - 重复邮箱', async ({ user, request, apiUrl }) => {
    const response = await request.post(`${apiUrl}/auth/register`, {
      data: {
        username: 'anotheruser',
        email: user.email,  // 使用已存在的邮箱
        password: 'Password123'
      }
    });

    expect(response.status()).toBe(409);
    const data = await response.json();
    expect(data.success).toBe(false);
    expect(data.error.code).toBe('USER_EXISTS');
  });

  test('Token 刷新', async ({ user, request, apiUrl }) => {
    // 刷新 token
    const response = await request.post(`${apiUrl}/auth/refresh`, {
      headers: {
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.accessToken).toBeDefined();
  });

  test('登出', async ({ user, request, apiUrl }) => {
    const response = await request.post(`${apiUrl}/auth/logout`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
  });
});

test.describe('用户信息', () => {
  test('获取当前用户信息', async ({ user, request, apiUrl }) => {
    const response = await request.get(`${apiUrl}/users/me`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.user.id).toBe(user.id);
    expect(data.data.user.email).toBe(user.email);
  });

  test('未授权访问', async ({ request, apiUrl }) => {
    const response = await request.get(`${apiUrl}/users/me`);

    expect(response.status()).toBe(401);
  });
});
