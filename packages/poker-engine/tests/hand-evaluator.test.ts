/**
 * HandEvaluator 测试
 * @module tests/hand-evaluator.test
 */

import { describe, it, expect } from 'vitest';
import { HandEvaluator } from '../src/evaluator/HandEvaluator';
import type { Card } from '@poker/shared';

describe('HandEvaluator', () => {
  describe('evaluate', () => {
    it('应该正确识别皇家同花顺', () => {
      const holeCards: Card[] = ['As', 'Ks'];
      const communityCards: Card[] = ['Qs', 'Js', 'Ts', '2d', '3c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Royal Flush');
      expect(result.rank).toBe(10);
    });

    it('应该正确识别同花顺', () => {
      const holeCards: Card[] = ['9s', 'Ks'];
      const communityCards: Card[] = ['Qs', 'Js', 'Ts', '2d', '3c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Straight Flush');
      expect(result.rank).toBe(9);
    });

    it('应该正确识别四条', () => {
      const holeCards: Card[] = ['Ah', 'Ad'];
      const communityCards: Card[] = ['As', 'Ac', '2d', '3c', '4h'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Four of a Kind');
      expect(result.rank).toBe(8);
    });

    it('应该正确识别葫芦', () => {
      const holeCards: Card[] = ['Ah', 'Ad'];
      const communityCards: Card[] = ['As', 'Kc', 'Kh', '2d', '3c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Full House');
      expect(result.rank).toBe(7);
    });

    it('应该正确识别同花', () => {
      const holeCards: Card[] = ['Ah', 'Kh'];
      const communityCards: Card[] = ['Qh', 'Jh', '2h', '3c', '4d'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Flush');
      expect(result.rank).toBe(6);
    });

    it('应该正确识别顺子', () => {
      const holeCards: Card[] = ['9h', 'Td'];
      const communityCards: Card[] = ['Js', 'Qc', 'Kh', '2d', '3c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Straight');
      expect(result.rank).toBe(5);
    });

    it('应该正确识别三条', () => {
      const holeCards: Card[] = ['Ah', 'Ad'];
      const communityCards: Card[] = ['As', 'Kc', 'Qh', '2d', '3c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Three of a Kind');
      expect(result.rank).toBe(4);
    });

    it('应该正确识别两对', () => {
      const holeCards: Card[] = ['Ah', 'Kd'];
      const communityCards: Card[] = ['As', 'Kc', 'Qh', '2d', '3c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Two Pair');
      expect(result.rank).toBe(3);
    });

    it('应该正确识别一对', () => {
      const holeCards: Card[] = ['Ah', '2d'];
      const communityCards: Card[] = ['As', 'Kc', 'Qh', '3d', '4c'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('Pair');
      expect(result.rank).toBe(2);
    });

    it('应该正确识别高牌', () => {
      const holeCards: Card[] = ['Ah', '2d'];
      const communityCards: Card[] = ['4s', '6c', '8h', 'Td', 'Ks'];
      
      const result = HandEvaluator.evaluate(holeCards, communityCards);
      
      expect(result.name).toBe('High Card');
      expect(result.rank).toBe(1);
    });

    it('底牌不是2张应该抛出错误', () => {
      expect(() => {
        HandEvaluator.evaluate(['Ah'] as any, ['2d', '3c', '4h', '5s', '6c']);
      }).toThrow('底牌必须是2张');
    });

    it('公共牌少于3张应该抛出错误', () => {
      expect(() => {
        HandEvaluator.evaluate(['Ah', 'Kd'], ['2d']);
      }).toThrow('公共牌必须是3-5张');
    });
  });

  describe('compareHands', () => {
    it('应该正确识别赢家', () => {
      const hands = [
        {
          playerId: 'player1',
          holeCards: ['Ah', 'Ad'] as Card[],
          communityCards: ['As', 'Kc', 'Qh', '2d', '3c'] as Card[]
        },
        {
          playerId: 'player2',
          holeCards: ['Kh', 'Kd'] as Card[],
          communityCards: ['As', 'Kc', 'Qh', '2d', '3c'] as Card[]
        }
      ];

      const winners = HandEvaluator.compareHands(hands);
      
      expect(winners).toHaveLength(1);
      expect(winners[0].playerId).toBe('player1'); // 三条A胜三条K
    });

    it('应该正确处理平局', () => {
      const hands = [
        {
          playerId: 'player1',
          holeCards: ['Ah', 'Kd'] as Card[],
          communityCards: ['As', 'Kc', 'Qh', '2d', '3c'] as Card[]
        },
        {
          playerId: 'player2',
          holeCards: ['Ah', 'Kd'] as Card[],
          communityCards: ['As', 'Kc', 'Qh', '2d', '3c'] as Card[]
        }
      ];

      const winners = HandEvaluator.compareHands(hands);
      
      expect(winners).toHaveLength(2);
    });
  });

  describe('isFlushDraw', () => {
    it('应该识别同花听牌', () => {
      const cards: Card[] = ['Ah', 'Kh', 'Qh', 'Jh', '2d'];
      const result = HandEvaluator.isFlushDraw(cards);
      
      expect(result.isFlushDraw).toBe(true);
      expect(result.suit).toBe('h');
    });

    it('非听牌返回false', () => {
      const cards: Card[] = ['Ah', 'Kh', 'Qd', 'Jh', '2d'];
      const result = HandEvaluator.isFlushDraw(cards);
      
      expect(result.isFlushDraw).toBe(false);
    });
  });

  describe('isStraightDraw', () => {
    it('应该识别两头顺听牌', () => {
      const cards: Card[] = ['9h', 'Td', 'Js', 'Qc', '2d'];
      const result = HandEvaluator.isStraightDraw(cards);
      
      expect(result.isOpenEnded).toBe(true);
    });

    it('应该识别卡顺听牌', () => {
      const cards: Card[] = ['9h', 'Td', 'Js', '2c', '3d'];
      const result = HandEvaluator.isStraightDraw(cards);
      
      expect(result.isGutShot).toBe(true);
    });
  });
});
