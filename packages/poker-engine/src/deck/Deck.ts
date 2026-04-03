/**
 * 扑克牌组类
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

  reset(): void {
    this.cards = [...FULL_DECK];
    this.dealtCount = 0;
  }

  shuffle(): void {
    this.cards = shuffleDeck(FULL_DECK);
    this.dealtCount = 0;
  }

  setClientSeed(seed: string): void {
    this.clientSeed = seed;
    this.provablyFair.setClientSeed(seed);
  }

  getClientSeed(): string | null {
    return this.clientSeed;
  }

  getState(): DeckState {
    return {
      cards: [...this.cards],
      dealtCount: this.dealtCount
    };
  }

  burn(): Card | undefined {
    return this.cards.pop();
  }

  deal(): Card {
    if (this.cards.length === 0) {
      throw new Error('No cards left in deck');
    }

    if (!this.clientSeed) {
      const index = Math.floor(Math.random() * this.cards.length);
      return this.cards.splice(index, 1)[0];
    }

    try {
      const result = this.provablyFair.deal(1);
      const cardIndex = result.cards[0];
      const cardStr = CardUtils.toDisplay(cardIndex);
      const idx = this.cards.indexOf(cardStr as Card);
      if (idx !== -1) {
        this.cards.splice(idx, 1);
      }
      this.dealtCount++;
      return cardStr as Card;
    } catch (error) {
      const index = Math.floor(Math.random() * this.cards.length);
      return this.cards.splice(index, 1)[0];
    }
  }

  dealMultiple(count: number): Card[] {
    const cards: Card[] = [];
    for (let i = 0; i < count; i++) {
      cards.push(this.deal());
    }
    return cards;
  }

  dealMultipleVerifiable(count: number): DeckDealResult {
    if (!this.clientSeed) {
      return { cards: this.dealMultiple(count) };
    }

    try {
      const result = this.provablyFair.deal(count);
      const dealtCards: Card[] = [];

      for (const cardIndex of result.cards) {
        const cardStr = CardUtils.toDisplay(cardIndex);
        const idx = this.cards.indexOf(cardStr as Card);
        if (idx !== -1) {
          this.cards.splice(idx, 1);
        }
        dealtCards.push(cardStr as Card);
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
      return { cards: this.dealMultiple(count) };
    }
  }

  cardsRemaining(): number {
    return this.cards.length;
  }
}
