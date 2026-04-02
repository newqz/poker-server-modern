/**
 * 游戏流程集成测试
 * @module game/GameFlow.test
 * @description 测试完整的游戏流程场景
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { GameEngine } from './GameEngine';
import { PlayerAction } from '@poker/shared';

describe('游戏流程集成测试', () => {
  const testConfig = {
    maxPlayers: 9,
    minPlayers: 2,
    smallBlind: 10,
    bigBlind: 20,
    minBuyIn: 1000,
    maxBuyIn: 10000,
    timeLimit: 30
  };

  /**
   * 场景1: 最简单的游戏 - 2人局，一人弃牌即结束
   */
  describe('场景1: 2人快速结束', () => {
    it('Bob直接弃牌，Alice获胜', async () => {
      const engine = new GameEngine('game-1', 'room-1', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.start(0);
      
      // Bob 弃牌
      const result = await engine.processAction('bob', PlayerAction.FOLD);
      
      expect(result.newState.status).toBe('ENDED');
      expect(result.newState.winners).toBeDefined();
      expect(result.newState.winners![0].playerId).toBe('alice');
    });
  });

  /**
   * 场景2: 3人局，完整翻牌前流程
   */
  describe('场景2: 3人翻牌前下注', () => {
    it('完整翻牌前下注轮', async () => {
      const engine = new GameEngine('game-2', 'room-2', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.addPlayer('charlie', 'Charlie', 2, 1000);
      engine.start(0);
      
      // 位置: dealer=0, sb=1, bb=2
      // 翻牌前从UTG开始 (bb+1 = 0 = Alice)
      // Alice (UTG) 加注
      let result = await engine.processAction('alice', PlayerAction.RAISE, 60);
      expect(result.newState.status).toBe('PREFLOP');
      
      // Bob 跟注
      result = await engine.processAction('bob', PlayerAction.CALL);
      
      // Charlie (BB) 加注
      result = await engine.processAction('charlie', PlayerAction.RAISE, 100);
      
      // Alice 4-bet
      result = await engine.processAction('alice', PlayerAction.RAISE, 200);
      
      // Bob 弃牌
      result = await engine.processAction('bob', PlayerAction.FOLD);
      
      // Charlie 跟注
      result = await engine.processAction('charlie', PlayerAction.CALL);
      
      // 翻牌前结束，进入FLOP
      expect(result.newState.status).toBe('FLOP');
      expect(result.newState.round).toBe('flop');
      expect(result.newState.communityCards).toHaveLength(3);
    });
  });

  /**
   * 场景3: 4人局，完整单局流程 (到摊牌)
   */
  describe('场景3: 4人局完整流程到摊牌', () => {
    it('所有玩家都跟注到河牌圈', async () => {
      const engine = new GameEngine('game-3', 'room-3', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.addPlayer('charlie', 'Charlie', 2, 1000);
      engine.addPlayer('david', 'David', 3, 1000);
      engine.start(0);
      
      // 翻牌前 - 所有人跟注
      // dealer=0, sb=1, bb=2, utg=3
      
      // David (UTG) 弃牌
      let result = await engine.processAction('david', PlayerAction.FOLD);
      
      // Alice (UTG+1) 跟注 20
      result = await engine.processAction('alice', PlayerAction.CALL);
      
      // Bob 跟注 20
      result = await engine.processAction('bob', PlayerAction.CALL);
      
      // Charlie (BB) 过牌
      result = await engine.processAction('charlie', PlayerAction.CHECK);
      
      // 小盲注 Bob 过牌
      result = await engine.processAction('bob', PlayerAction.CHECK);
      
      // Alice 过牌
      result = await engine.processAction('alice', PlayerAction.CHECK);
      
      // 进入FLOP
      expect(result.newState.status).toBe('FLOP');
      expect(result.newState.round).toBe('flop');
      
      // FLOP 圈 - 所有人过牌到摊牌
      // Charlie 过牌
      result = await engine.processAction('charlie', PlayerAction.CHECK);
      
      // Bob 过牌
      result = await engine.processAction('bob', PlayerAction.CHECK);
      
      // Alice 过牌
      result = await engine.processAction('alice', PlayerAction.CHECK);
      
      // 进入TURN
      expect(result.newState.status).toBe('TURN');
      expect(result.newState.round).toBe('turn');
      expect(result.newState.communityCards).toHaveLength(4);
      
      // TURN 圈 - 所有人过牌
      result = await engine.processAction('charlie', PlayerAction.CHECK);
      result = await engine.processAction('bob', PlayerAction.CHECK);
      result = await engine.processAction('alice', PlayerAction.CHECK);
      
      // 进入RIVER
      expect(result.newState.status).toBe('RIVER');
      expect(result.newState.round).toBe('river');
      expect(result.newState.communityCards).toHaveLength(5);
      
      // RIVER 圈 - 所有人过牌
      result = await engine.processAction('charlie', PlayerAction.CHECK);
      result = await engine.processAction('bob', PlayerAction.CHECK);
      result = await engine.processAction('alice', PlayerAction.CHECK);
      
      // 进入SHOWDOWN
      expect(result.newState.status).toBe('SHOWDOWN');
      
      // 等待结算
      result = await engine.processAction('charlie', PlayerAction.CHECK);
      
      expect(result.newState.status).toBe('ENDED');
      expect(result.newState.winners).toBeDefined();
      expect(result.newState.winners!.length).toBeGreaterThan(0);
    });
  });

  /**
   * 场景4: 全押场景
   */
  describe('场景4: 全押场景', () => {
    it('玩家全押后其他人跟注或弃牌', async () => {
      const engine = new GameEngine('game-4', 'room-4', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 500); // Bob 筹码较少
      engine.start(0);
      
      // Bob 小盲注
      // Alice 大盲注，过牌
      let result = await engine.processAction('alice', PlayerAction.CHECK);
      
      // Bob 过牌，进入翻牌
      result = await engine.processAction('bob', PlayerAction.CHECK);
      expect(result.newState.status).toBe('FLOP');
      
      // FLOP - Bob 全押
      result = await engine.processAction('bob', PlayerAction.ALL_IN);
      expect(result.chipChange.deducted).toBe(500);
      expect(result.chipChange.newBalance).toBe(0);
      
      // Alice 跟注
      result = await engine.processAction('alice', PlayerAction.CALL);
      
      // 摊牌
      expect(result.newState.status).toBe('SHOWDOWN');
    });
  });

  /**
   * 场景5: 加注场景
   */
  describe('场景5: 加注后跟注', () => {
    it('Alice加注，Bob跟注，Charlie弃牌', async () => {
      const engine = new GameEngine('game-5', 'room-5', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.addPlayer('charlie', 'Charlie', 2, 1000);
      engine.start(0);
      
      // Charlie 是 BB
      
      // Alice (UTG) 加注到 60
      let result = await engine.processAction('alice', PlayerAction.RAISE, 60);
      expect(result.chipChange.deducted).toBe(40); // 跟注20 + 额外40 = 60
      
      // Bob 弃牌
      result = await engine.processAction('bob', PlayerAction.FOLD);
      expect(result.newState.players.find(p => p.userId === 'bob')?.isFolded).toBe(true);
      
      // Charlie 跟注
      result = await engine.processAction('charlie', PlayerAction.CALL);
      
      // 翻牌前结束
      expect(result.newState.status).toBe('FLOP');
      
      // 验证底池
      const totalPot = result.newState.pot + result.newState.bettingRound.getTotalPot();
      expect(totalPot).toBe(60 + 20 + 40); // Alice 60 + Charlie 60 (包括大小盲)
    });
  });

  /**
   * 场景6: 错误动作处理
   */
  describe('场景6: 错误动作处理', () => {
    it('不应该在自己不是当前玩家时动作', async () => {
      const engine = new GameEngine('game-6', 'room-6', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.start(0);
      
      // Bob 是小盲，先行动
      // Alice (大盲) 不应该在这个时候动作
      
      await expect(
        engine.processAction('alice', PlayerAction.CHECK)
      ).rejects.toThrow('NOT_YOUR_TURN');
    });

    it('不应该在弃牌后继续动作', async () => {
      const engine = new GameEngine('game-7', 'room-7', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.start(0);
      
      // Bob 弃牌
      await engine.processAction('bob', PlayerAction.FOLD);
      
      // Bob 再次尝试动作应该失败
      await expect(
        engine.processAction('bob', PlayerAction.CHECK)
      ).rejects.toThrow('ALREADY_FOLDED');
    });

    it('不应该用超过筹码的金额加注', async () => {
      const engine = new GameEngine('game-8', 'room-8', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 100);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.start(0);
      
      // Alice 只有100筹码
      
      await expect(
        engine.processAction('alice', PlayerAction.RAISE, 200)
      ).rejects.toThrow('INSUFFICIENT_CHIPS');
    });
  });

  /**
   * 场景7: 盲注处理
   */
  describe('场景7: 盲注处理', () => {
    it('正确收取大小盲注', () => {
      const engine = new GameEngine('game-9', 'room-9', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.start(0);
      
      const state = engine.getState();
      
      // 小盲注 Bob 投入 10
      const bob = state.players.find(p => p.userId === 'bob');
      expect(bob?.chips).toBe(990); // 1000 - 10
      
      // 大盲注 Alice 投入 20
      const alice = state.players.find(p => p.userId === 'alice');
      expect(alice?.chips).toBe(980); // 1000 - 20
      
      // 底池应该包含 30
      const totalPot = state.pot + state.bettingRound.getTotalPot();
      expect(totalPot).toBe(30);
    });

    it('小筹码玩家缴纳盲注后只剩小盲注', () => {
      const engine = new GameEngine('game-10', 'room-10', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 15); // 只有15筹码
      engine.start(0);
      
      const state = engine.getState();
      
      // Bob 小盲注投入 10 (全部)
      const bob = state.players.find(p => p.userId === 'bob');
      expect(bob?.chips).toBe(5); // 15 - 10
      expect(bob?.isAllIn).toBe(false); // 还不是全押
      
      // 大盲注需要投入 20，但 Bob 只有 5
      const alice = state.players.find(p => p.userId === 'alice');
      expect(alice?.chips).toBe(980); // 1000 - 20
    });
  });

  /**
   * 场景8: 多人游戏座位验证
   */
  describe('场景8: 座位和轮转', () => {
    it('正确识别当前玩家', async () => {
      const engine = new GameEngine('game-11', 'room-11', testConfig);
      
      engine.addPlayer('alice', 'Alice', 0, 1000);
      engine.addPlayer('bob', 'Bob', 1, 1000);
      engine.addPlayer('charlie', 'Charlie', 2, 1000);
      engine.start(0);
      
      // dealer=0, sb=1, bb=2, currentPlayer=0 (Alice - UTG)
      let state = engine.getState();
      expect(state.currentPlayerSeat).toBe(0);
      
      // Alice 动作后，轮到 Bob
      await engine.processAction('alice', PlayerAction.CALL);
      state = engine.getState();
      expect(state.currentPlayerSeat).toBe(1);
      
      // Bob 弃牌后，轮到 Charlie
      await engine.processAction('bob', PlayerAction.FOLD);
      state = engine.getState();
      expect(state.currentPlayerSeat).toBe(2);
    });
  });
});
