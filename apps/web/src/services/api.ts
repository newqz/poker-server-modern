/**
 * API 客户端
 * @module services/api
 * @description API 客户端，带自动 token 刷新功能
 * 
 * 安全设计：
 * - Access Token 存储在内存中
 * - Refresh Token 在 httpOnly Cookie 中自动处理
 * - 无需手动存储或传递 refreshToken
 */

import axios from 'axios'
import { useAuthStore } from '../store'
import { refreshAccessToken } from './auth'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  // 允许发送 credentials (cookies)
  withCredentials: true
})

// 请求拦截器 - 添加 token
apiClient.interceptors.request.use(
  (config) => {
    const token = useAuthStore.getState().accessToken
    if (token) {
      config.headers.Authorization = `Bearer ${token}`
    }
    return config
  },
  (error) => Promise.reject(error)
)

// 响应拦截器 - 处理 token 刷新
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    
    // 401 且未重试过
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        // 使用 httpOnly Cookie 中的 refreshToken 自动刷新
        const result = await refreshAccessToken()
        
        if (result.success && result.accessToken) {
          // 更新内存中的 accessToken
          useAuthStore.getState().setAccessToken(result.accessToken)
          
          // 重试原始请求
          originalRequest.headers.Authorization = `Bearer ${result.accessToken}`
          return apiClient(originalRequest)
        } else {
          // 刷新失败，登出
          useAuthStore.getState().logout()
          window.dispatchEvent(new CustomEvent('auth:session_expired'))
          return Promise.reject(error)
        }
      } catch (refreshError) {
        useAuthStore.getState().logout()
        window.dispatchEvent(new CustomEvent('auth:session_expired'))
        return Promise.reject(refreshError)
      }
    }
    
    return Promise.reject(error)
  }
)

// API 方法
export const authAPI = {
  register: (data: { username: string; email: string; password: string }) =>
    apiClient.post('/auth/register', data),
  
  login: (data: { email: string; password: string }) =>
    apiClient.post('/auth/login', data),
  
  refresh: () =>
    apiClient.post('/auth/refresh'),  // 不需要传参数，httpOnly Cookie 自动发送
}

export const roomAPI = {
  getRooms: (params?: { status?: string; page?: number; limit?: number }) =>
    apiClient.get('/rooms', { params }),
  
  getRoom: (code: string) =>
    apiClient.get(`/rooms/${code}`),
  
  createRoom: (data: {
    name: string
    maxPlayers: number
    smallBlind: number
    bigBlind: number
    minBuyIn: number
    maxBuyIn: number
    isPrivate?: boolean
    password?: string
  }) => apiClient.post('/rooms', data),
}

export const userAPI = {
  getMe: () => apiClient.get('/users/me'),
  getStats: () => apiClient.get('/users/me/stats'),
  getLeaderboard: (params?: { type?: string; limit?: number }) =>
    apiClient.get('/users/leaderboard', { params }),
}
