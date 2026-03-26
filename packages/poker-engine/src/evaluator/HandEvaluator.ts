/**
 * 牌型评估器
 * @module evaluator/HandEvaluator
 * @author ARCH
 * @date 2026-03-26
 * @task BE-001
 */

import { Hand } from 'pokersolver';
import type { Card, HandInfo, HandRank } from '@poker/shared';

export interface HandEvaluationResult {
  /** 玩家ID */
  playerId: string;
  /** 最佳5张牌 */
  bestCards: Card[];
  /** 牌型信息 */
  handInfo: HandInfo;
  /** 排名分数 (用于比较) */
  score: number;
}

/**
 * 牌型评估器
 * 使用 pokersolver 库计算最佳牌型
 */
export class HandEvaluator {
  /**
   * 评估一手牌
   * @param holeCards - 底牌 (2张)
   * @param communityCards - 公共牌 (3-5张)
   * @returns 最佳牌型信息
   */
  static evaluate(holeCards: Card[], communityCards: Card[]): HandInfo {
    if (holeCards.length !== 2) {
      throw new Error('底牌必须是2张');
    }
    if (communityCards.length < 3 || communityCards.length > 5) {
      throw new Error('公共牌必须是3-5张');
    }

    const allCards = [...holeCards, ...communityCards];
    
    // 转换为 pokersolver 格式
    const hand = Hand.solve(allCards);
    
    return {
      rank: this.mapRank(hand.rank),
      name: hand.name,
      description: hand.descr,
      cards: hand.cards.map((c: any) => c.toString() as Card)
    };
  }

  /**
   * 比较多手牌，找出赢家
   * @param hands - 玩家手牌数组
   * @returns 获胜者信息 (可能有多个平局)
   */
  static compareHands(
    hands: Array<{ playerId: string; holeCards: Card[]; communityCards: Card[] }>
  ): HandEvaluationResult[] {
    const solvedHands = hands.map(h => {
      const allCards = [...h.holeCards, ...h.communityCards];
      const hand = Hand.solve(allCards);
      return {
        playerId: h.playerId,
        hand,
        allCards
      };
    });

    // 使用 pokersolver 的 winners 方法
    const winningHands = Hand.winners(solvedHands.map(h => h.hand));
    
    // 找出获胜者
    const winners: HandEvaluationResult[] = [];
    for (const solved of solvedHands) {
      if (winningHands.includes(solved.hand)) {
        winners.push({
          playerId: solved.playerId,
          bestCards: solved.hand.cards.map((c: any) => c.toString() as Card),
          handInfo: {
            rank: this.mapRank(solved.hand.rank),
            name: solved.hand.name,
            description: solved.hand.descr,
            cards: solved.hand.cards.map((c: any) => c.toString() as Card)
          },
          score: solved.hand.rank
        });
      }
    }

    return winners;
  }

  /**
   * 将 pokersolver 的排名映射为内部 HandRank
   */
  private static mapRank(pokerSolverRank: number): HandRank {
    // pokersolver 的排名: 1=高牌, 2=一对, ... 10=皇家同花顺
    return pokerSolverRank as HandRank;
  }

  /**
   * 比较两手牌
   * @returns 正数=hand1大, 负数=hand2大, 0=平局
   */
  static compareTwoHands(
    holeCards1: Card[],
    holeCards2: Card[],
    communityCards: Card[]
  ): number {
    const allCards1 = [...holeCards1, ...communityCards];
    const allCards2 = [...holeCards2, ...communityCards];
    
    const hand1 = Hand.solve(allCards1);
    const hand2 = Hand.solve(allCards2);
    
    return hand1.rank - hand2.rank;
  }

  /**
   * 检查是否是同花听牌
   * @param cards - 当前可见的牌
   * @returns 同花听牌信息
   */
  static isFlushDraw(cards: Card[]): { isFlushDraw: boolean; suit?: string; count: number } {
    const suitCount: Record<string, number> = {};
    
    for (const card of cards) {
      const suit = card[1];
      suitCount[suit] = (suitCount[suit] || 0) + 1;
    }

    for (const [suit, count] of Object.entries(suitCount)) {
      if (count === 4) {
        return { isFlushDraw: true, suit, count };
      }
    }

    return { isFlushDraw: false, count: Math.max(...Object.values(suitCount)) };
  }

  /**
   * 检查是否是顺子听牌
   * @param cards - 当前可见的牌
   * @returns 顺子听牌信息
   */
  static isStraightDraw(cards: Card[]): { isOpenEnded: boolean; isGutShot: boolean } {
    const rankValues: Record<string, number> = {
      '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8,
      '9': 9, 'T': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14
    };

    const ranks = cards
      .map(c => rankValues[c[0]])
      .filter((v, i, a) => a.indexOf(v) === i) // 去重
      .sort((a, b) => a - b);

    let maxConsecutive = 1;
    let currentConsecutive = 1;

    for (let i = 1; i < ranks.length; i++) {
      if (ranks[i] === ranks[i - 1] + 1) {
        currentConsecutive++;
        maxConsecutive = Math.max(maxConsecutive, currentConsecutive);
      } else if (ranks[i] !== ranks[i - 1]) {
        currentConsecutive = 1;
      }
    }

    // 4张连续是两头顺听牌
    // 3张连续且间隔1张是卡顺听牌
    return {
      isOpenEnded: maxConsecutive >= 4,
      isGutShot: maxConsecutive === 3 && ranks.length >= 4
    };
  }
}
