/**
 * 房间 E2E 测试
 * @module e2e/room.spec
 */

import { test, expect } from './test-setup';

test.describe('房间管理', () => {
  test('创建房间', async ({ user, request, apiUrl }) => {
    const response = await request.post(`${apiUrl}/rooms`, {
      data: {
        name: 'Test Room',
        maxPlayers: 6,
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 1000,
        maxBuyIn: 5000,
        isPrivate: false
      },
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(data.data.room.name).toBe('Test Room');
    expect(data.data.room.code).toBeDefined();
    expect(data.data.room.maxPlayers).toBe(6);
  });

  test('获取房间列表', async ({ user, request, apiUrl }) => {
    const response = await request.get(`${apiUrl}/rooms`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`
      }
    });

    expect(response.ok()).toBeTruthy();
    const data = await response.json();
    expect(data.success).toBe(true);
    expect(Array.isArray(data.data.rooms)).toBeTruthy();
  });

  test('加入房间', async ({ user, request, apiUrl }) => {
    // 先创建一个房间
    const createResponse = await request.post(`${apiUrl}/rooms`, {
      data: {
        name: 'Join Test Room',
        maxPlayers: 6,
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 1000,
        maxBuyIn: 5000,
        isPrivate: false
      },
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const createData = await createResponse.json();
    const roomCode = createData.data.room.code;

    // 加入房间
    const joinResponse = await request.post(`${apiUrl}/rooms/${roomCode}/join`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(joinResponse.ok()).toBeTruthy();
    const joinData = await joinResponse.json();
    expect(joinData.success).toBe(true);
    expect(joinData.data.seatNumber).toBeDefined();
  });

  test('离开房间', async ({ user, request, apiUrl }) => {
    // 先创建并加入房间
    const createResponse = await request.post(`${apiUrl}/rooms`, {
      data: {
        name: 'Leave Test Room',
        maxPlayers: 6,
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 1000,
        maxBuyIn: 5000,
        isPrivate: false
      },
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const createData = await createResponse.json();
    const roomId = createData.data.room.id;

    // 加入房间
    await request.post(`${apiUrl}/rooms/${createData.data.room.code}/join`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 离开房间
    const leaveResponse = await request.post(`${apiUrl}/rooms/${roomId}/leave`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(leaveResponse.ok()).toBeTruthy();
    const leaveData = await leaveResponse.json();
    expect(leaveData.success).toBe(true);
  });
});

test.describe('房间游戏流程', () => {
  test('准备开始游戏', async ({ user, request, apiUrl }) => {
    // 创建并加入房间
    const createResponse = await request.post(`${apiUrl}/rooms`, {
      data: {
        name: 'Game Start Room',
        maxPlayers: 6,
        smallBlind: 10,
        bigBlind: 20,
        minBuyIn: 1000,
        maxBuyIn: 5000
      },
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    const createData = await createResponse.json();
    const roomId = createData.data.room.id;

    // 加入房间
    await request.post(`${apiUrl}/rooms/${createData.data.room.code}/join`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    // 准备
    const readyResponse = await request.post(`${apiUrl}/games/${roomId}/ready`, {
      headers: {
        'Authorization': `Bearer ${user.accessToken}`,
        'Content-Type': 'application/json'
      }
    });

    expect(readyResponse.ok()).toBeTruthy();
    const readyData = await readyResponse.json();
    expect(readyData.success).toBe(true);
  });
});
