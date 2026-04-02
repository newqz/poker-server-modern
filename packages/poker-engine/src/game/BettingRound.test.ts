/**
 * BettingRound 单元测试
 * @module game/BettingRound.test
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { BettingRound } from './BettingRound';
import { PlayerAction } from '@poker/shared';

describe('BettingRound', () => {
  let bettingRound: BettingRound;

  beforeEach(() => {
    bettingRound = new BettingRound();
  });

  describe('构造函数', () => {
    it('应该正确初始化', () => {
      expect(bettingRound.getCurrentBet()).toBe(0);
      expect(bettingRound.getTotalPot()).toBe(0);
      expect(bettingRound.getActions()).toHaveLength(0);
      expect(bettingRound.getPots()).toHaveLength(1); // 初始有一个主池
    });
  });

  describe('recordAction', () => {
    it('应该记录动作', () => {
      bettingRound.recordAction('player-1', PlayerAction.FOLD);
      
      const actions = bettingRound.getActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].playerId).toBe('player-1');
      expect(actions[0].action).toBe('FOLD');
    });

    it('应该正确设置加注后的当前下注额', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      
      expect(bettingRound.getCurrentBet()).toBe(100);
    });

    it('应该记录带金额的动作', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 50);
      
      const actions = bettingRound.getActions();
      expect(actions[0].amount).toBe(50);
    });
  });

  describe('addToPot', () => {
    it('应该正确添加到底池', () => {
      bettingRound.addToPot(100, 'player-1');
      
      expect(bettingRound.getTotalPot()).toBe(100);
    });

    it('应该追踪有资格赢取底池的玩家', () => {
      bettingRound.addToPot(100, 'player-1');
      bettingRound.addToPot(100, 'player-2');
      
      const pots = bettingRound.getPots();
      expect(pots[0].eligiblePlayers).toContain('player-1');
      expect(pots[0].eligiblePlayers).toContain('player-2');
    });

    it('不应该接受无效金额', () => {
      expect(() => bettingRound.addToPot(0, 'player-1')).toThrow('INVALID_POT_AMOUNT');
      expect(() => bettingRound.addToPot(-100, 'player-1')).toThrow('INVALID_POT_AMOUNT');
      expect(() => bettingRound.addToPot(NaN, 'player-1')).toThrow('INVALID_POT_AMOUNT');
    });
  });

  describe('getCurrentBet', () => {
    it('初始应该为0', () => {
      expect(bettingRound.getCurrentBet()).toBe(0);
    });

    it('应该返回最后一次加注的金额', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 50);
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      expect(bettingRound.getCurrentBet()).toBe(50);
    });

    it('全押应该更新当前下注额', () => {
      bettingRound.recordAction('player-1', PlayerAction.ALL_IN, 500);
      
      expect(bettingRound.getCurrentBet()).toBe(500);
    });
  });

  describe('isRoundComplete', () => {
    it('无动作时应该返回false', () => {
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(false);
    });

    it('所有玩家都弃牌时应该返回true', () => {
      bettingRound.recordAction('player-1', PlayerAction.FOLD);
      bettingRound.recordAction('player-2', PlayerAction.FOLD);
      
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(true);
    });

    it('所有玩家都过牌时应该返回true', () => {
      bettingRound.recordAction('player-1', PlayerAction.CHECK);
      bettingRound.recordAction('player-2', PlayerAction.CHECK);
      
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(true);
    });

    it('所有玩家都跟注后应该返回true', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(true);
    });

    it('有人加注后所有玩家都需要行动', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      // player-1 已经行动过，但加注后需要重新判断
      
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(true);
    });

    it('未弃牌玩家数小于2时应该返回true', () => {
      bettingRound.recordAction('player-1', PlayerAction.FOLD);
      // 只剩 player-2
      bettingRound.recordAction('player-2', PlayerAction.CHECK);
      
      const result = bettingRound.isRoundComplete(['player-2']);
      expect(result).toBe(true);
    });

    it('部分玩家弃牌后应该继续', () => {
      bettingRound.recordAction('player-1', PlayerAction.FOLD);
      // player-2 还需要行动
      
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(false);
    });
  });

  describe('getPlayerBetInRound', () => {
    it('应该返回玩家本轮下注总额', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      expect(bettingRound.getPlayerBetInRound('player-1')).toBe(100);
      expect(bettingRound.getPlayerBetInRound('player-2')).toBe(100);
    });

    it('只跟注时应该只计算call金额', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      // player-2 跟注了 100
      expect(bettingRound.getPlayerBetInRound('player-2')).toBe(100);
    });

    it('未参与下注的玩家应该返回0', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      
      expect(bettingRound.getPlayerBetInRound('player-2')).toBe(0);
    });
  });

  describe('reset', () => {
    it('应该重置所有状态', () => {
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      bettingRound.addToPot(100, 'player-1');
      
      bettingRound.reset();
      
      expect(bettingRound.getCurrentBet()).toBe(0);
      expect(bettingRound.getTotalPot()).toBe(0);
      expect(bettingRound.getActions()).toHaveLength(0);
    });
  });

  describe('多玩家场景', () => {
    it('3人游戏的基本流程', () => {
      // 翻牌前下注轮
      // player-1 (UTG) 加注到 100
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 100);
      expect(bettingRound.getCurrentBet()).toBe(100);
      
      // player-2 跟注
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      // player-3 弃牌
      bettingRound.recordAction('player-3', PlayerAction.FOLD);
      
      // 验证：所有需要行动的玩家都已行动
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(true);
    });

    it('4人游戏的加注后跟注场景', () => {
      // player-1 加注到 50
      bettingRound.recordAction('player-1', PlayerAction.RAISE, 50);
      
      // player-2 跟注 50
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      // player-3 加注到 100
      bettingRound.recordAction('player-3', PlayerAction.RAISE, 100);
      
      // player-4 跟注 100
      bettingRound.recordAction('player-4', PlayerAction.CALL);
      
      // player-1 跟注到 100
      bettingRound.recordAction('player-1', PlayerAction.CALL);
      
      // player-2 跟注到 100
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      expect(bettingRound.getCurrentBet()).toBe(100);
      const result = bettingRound.isRoundComplete(['player-1', 'player-2', 'player-3', 'player-4']);
      expect(result).toBe(true);
    });
  });

  describe('边界情况', () => {
    it('只有一个玩家时', () => {
      bettingRound.recordAction('player-1', PlayerAction.CHECK);
      
      const result = bettingRound.isRoundComplete(['player-1']);
      expect(result).toBe(true);
    });

    it('全押情况', () => {
      // player-1 全押 100
      bettingRound.recordAction('player-1', PlayerAction.ALL_IN, 100);
      
      // player-2 跟注 100
      bettingRound.recordAction('player-2', PlayerAction.CALL);
      
      expect(bettingRound.getCurrentBet()).toBe(100);
      const result = bettingRound.isRoundComplete(['player-1', 'player-2']);
      expect(result).toBe(true);
    });

    it('多个全押情况', () => {
      // player-1 全押 100
      bettingRound.recordAction('player-1', PlayerAction.ALL_IN, 100);
      
      // player-2 全押 200
      bettingRound.recordAction('player-2', PlayerAction.ALL_IN, 200);
      
      // player-3 跟注 200
      bettingRound.recordAction('player-3', PlayerAction.CALL);
      
      expect(bettingRound.getCurrentBet()).toBe(200);
    });
  });
});
