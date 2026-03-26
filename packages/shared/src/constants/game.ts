/**
 * 游戏常量定义
 * @module constants/game
 */

/** 游戏配置常量 */
export const GAME_CONSTANTS = {
  /** 座位数限制 */
  SEATS: {
    MIN: 2,
    MAX: 10,
    DEFAULT: 9
  },
  
  /** 默认盲注结构 */
  BLINDS: {
    MICRO: { small: 1, big: 2 },
    LOW: { small: 5, big: 10 },
    MEDIUM: { small: 25, big: 50 },
    HIGH: { small: 100, big: 200 }
  },
  
  /** 默认买入范围 (倍数于大盲注) */
  BUY_IN: {
    MIN_MULTIPLIER: 20,
    MAX_MULTIPLIER: 200,
    DEFAULT: 100
  },
  
  /** 操作时间限制 (秒) */
  ACTION_TIMEOUT: {
    DEFAULT: 30,
    FAST: 15,
    SLOW: 60
  },
  
  /** 每轮最大加注次数 (无限注游戏) */
  MAX_RAISES_PER_ROUND: 4
} as const;

/** 扑克牌常量 */
export const CARD_CONSTANTS = {
  /** 牌面值 */
  RANKS: ['2', '3', '4', '5', '6', '7', '8', '9', 'T', 'J', 'Q', 'K', 'A'] as const,
  
  /** 花色 */
  SUITS: {
    SPADES: 's',
    HEARTS: 'h',
    DIAMONDS: 'd',
    CLUBS: 'c'
  } as const,
  
  /** 花色显示 */
  SUIT_SYMBOLS: {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣'
  } as const,
  
  /** 牌面显示 */
  RANK_DISPLAY: {
    'T': '10',
    'J': 'J',
    'Q': 'Q',
    'K': 'K',
    'A': 'A'
  } as const
};

/** 错误代码 */
export const ERROR_CODES = {
  // 认证错误 (1xxx)
  AUTH: {
    INVALID_CREDENTIALS: 'AUTH_1001',
    TOKEN_EXPIRED: 'AUTH_1002',
    TOKEN_INVALID: 'AUTH_1003',
    UNAUTHORIZED: 'AUTH_1004',
    FORBIDDEN: 'AUTH_1005'
  },
  
  // 房间错误 (2xxx)
  ROOM: {
    NOT_FOUND: 'ROOM_2001',
    FULL: 'ROOM_2002',
    ALREADY_JOINED: 'ROOM_2003',
    NOT_JOINED: 'ROOM_2004',
    INVALID_PASSWORD: 'ROOM_2005',
    GAME_IN_PROGRESS: 'ROOM_2006'
  },
  
  // 游戏错误 (3xxx)
  GAME: {
    NOT_FOUND: 'GAME_3001',
    NOT_STARTED: 'GAME_3002',
    ALREADY_STARTED: 'GAME_3003',
    NOT_YOUR_TURN: 'GAME_3004',
    INVALID_ACTION: 'GAME_3005',
    INSUFFICIENT_CHIPS: 'GAME_3006',
    INVALID_BET_AMOUNT: 'GAME_3007'
  },
  
  // 系统错误 (9xxx)
  SYSTEM: {
    INTERNAL_ERROR: 'SYS_9001',
    SERVICE_UNAVAILABLE: 'SYS_9002',
    TIMEOUT: 'SYS_9003'
  }
} as const;

/** 房间代码生成 */
export const ROOM_CODE = {
  LENGTH: 6,
  CHARSET: 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 排除容易混淆的字符
};
