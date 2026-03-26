/**
 * 扑克牌类型定义
 * @module types/card
 */

/** 牌面值 */
export type CardRank = '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9' | 'T' | 'J' | 'Q' | 'K' | 'A';

/** 花色 */
export type CardSuit = 's' | 'h' | 'd' | 'c'; // ♠ ♥ ♦ ♣

/** 单张牌 (如 'Ah' = 红桃A) */
export type Card = `${CardRank}${CardSuit}`;

/** 牌型 */
export enum HandRank {
  HIGH_CARD = 1,
  ONE_PAIR = 2,
  TWO_PAIR = 3,
  THREE_OF_A_KIND = 4,
  STRAIGHT = 5,
  FLUSH = 6,
  FULL_HOUSE = 7,
  FOUR_OF_A_KIND = 8,
  STRAIGHT_FLUSH = 9,
  ROYAL_FLUSH = 10
}

/** 牌型信息 */
export interface HandInfo {
  rank: HandRank;
  name: string;
  description: string;
  cards: Card[];
}

/** 完整牌组 (52张) */
export const FULL_DECK: Card[] = [
  // 黑桃 Spades
  'As', 'Ks', 'Qs', 'Js', 'Ts', '9s', '8s', '7s', '6s', '5s', '4s', '3s', '2s',
  // 红桃 Hearts
  'Ah', 'Kh', 'Qh', 'Jh', 'Th', '9h', '8h', '7h', '6h', '5h', '4h', '3h', '2h',
  // 方块 Diamonds
  'Ad', 'Kd', 'Qd', 'Jd', 'Td', '9d', '8d', '7d', '6d', '5d', '4d', '3d', '2d',
  // 梅花 Clubs
  'Ac', 'Kc', 'Qc', 'Jc', 'Tc', '9c', '8c', '7c', '6c', '5c', '4c', '3c', '2c'
];
