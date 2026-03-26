/**
 * Deck 测试
 * @module tests/deck.test
 */

import { describe, it, expect } from 'vitest';
import { Deck } from '../src/deck/Deck';
import { FULL_DECK } from '@poker/shared';

describe('Deck', () => {
  it('应该创建一副完整的52张牌', () => {
    const deck = new Deck();
    expect(deck.getRemainingCount()).toBe(52);
  });

  it('发牌后剩余牌数减少', () => {
    const deck = new Deck();
    const card = deck.deal();
    expect(card).not.toBeNull();
    expect(deck.getRemainingCount()).toBe(51);
    expect(deck.getDealtCount()).toBe(1);
  });

  it('可以发多张牌', () => {
    const deck = new Deck();
    const cards = deck.dealMultiple(5);
    expect(cards).toHaveLength(5);
    expect(deck.getRemainingCount()).toBe(47);
  });

  it('重置后恢复52张牌', () => {
    const deck = new Deck();
    deck.dealMultiple(10);
    expect(deck.getRemainingCount()).toBe(42);
    
    deck.reset();
    expect(deck.getRemainingCount()).toBe(52);
    expect(deck.getDealtCount()).toBe(0);
  });

  it('牌组发完返回null', () => {
    const deck = new Deck();
    // 发完所有牌
    for (let i = 0; i < 52; i++) {
      deck.deal();
    }
    expect(deck.getRemainingCount()).toBe(0);
    expect(deck.deal()).toBeNull();
  });

  it('洗牌后牌序不同 (概率性测试)', () => {
    const deck1 = new Deck();
    const deck2 = new Deck();
    
    // 重置deck2以触发重新洗牌
    deck2.reset();
    
    const cards1 = deck1.dealMultiple(10);
    const cards2 = deck2.dealMultiple(10);
    
    // 两张牌组前10张相同的概率极低
    const allSame = cards1.every((card, i) => card === cards2[i]);
    expect(allSame).toBe(false);
  });

  it('可以从状态恢复', () => {
    const deck = new Deck();
    deck.dealMultiple(5);
    
    const state = deck.getState();
    
    const newDeck = new Deck();
    newDeck.restoreFromState(state);
    
    expect(newDeck.getRemainingCount()).toBe(47);
    expect(newDeck.getDealtCount()).toBe(5);
  });
});
