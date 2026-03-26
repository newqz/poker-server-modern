/**
 * API 响应类型定义
 * @module types/api
 */

import type { User } from './user';

/** 标准API响应 */
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta?: ApiMeta;
}

/** API错误 */
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, string[]>;
}

/** API元数据 */
export interface ApiMeta {
  page?: number;
  limit?: number;
  total?: number;
  hasMore?: boolean;
  timestamp: number;
}

/** 登录请求 */
export interface LoginRequest {
  email: string;
  password: string;
}

/** 注册请求 */
export interface RegisterRequest {
  username: string;
  email: string;
  password: string;
}

/** 认证响应 */
export interface AuthResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** 刷新Token请求 */
export interface RefreshTokenRequest {
  refreshToken: string;
}

/** 房间列表项 */
export interface RoomListItem {
  id: string;
  code: string;
  name: string;
  hostName: string;
  maxPlayers: number;
  currentPlayers: number;
  smallBlind: number;
  bigBlind: number;
  isPrivate: boolean;
  status: 'waiting' | 'playing';
  createdAt: string;
}

/** 房间详情 */
export interface RoomDetail {
  id: string;
  code: string;
  name: string;
  host: {
    id: string;
    username: string;
    avatarUrl?: string;
  };
  players: {
    seatNumber: number;
    user: {
      id: string;
      username: string;
      avatarUrl?: string;
    };
    isReady: boolean;
    chips: number;
  }[];
  config: {
    maxPlayers: number;
    smallBlind: number;
    bigBlind: number;
    minBuyIn: number;
    maxBuyIn: number;
  };
  status: 'waiting' | 'playing';
  currentGameId?: string;
  createdAt: string;
}

/** 游戏历史记录 */
export interface GameHistoryItem {
  id: string;
  roomCode: string;
  startTime: string;
  endTime: string;
  duration: number; // 秒
  result: 'win' | 'loss' | 'draw';
  amount: number;
  holeCards: string[];
  communityCards: string[];
  bestHand?: string;
}

/** 排行榜条目 */
export interface LeaderboardItem {
  rank: number;
  userId: string;
  username: string;
  avatarUrl?: string;
  score: number;
  totalGames: number;
  winRate: number;
}
