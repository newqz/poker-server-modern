/**
 * 可验证随机发牌 (Provably Fair)
 * @module crypto/ProvablyFair
 * @description 确保发牌过程可验证且公平
 * 
 * 算法说明：
 * 1. 服务器生成 serverSeed 和 nonce
 * 2. 客户端在发牌前提供 clientSeed
 * 3. 发牌时使用 hash(serverSeed + clientSeed + nonce) 生成随机序列
 * 4. 牌局结束后公开 serverSeed，玩家可验证
 */

import { createHash, randomBytes } from 'crypto';

export interface SeedPair {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

export interface DealResult {
  cards: number[];        // 发出的牌 (0-51)
  seedPair: SeedPair;     // 使用的种子对
  hash: string;           // 本次发牌的哈希
}

/**
 * 可验证随机发牌器
 */
export class ProvablyFair {
  private serverSeed: string;
  private serverSeedHash: string;
  private clientSeed: string;
  private nonce: number;

  constructor() {
    this.nonce = 0;
    const seeds = this.generateSeedPair();
    this.serverSeed = seeds.serverSeed;
    this.serverSeedHash = seeds.serverSeedHash;
    this.clientSeed = '';
  }

  /**
   * 生成新的服务器种子对
   */
  generateSeedPair(): { serverSeed: string; serverSeedHash: string } {
    const serverSeed = randomBytes(32).toString('hex');
    const serverSeedHash = this.hashWithSHA256(serverSeed);
    return { serverSeed, serverSeedHash };
  }

  /**
   * 设置客户端种子
   */
  setClientSeed(clientSeed: string): void {
    if (clientSeed.length < 16) {
      throw new Error('Client seed must be at least 16 characters');
    }
    this.clientSeed = clientSeed;
  }

  /**
   * 获取当前服务器种子哈希（公开给客户端）
   */
  getServerSeedHash(): string {
    return this.serverSeedHash;
  }

  /**
   * 重置随机数生成器
   */
  reset(): void {
    this.nonce = 0;
    const seeds = this.generateSeedPair();
    this.serverSeed = seeds.serverSeed;
    this.serverSeedHash = seeds.serverSeedHash;
    this.clientSeed = '';
  }

  /**
   * 发牌
   * @param count 发牌数量
   * @param clientSeed 客户端种子
   * @returns 牌数组 (0-51)
   */
  deal(count: number, clientSeed?: string): DealResult {
    if (!this.clientSeed && !clientSeed) {
      throw new Error('Client seed must be set before dealing');
    }

    const usedClientSeed = clientSeed || this.clientSeed;
    
    // 生成随机序列
    const cards = this.generateCardSequence(count, usedClientSeed);
    
    const seedPair: SeedPair = {
      serverSeed: this.serverSeed,
      serverSeedHash: this.serverSeedHash,
      clientSeed: usedClientSeed,
      nonce: this.nonce
    };

    const hash = this.hashWithSHA256(JSON.stringify({ cards, ...seedPair }));

    this.nonce++;
    return { cards, seedPair, hash };
  }

  /**
   * 生成卡牌序列
   * 使用种子和随机数生成不重复的牌
   */
  private generateCardSequence(count: number, clientSeed: string): number[] {
    const cards: number[] = [];
    let deck = Array.from({ length: 52 }, (_, i) => i); // 0-51

    for (let i = 0; i < count; i++) {
      // 生成随机索引
      const randomIndex = this.getRandomIndex(deck.length, `${this.serverSeed}:${clientSeed}:${this.nonce}:${i}`);
      
      // 抽出牌
      cards.push(deck[randomIndex]);
      deck.splice(randomIndex, 1);
    }

    return cards;
  }

  /**
   * 使用种子生成伪随机索引
   */
  private getRandomIndex(max: number, seed: string): number {
    const hash = this.hashWithSHA256(seed);
    const hex = hash.substring(0, 8);
    const randomValue = parseInt(hex, 16);
    return randomValue % max;
  }

  /**
   * SHA256 哈希
   */
  private hashWithSHA256(data: string): string {
    return createHash('sha256').update(data).digest('hex');
  }

  /**
   * 验证牌局结果
   */
  static verify(
    serverSeed: string,
    clientSeed: string,
    nonce: number,
    cards: number[]
  ): boolean {
    // 重新生成牌序列
    let deck = Array.from({ length: 52 }, (_, i) => i);
    const cards_result: number[] = [];

    for (let i = 0; i < cards.length; i++) {
      const seed = `${serverSeed}:${clientSeed}:${nonce}:${i}`;
      const hash = createHash('sha256').update(seed).digest('hex');
      const hex = hash.substring(0, 8);
      const randomValue = parseInt(hex, 16);
      const randomIndex = randomValue % deck.length;

      cards_result.push(deck[randomIndex]);
      deck.splice(randomIndex, 1);
    }

    // 比较
    if (cards_result.length !== cards.length) return false;
    for (let i = 0; i < cards.length; i++) {
      if (cards_result[i] !== cards[i]) return false;
    }
    return true;
  }
}

/**
 * 卡牌工具函数
 */
export const CardUtils = {
  /**
   * 转换牌编号到显示字符串
   * 0-12: 黑桃 A-K, 13-25: 红心 A-K, 26-38: 方块 A-K, 39-51: 梅花 A-K
   */
  toDisplay(cardIndex: number): string {
    if (cardIndex < 0 || cardIndex > 51) return '??';
    
    const suits = ['♠', '♥', '♦', '♣'];
    const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
    
    const suitIndex = Math.floor(cardIndex / 13);
    const rankIndex = cardIndex % 13;
    
    return `${ranks[rankIndex]}${suits[suitIndex]}`;
  },

  /**
   * 转换到花色
   */
  toSuit(cardIndex: number): string {
    const suits = ['spades', 'hearts', 'diamonds', 'clubs'];
    return suits[Math.floor(cardIndex / 13)];
  },

  /**
   * 转换到点数
   */
  toRank(cardIndex: number): number {
    const rank = (cardIndex % 13) + 1;
    return rank > 10 ? 10 : rank; // J/Q/K 都是 10
  }
};
