/**
 * 扑克牌组类
 * @module deck/Deck
 * @author ARCH
 * @date 2026-03-26
 * @task BE-001
 */

import type { Card } from '@poker/shared';
import { FULL_DECK, shuffleDeck } from '@poker/shared';

export interface DeckState {
  cards: Card[];
  dealtCount: number;
}

/**
 * 扑克牌组管理类
 * 负责洗牌、发牌等操作
 */
export class Deck {
  private cards: Card[];
  private dealtCount: number;

  constructor() {
    this.cards = [];
    this.dealtCount = 0;
    this.reset();
  }

  /**
   * 重置牌组 (重新洗牌)
   */
  reset(): void {
    this.cards = shuffleDeck([...FULL_DECK]);
    this.dealtCount = 0;
  }

  /**
   * 发一张牌
   * @returns 发出的牌，如果牌组为空则返回null
   */
  deal(): Card | null {
    if (this.cards.length === 0) {
      return null;
    }
    const card = this.cards.pop()!;
    this.dealtCount++;
    return card;
  }

  /**
   * 发多张牌
   * @param count 要发的牌数
   * @returns 发出的牌数组
   */
  dealMultiple(count: number): Card[] {
    const dealt: Card[] = [];
    for (let i = 0; i < count; i++) {
      const card = this.deal();
      if (card) {
        dealt.push(card);
      } else {
        break;
      }
    }
    return dealt;
  }

  /**
   * 查看牌组剩余牌数
   */
  getRemainingCount(): number {
    return this.cards.length;
  }

  /**
   * 查看已发牌数
   */
  getDealtCount(): number {
    return this.dealtCount;
  }

  /**
   * 查看牌组状态 (调试用)
   */
  getState(): DeckState {
    return {
      cards: [...this.cards],
      dealtCount: this.dealtCount
    };
  }

  /**
   * 从状态恢复牌组
   */
  restoreFromState(state: DeckState): void {
    this.cards = [...state.cards];
    this.dealtCount = state.dealtCount;
  }

  /**
   * 是否还有剩余牌
   */
  hasCards(): boolean {
    return this.cards.length > 0;
  }

  /**
   * 烧牌 (Burn Card)
   * 在发公共牌前烧掉一张牌
   */
  burn(): void {
    this.deal();
  }
}
