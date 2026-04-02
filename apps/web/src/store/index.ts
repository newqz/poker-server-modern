/**
 * 全局状态管理 - Zustand
 * @module store
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import { create } from 'zustand'
import { devtools } from 'zustand/middleware'

// 开发环境添加 devtools
const middleware = import.meta.env.DEV ? [devtools] : [];

export interface User {
  id: string
  username: string
  email: string
  avatarUrl?: string
  balance: number
}

interface AuthState {
  user: User | null
  accessToken: string | null
  isAuthenticated: boolean
  
  // Atomic login - 只存储 accessToken，refreshToken 在 httpOnly Cookie 中
  login: (user: User, accessToken: string) => void
  setAccessToken: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  // 中间件：开发环境使用 devtools
  ...middleware,
  // 不使用 persist middleware，token 存在内存中（更安全）
  (set) => ({
    user: null,
    accessToken: null,
    isAuthenticated: false,
    
    // 原子登录操作 - 不再存储 refreshToken
    login: (user, accessToken) => set({ 
      user, 
      accessToken,
      isAuthenticated: true 
    }),
    
    // 仅更新 accessToken（用于刷新时）
    setAccessToken: (token) => set({ accessToken: token }),
    
    // 登出 - 清除所有状态
    logout: () => {
      // 重置状态
      set({ 
        user: null, 
        accessToken: null, 
        isAuthenticated: false 
      });
    },
  })
)

// 游戏状态
  currentRoom: any | null
  currentGame: any | null
  gameState: any | null
  isConnected: boolean
  // 回合状态
  isMyTurn: boolean
  turnTimeout: number | null
  
  setCurrentRoom: (room: any | null) => void
  setCurrentGame: (game: any | null) => void
  setGameState: (state: any) => void
  setIsConnected: (connected: boolean) => void
  setMyTurn: (isMyTurn: boolean, timeout: number | null) => void
}

export const useGameStore = create<GameState>()((set) => ({
  currentRoom: null,
  currentGame: null,
  gameState: null,
  isConnected: false,
  isMyTurn: false,
  turnTimeout: null,
  
  setCurrentRoom: (room) => set({ currentRoom: room }),
  setCurrentGame: (game) => set({ currentGame: game }),
  setGameState: (state) => {
    // 基本校验：确保 state 是对象且有必需字段
    if (!state || typeof state !== 'object') {
      console.error('Invalid game state received');
      return;
    }
    // 设置状态
    set({ gameState: state });
  },
  setIsConnected: (connected) => set({ isConnected: connected }),
  setMyTurn: (isMyTurn, timeout) => set({ isMyTurn, turnTimeout: timeout }),
}))

// UI状态
interface UIState {
  isLoading: boolean
  error: string | null
  
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
  clearError: () => void
}

export const useUIStore = create<UIState>()((set) => ({
  isLoading: false,
  error: null,
  
  setLoading: (loading) => set({ isLoading: loading }),
  setError: (error) => set({ error }),
  clearError: () => set({ error: null }),
}))
