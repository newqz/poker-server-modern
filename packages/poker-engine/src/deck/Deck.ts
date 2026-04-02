/**
 * 扑克牌组类
 * @module deck/Deck
 * @author ARCH
 * @date 2026-03-26
 * @task BE-001
 * @description 支持可验证随机 (Provably Fair) 的扑克牌组
 */

import type { Card } from '@poker/shared';
import { FULL_DECK, shuffleDeck } from '@poker/shared';
import { ProvablyFair, CardUtils } from '../crypto/ProvablyFair';

export interface DeckState {
  cards: Card[];
  dealtCount: number;
}

export interface DeckDealResult {
  cards: Card[];
  verifiableInfo?: {
    serverSeedHash: string;
    clientSeed: string;
    nonce: number;
  };
}

/**
 * 扑克牌组管理类
 * 负责洗牌、发牌等操作
 * 支持可验证随机发牌
 */
export class Deck {
  private cards: Card[];
  private dealtCount: number;
  private provablyFair: ProvablyFair;
  private clientSeed: string | null;

  constructor() {
    this.cards = [];
    this.dealtCount = 0;
    this.provablyFair = new ProvablyFair();
    this.clientSeed = null;
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
   * 设置客户端种子 (用于可验证随机)
   */
  setClientSeed(seed: string): void {
    this.clientSeed = seed;
    this.provablyFair.setClientSeed(seed);
  }

  /**
   * 获取服务器种子哈希 (客户端可以看到这个来验证)
   */
  getServerSeedHash(): string {
    return this.provablyFair.getServerSeedHash();
  }

  /**
   * 发一张牌 (标准随机)
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
   * 发一张牌 (可验证随机)
   */
  dealVerifiable(): Card | null {
    if (!this.clientSeed) {
      // 没有客户端种子，回退到标准随机
      return this.deal();
    }

    try {
      const result = this.provablyFair.deal(1);
      if (result.cards.length === 0) return null;
      
      // 牌已经在ProvablyFair中确定，这里只需要返回对应的Card
      const cardIndex = result.cards[0];
      const card = this.indexToCard(cardIndex);
      
      // 从牌组中移除这张牌
      const cardStr = CardUtils.toDisplay(cardIndex);
      const idx = this.cards.findIndex(c => c.display === cardStr);
      if (idx !== -1) {
        this.cards.splice(idx, 1);
      }
      
      this.dealtCount++;
      return card;
    } catch (error) {
      // 出错时回退到标准随机
      return this.deal();
    }
  }

  /**
   * 发多张牌 (可验证随机)
   */
  dealMultipleVerifiable(count: number): DeckDealResult {
    if (!this.clientSeed) {
      const cards = this.dealMultiple(count);
      return { cards };
    }

    try {
      const result = this.provablyFair.deal(count);
      const dealtCards: Card[] = [];
      
      for (const cardIndex of result.cards) {
        const card = this.indexToCard(cardIndex);
        dealtCards.push(card);
        
        // 从牌组中移除
        const cardStr = CardUtils.toDisplay(cardIndex);
        const idx = this.cards.findIndex(c => c.display === cardStr);
        if (idx !== -1) {
          this.cards.splice(idx, 1);
        }
      }

      this.dealtCount += count;

      return {
        cards: dealtCards,
        verifiableInfo: {
          serverSeedHash: result.seedPair.serverSeedHash,
          clientSeed: result.seedPair.clientSeed,
          nonce: result.seedPair.nonce
        }
      };
    } catch (error) {
      // 出错时回退到标准随机
      return { cards: this.dealMultiple(count) };
    }
  }

  /**
   * 牌编号转 Card 对象
   */
  private indexToCard(index: number): Card {
    return {
      suit: CardUtils.toSuit(index) as any,
      rank: CardUtils.toRank(index),
      display: CardUtils.toDisplay(index),
      value: CardUtils.toRank(index)
    };
  }

  /**
   * 发多张牌 (标准随机)
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

  /**
   * 烧牌 (可验证随机)
   */
  burnVerifiable(): void {
    this.dealVerifiable();
  }
}
