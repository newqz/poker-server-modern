/**
 * API 客户端
 * @module services/api
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import axios from 'axios'
import { useAuthStore } from '../store'

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1'

// 创建 axios 实例
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
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
    
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      
      try {
        const refreshToken = useAuthStore.getState().refreshToken
        if (!refreshToken) {
          useAuthStore.getState().logout()
          return Promise.reject(error)
        }
        
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {
          refreshToken,
        })
        
        const { accessToken, refreshToken: newRefreshToken } = response.data.data
        useAuthStore.getState().setTokens(accessToken, newRefreshToken)
        
        originalRequest.headers.Authorization = `Bearer ${accessToken}`
        return apiClient(originalRequest)
      } catch (refreshError) {
        useAuthStore.getState().logout()
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
  
  refresh: (refreshToken: string) =>
    apiClient.post('/auth/refresh', { refreshToken }),
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
