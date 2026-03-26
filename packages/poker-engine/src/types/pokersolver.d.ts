declare module 'pokersolver' {
  export class Hand {
    constructor(cards: string[], game?: string, canDisqualify?: boolean);
    static solve(cards: string[], game?: string): Hand;
    static winners(hands: Hand[]): Hand[];
    
    cards: any[];
    rank: number;
    name: string;
    descr: string;
  }
}
