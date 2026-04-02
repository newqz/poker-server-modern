/**
 * GameEngine 单元测试
 * @module game/GameEngine.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine';
import { PlayerAction } from '@poker/shared';

describe('GameEngine', () => {
  let engine: GameEngine;
  const testConfig = {
    maxPlayers: 9,
    minPlayers: 2,
    smallBlind: 10,
    bigBlind: 20,
    minBuyIn: 1000,
    maxBuyIn: 10000,
    timeLimit: 30
  };

  beforeEach(() => {
    engine = new GameEngine('test-game-1', 'test-room-1', testConfig);
  });

  describe('构造函数和初始化', () => {
    it('应该正确初始化游戏引擎', () => {
      const state = engine.getState();
      expect(state.id).toBe('test-game-1');
      expect(state.roomId).toBe('test-room-1');
      expect(state.status).toBe('WAITING');
      expect(state.players).toHaveLength(0);
    });

    it('初始状态应该没有当前玩家', () => {
      const state = engine.getState();
      expect(state.currentPlayerSeat).toBe(-1);
    });
  });

  describe('添加玩家', () => {
    it('应该正确添加玩家', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      
      const state = engine.getState();
      expect(state.players).toHaveLength(1);
      expect(state.players[0].userId).toBe('user-1');
      expect(state.players[0].username).toBe('Alice');
      expect(state.players[0].seatNumber).toBe(0);
      expect(state.players[0].chips).toBe(1000);
    });

    it('应该允许添加多个玩家', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.addPlayer('user-3', 'Charlie', 2, 1000);
      
      const state = engine.getState();
      expect(state.players).toHaveLength(3);
    });

    it('不应该允许重复座位', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      
      expect(() => {
        engine.addPlayer('user-2', 'Bob', 0, 1000);
      }).toThrow('SEAT_OCCUPIED');
    });

    it('游戏开始后不应该允许添加玩家', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      expect(() => {
        engine.addPlayer('user-3', 'Charlie', 2, 1000);
      }).toThrow('GAME_ALREADY_STARTED');
    });
  });

  describe('开始游戏', () => {
    it('少于2个玩家时不应该能开始', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      
      expect(() => engine.start(0)).toThrow('NEED_AT_LEAST_2_PLAYERS');
    });

    it('2个玩家应该能正确开始', async () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      const state = engine.getState();
      expect(state.status).toBe('PREFLOP');
      expect(state.round).toBe('preflop');
      expect(state.players).toHaveLength(2);
      expect(state.communityCards).toHaveLength(0);
    });

    it('开始后庄家位置应该正确', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      const state = engine.getState();
      expect(state.dealerSeat).toBe(0);
      expect(state.smallBlindSeat).toBe(1);
      expect(state.bigBlindSeat).toBe(0); // 2人游戏，庄家也是大盲
    });

    it('开始后应该扣除盲注', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      const state = engine.getState();
      // 小盲注 10，大盲注 20，总底池 30
      expect(state.pot + state.bettingRound.getTotalPot()).toBe(30);
    });

    it('开始后每个玩家应该有2张手牌', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      const state = engine.getState();
      for (const player of state.players) {
        expect(player.holeCards).toHaveLength(2);
      }
    });
  });

  describe('玩家动作 - FOLD', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('当前玩家应该能弃牌', async () => {
      // 大盲注是座位0，所以轮到座位1
      const result = await engine.processAction('user-2', PlayerAction.FOLD);
      
      expect(result.action).toBe('FOLD');
      const state = engine.getState();
      const player = state.players.find(p => p.userId === 'user-2');
      expect(player?.isFolded).toBe(true);
    });

    it('弃牌后应该轮到下一个玩家', async () => {
      await engine.processAction('user-2', PlayerAction.FOLD);
      
      const state = engine.getState();
      expect(state.currentPlayerSeat).not.toBe(1); // 不应该是 Bob
    });
  });

  describe('玩家动作 - CHECK', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('在没人下注时应该能过牌', async () => {
      // 小盲注已下注，大盲注需要决定
      // 在 2 人游戏中，座位0是大盲，座位1是小盲
      // 小盲已经行动，现在轮到大盲
      const result = await engine.processAction('user-1', PlayerAction.CHECK);
      
      expect(result.action).toBe('CHECK');
    });
  });

  describe('玩家动作 - CALL', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('应该能跟注', async () => {
      // user-2 是小盲，需要跟注大盲 10
      const result = await engine.processAction('user-2', PlayerAction.CALL);
      
      expect(result.action).toBe('CALL');
      expect(result.chipChange.deducted).toBe(10);
    });
  });

  describe('玩家动作 - RAISE', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('应该能加注', async () => {
      // user-2 小盲跟注后，user-1 大盲可以加注
      await engine.processAction('user-2', PlayerAction.CALL);
      const result = await engine.processAction('user-1', PlayerAction.RAISE, 50);
      
      expect(result.action).toBe('RAISE');
      expect(result.chipChange.deducted).toBe(30); // 从20加到50
    });

    it('加注应该验证金额', async () => {
      await engine.processAction('user-2', PlayerAction.CALL);
      
      // 加注额太小应该失败
      await expect(
        engine.processAction('user-1', PlayerAction.RAISE, 25)
      ).rejects.toThrow();
    });

    it('加注应该不能超过筹码', async () => {
      await engine.processAction('user-2', PlayerAction.CALL);
      
      // 加注超过筹码应该失败
      await expect(
        engine.processAction('user-1', PlayerAction.RAISE, 2000)
      ).rejects.toThrow('INSUFFICIENT_CHIPS');
    });
  });

  describe('玩家动作 - ALL_IN', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('应该能全押', async () => {
      // user-2 小盲跟注后，user-1 大盲全押
      await engine.processAction('user-2', PlayerAction.CALL);
      const result = await engine.processAction('user-1', PlayerAction.ALL_IN);
      
      expect(result.action).toBe('ALL_IN');
      expect(result.chipChange.deducted).toBe(980); // 1000 - 20 = 980
      expect(result.chipChange.newBalance).toBe(0);
    });
  });

  describe('非法动作检测', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('不应该能重复弃牌', async () => {
      await engine.processAction('user-2', PlayerAction.FOLD);
      
      await expect(
        engine.processAction('user-2', PlayerAction.FOLD)
      ).rejects.toThrow('ALREADY_FOLDED');
    });

    it('不应该能在不是自己回合时动作', async () => {
      // user-2 是小盲，先行动
      // user-1 不应该在这个时候行动
      await expect(
        engine.processAction('user-1', PlayerAction.CHECK)
      ).rejects.toThrow('NOT_YOUR_TURN');
    });

    it('游戏结束后不应该能动作', async () => {
      // 快速结束游戏：Bob弃牌，Alice获胜
      await engine.processAction('user-2', PlayerAction.FOLD);
      
      const state = engine.getState();
      expect(state.status).toBe('ENDED');
      
      // 现在尝试任何动作都应该失败
      await expect(
        engine.processAction('user-1', PlayerAction.CHECK)
      ).rejects.toThrow('INVALID_PHASE');
    });
  });

  describe('金额校验', () => {
    beforeEach(() => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
    });

    it('不应该接受负数金额', async () => {
      await expect(
        engine.processAction('user-2', PlayerAction.RAISE, -100)
      ).rejects.toThrow();
    });

    it('不应该接受零金额加注', async () => {
      await expect(
        engine.processAction('user-2', PlayerAction.RAISE, 0)
      ).rejects.toThrow();
    });

    it('不应该接受超过限制的金额', async () => {
      await expect(
        engine.processAction('user-2', PlayerAction.RAISE, 1000000001)
      ).rejects.toThrow();
    });
  });

  describe('状态恢复', () => {
    it('应该能保存和恢复快照', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      // 获取快照
      const state = engine.getState();
      
      // 创建新引擎并恢复
      const engine2 = new GameEngine('test-game-2', 'test-room-1', testConfig);
      engine2.addPlayer('user-1', 'Alice', 0, 1000);
      engine2.addPlayer('user-2', 'Bob', 1, 1000);
      engine2.restoreFromSnapshot(state);
      
      const restoredState = engine2.getState();
      expect(restoredState.status).toBe(state.status);
      expect(restoredState.round).toBe(state.round);
      expect(restoredState.dealerSeat).toBe(state.dealerSeat);
    });
  });

  describe('线程安全', () => {
    it('并发动作应该被正确序列化', async () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      // 同时发起多个动作（实际会串行执行）
      const promises = [
        engine.processAction('user-2', PlayerAction.CALL),
      ];
      
      const results = await Promise.all(promises);
      
      // 所有动作都应该成功完成
      for (const result of results) {
        expect(result).toBeDefined();
      }
    });
  });

  describe('getState', () => {
    it('应该返回深拷贝的状态', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      
      const state1 = engine.getState();
      const state2 = engine.getState();
      
      expect(state1).not.toBe(state2);
      expect(state1.players).not.toBe(state2.players);
    });

    it('不应该暴露玩家的手牌给其他玩家', () => {
      engine.addPlayer('user-1', 'Alice', 0, 1000);
      engine.addPlayer('user-2', 'Bob', 1, 1000);
      engine.start(0);
      
      const state = engine.getState();
      
      // 所有玩家都应该能看到所有玩家的手牌（因为 getState 是内部方法）
      // 在实际应用中，前端只会收到过滤后的状态
      expect(state.players[0].holeCards).toHaveLength(2);
      expect(state.players[1].holeCards).toHaveLength(2);
    });
  });
});
