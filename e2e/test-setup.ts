/**
 * E2E 测试配置
 * @module e2e/test-setup
 */

import { test as base } from '@playwright/test';

interface User {
  id: string;
  username: string;
  email: string;
  password: string;
  accessToken: string;
}

// 扩展 test 类型
export const test = base.extend<{
  user: User;
  apiUrl: string;
}>({
  // 默认 API URL
  apiUrl: process.env.E2E_API_URL || 'http://localhost:3000/api/v1',
  
  // 创建测试用户
  user: async ({ request, apiUrl }, use) => {
    const timestamp = Date.now();
    const userData = {
      username: `testuser_${timestamp}`,
      email: `test_${timestamp}@example.com`,
      password: 'TestPassword123'
    };

    // 注册用户
    const registerResponse = await request.post(`${apiUrl}/auth/register`, {
      data: userData,
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!registerResponse.ok()) {
      throw new Error(`Failed to create test user: ${registerResponse.status()}`);
    }

    const registerData = await registerResponse.json();
    const user: User = {
      ...userData,
      id: registerData.data.user.id,
      accessToken: registerData.data.accessToken
    };

    await use(user);

    // 清理：尝试删除用户（如果后端支持）
    try {
      await request.delete(`${apiUrl}/users/me`, {
        headers: {
          'Authorization': `Bearer ${user.accessToken}`
        }
      });
    } catch {
      // 忽略清理错误
    }
  }
});

// 导出 expect 扩展
export { expect } from '@playwright/test';
