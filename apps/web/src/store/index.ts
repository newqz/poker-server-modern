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
  refreshToken: string | null
  isAuthenticated: boolean
  
  // Atomic login - 避免中间状态
  login: (user: User, accessToken: string, refreshToken: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  // 中间件：开发环境使用 devtools
  ...middleware,
  // 不使用 persist middleware，token 存在内存中
  (set) => ({
    user: null,
    accessToken: null,
    refreshToken: null,
    isAuthenticated: false,
    
    // 原子登录操作
    login: (user, accessToken, refreshToken) => set({ 
      user, 
      accessToken, 
      refreshToken,
      isAuthenticated: true 
    }),
    
    // 登出 - 清除所有状态
    logout: () => {
      // 清除持久化存储
      localStorage.removeItem('poker-auth-storage');
      // 重置状态
      set({ 
        user: null, 
        accessToken: null, 
        refreshToken: null, 
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
