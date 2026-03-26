/**
 * 游戏类型定义
 * @module types/game
 */

import type { Card } from './card';

/** 游戏状态 */
export enum GameStatus {
  WAITING = 'waiting',      // 等待玩家
  STARTING = 'starting',    // 开始倒计时
  PREFLOP = 'preflop',      // 翻牌前
  FLOP = 'flop',           // 翻牌圈
  TURN = 'turn',           // 转牌圈
  RIVER = 'river',         // 河牌圈
  SHOWDOWN = 'showdown',   // 摊牌
  ENDED = 'ended'          // 结束
}

/** 游戏轮次 */
export type GameRound = 'preflop' | 'flop' | 'turn' | 'river';

/** 玩家动作 */
export enum PlayerAction {
  FOLD = 'fold',           // 弃牌
  CHECK = 'check',         // 过牌
  CALL = 'call',           // 跟注
  RAISE = 'raise',         // 加注
  ALL_IN = 'all_in',       // 全押
  SMALL_BLIND = 'small_blind',
  BIG_BLIND = 'big_blind'
}

/** 玩家状态 */
export enum PlayerStatus {
  WAITING = 'waiting',     // 等待中
  READY = 'ready',         // 已准备
  PLAYING = 'playing',     // 游戏中
  FOLDED = 'folded',       // 已弃牌
  ALL_IN = 'all_in',       // 全押
  SITTING_OUT = 'sitting_out' // 暂离
}

/** 玩家座位位置 */
export enum PlayerPosition {
  DEALER = 'dealer',
  SMALL_BLIND = 'small_blind',
  BIG_BLIND = 'big_blind',
  UTG = 'utg',             // Under The Gun
  UTG1 = 'utg1',
  MP = 'mp',               // Middle Position
  MP1 = 'mp1',
  CO = 'co',               // Cut Off
  BTN = 'btn'              // Button (Dealer)
}

/** 游戏配置 */
export interface GameConfig {
  maxPlayers: number;      // 最大玩家数 (2-10)
  minPlayers: number;      // 最小玩家数
  smallBlind: number;      // 小盲注
  bigBlind: number;        // 大盲注
  minBuyIn: number;        // 最小买入
  maxBuyIn: number;        // 最大买入
  timeLimit: number;       // 每轮操作时间限制(秒)
}

/** 玩家游戏内信息 */
export interface PlayerGameInfo {
  userId: string;
  username: string;
  seatNumber: number;
  position: PlayerPosition;
  chips: number;
  betAmount: number;
  status: PlayerStatus;
  holeCards?: Card[];      // 仅对自己可见
  avatarUrl?: string;
}

/** 游戏状态快照 */
export interface GameState {
  id: string;
  roomId: string;
  status: GameStatus;
  round: GameRound;
  communityCards: Card[];
  pot: number;
  currentPlayer: string;   // userId
  players: PlayerGameInfo[];
  dealerSeat: number;
  smallBlindSeat: number;
  bigBlindSeat: number;
  lastAction?: {
    playerId: string;
    action: PlayerAction;
    amount?: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

/** 游戏动作记录 */
export interface GameAction {
  id: string;
  gameId: string;
  userId: string;
  action: PlayerAction;
  amount?: number;
  round: GameRound;
  timestamp: Date;
}
