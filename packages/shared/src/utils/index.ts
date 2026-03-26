/**
 * 工具函数
 * @module utils
 */

import { randomBytes } from 'crypto';
import type { Card, CardRank, CardSuit } from '../types/card';
import { CARD_CONSTANTS } from '../constants/game';

/**
 * 生成随机房间代码
 * @param length 代码长度
 * @returns 房间代码
 */
export function generateRoomCode(length: number = 6): string {
  const charset = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  // 使用 crypto.randomBytes 生成密码学安全的随机数
  const randomData = randomBytes(length);
  let code = '';
  for (let i = 0; i < length; i++) {
    code += charset.charAt(randomData[i] % charset.length);
  }
  return code;
}

/**
 * 将牌转换为显示格式
 * @param card 牌 (如 'Ah')
 * @returns 显示格式 (如 'A♥')
 */
export function formatCard(card: Card): string {
  const rank = card[0] as CardRank;
  const suit = card[1] as CardSuit;
  const rankDisplay = rank === 'T' ? '10' : rank;
  const suitSymbol = CARD_CONSTANTS.SUIT_SYMBOLS[suit];
  return `${rankDisplay}${suitSymbol}`;
}

/**
 * 格式化多张照片
 * @param cards 牌数组
 * @returns 格式化后的字符串
 */
export function formatCards(cards: Card[]): string {
  return cards.map(formatCard).join(' ');
}

/**
 * 洗牌算法 (Fisher-Yates)
 * @param deck 牌组
 * @returns 打乱后的牌组
 */
export function shuffleDeck<T>(deck: T[]): T[] {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * 延迟函数
 * @param ms 毫秒
 * @returns Promise
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * 格式化金额
 * @param amount 金额
 * @returns 格式化后的字符串
 */
export function formatMoney(amount: number): string {
  if (amount >= 1000000) {
    return (amount / 1000000).toFixed(1) + 'M';
  }
  if (amount >= 1000) {
    return (amount / 1000).toFixed(1) + 'K';
  }
  return amount.toString();
}

/**
 * 计算盲注级别
 * @param smallBlind 小盲注
 * @returns 级别名称
 */
export function getBlindLevel(smallBlind: number): string {
  if (smallBlind <= 2) return 'Micro';
  if (smallBlind <= 10) return 'Low';
  if (smallBlind <= 50) return 'Medium';
  if (smallBlind <= 200) return 'High';
  return 'VIP';
}
