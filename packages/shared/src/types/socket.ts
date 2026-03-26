/**
 * Socket.io 事件类型定义
 * @module types/socket
 */

import type { GameState, PlayerAction } from './game';
import type { UserPublicInfo } from './user';

// ==================== 客户端发送事件 ====================

/** 连接认证 */
export interface ClientAuth {
  token: string;
}

/** 创建房间 */
export interface CreateRoomRequest {
  name: string;
  maxPlayers: number;
  smallBlind: number;
  bigBlind: number;
  minBuyIn: number;
  maxBuyIn: number;
  isPrivate?: boolean;
  password?: string;
}

/** 加入房间 */
export interface JoinRoomRequest {
  roomCode: string;
  password?: string;
}

/** 玩家动作 */
export interface PlayerActionRequest {
  gameId: string;
  action: PlayerAction;
  amount?: number;
}

/** 聊天消息 */
export interface ChatMessageRequest {
  roomId: string;
  message: string;
}

// ==================== 服务器发送事件 ====================

/** 游戏状态更新 */
export interface GameStateUpdate {
  gameId: string;
  state: GameState;
  timestamp: number;
}

/** 玩家动作通知 */
export interface PlayerActionNotification {
  gameId: string;
  userId: string;
  username: string;
  action: PlayerAction;
  amount?: number;
  timestamp: number;
}

/** 新玩家加入 */
export interface PlayerJoinedNotification {
  roomId: string;
  user: UserPublicInfo;
  seatNumber: number;
}

/** 玩家离开 */
export interface PlayerLeftNotification {
  roomId: string;
  userId: string;
  reason: 'left' | 'disconnected' | 'kicked';
}

/** 游戏开始 */
export interface GameStartedNotification {
  gameId: string;
  roomId: string;
  state: GameState;
}

/** 游戏结束 */
export interface GameEndedNotification {
  gameId: string;
  winners: {
    userId: string;
    username: string;
    amount: number;
    handDescription?: string;
  }[];
}

/** 错误通知 */
export interface ErrorNotification {
  code: string;
  message: string;
  timestamp: number;
}

/** 聊天消息 */
export interface ChatMessageNotification {
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: number;
}

// ==================== 事件名称枚举 ====================

/** 客户端事件 */
export enum ClientEvents {
  AUTH = 'auth',
  CREATE_ROOM = 'create_room',
  JOIN_ROOM = 'join_room',
  LEAVE_ROOM = 'leave_room',
  START_GAME = 'start_game',
  PLAYER_ACTION = 'player_action',
  SEND_MESSAGE = 'send_message',
  READY = 'ready',
  SIT_OUT = 'sit_out',
  SIT_IN = 'sit_in'
}

/** 服务器事件 */
export enum ServerEvents {
  AUTH_SUCCESS = 'auth_success',
  AUTH_ERROR = 'auth_error',
  ROOM_CREATED = 'room_created',
  ROOM_JOINED = 'room_joined',
  ROOM_LEFT = 'room_left',
  GAME_STARTED = 'game_started',
  GAME_ENDED = 'game_ended',
  GAME_STATE_UPDATE = 'game_state_update',
  PLAYER_ACTION = 'player_action',
  PLAYER_JOINED = 'player_joined',
  PLAYER_LEFT = 'player_left',
  YOUR_TURN = 'your_turn',
  CHAT_MESSAGE = 'chat_message',
  ERROR = 'error',
  CONNECT_ERROR = 'connect_error'
}
