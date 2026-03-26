/**
 * 用户类型定义
 * @module types/user
 */

/** 用户角色 */
export enum UserRole {
  USER = 'user',
  VIP = 'vip',
  MODERATOR = 'moderator',
  ADMIN = 'admin'
}

/** 用户状态 */
export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended',
  BANNED = 'banned'
}

/** 用户基础信息 */
export interface User {
  id: string;
  username: string;
  email: string;
  avatarUrl?: string;
  role: UserRole;
  status: UserStatus;
  balance: number;
  createdAt: Date;
  updatedAt: Date;
}

/** 用户信息 (公开) */
export interface UserPublicInfo {
  id: string;
  username: string;
  avatarUrl?: string;
  role: UserRole;
}

/** 用户统计 */
export interface UserStats {
  userId: string;
  totalGames: number;
  totalWins: number;
  totalLosses: number;
  totalBuyIn: number;
  totalCashOut: number;
  biggestWin: number;
  biggestPot: number;
  bestHand?: string;
}
