/**
 * Token 管理器
 * @module services/tokenManager
 * @description 自动刷新即将过期的 Access Token
 * 
 * 安全设计：
 * - Access Token 存储在内存中
 * - Refresh Token 仅存在于 httpOnly Cookie，由浏览器自动发送
 * - 无需手动存储或传递 refreshToken
 */

import { useAuthStore } from '../store'
import { refreshAccessToken } from './auth'

const TOKEN_CHECK_INTERVAL = 60 * 1000; // 每分钟检查一次
const TOKEN_EXPIRY_BUFFER_SECONDS = 5 * 60; // 提前5分钟刷新

class TokenManager {
  private intervalId: number | null = null
  private refreshing = false

  /**
   * 启动 Token 管理器
   */
  start() {
    if (this.intervalId) return

    this.intervalId = window.setInterval(() => {
      this.checkAndRefresh()
    }, TOKEN_CHECK_INTERVAL)

    console.log('Token manager started')
  }

  /**
   * 停止 Token 管理器
   */
  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
      console.log('Token manager stopped')
    }
  }

  /**
   * 检查并刷新 Token
   */
  private async checkAndRefresh() {
    const state = useAuthStore.getState()
    
    // 需要已认证且有 accessToken
    if (!state.isAuthenticated || !state.accessToken) {
      return
    }

    try {
      // 检查 token 是否即将过期
      if (this.isTokenExpiringSoon(state.accessToken)) {
        console.log('Token expiring soon, refreshing...')
        await this.refresh()
      }
    } catch (error) {
      console.error('Token refresh check failed:', error)
    }
  }

  /**
   * 检查 Access Token 是否即将过期
   * 解码 JWT 检查 exp 字段
   */
  private isTokenExpiringSoon(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const expiryTime = payload.exp * 1000 // 转换为毫秒
      const bufferMs = TOKEN_EXPIRY_BUFFER_SECONDS * 1000
      const timeUntilExpiry = expiryTime - Date.now()
      
      // 如果距离过期时间少于 buffer，则需要刷新
      return timeUntilExpiry < bufferMs
    } catch (error) {
      // 如果无法解析 JWT，保守假设需要刷新
      console.warn('Failed to parse token, assuming expiring soon')
      return true
    }
  }

  /**
   * 刷新 Token
   * 使用 httpOnly Cookie 中的 refreshToken 自动刷新
   */
  async refresh(): Promise<boolean> {
    if (this.refreshing) {
      console.log('Refresh already in progress, skipping')
      return false
    }

    this.refreshing = true

    try {
      // 调用刷新接口，httpOnly Cookie 会自动发送
      const result = await refreshAccessToken()

      if (result.success && result.accessToken) {
        // 更新 store 中的 accessToken
        useAuthStore.getState().setAccessToken(result.accessToken)
        console.log('Token refreshed successfully')
        return true
      } else {
        console.error('Token refresh failed:', result.error)
        // 刷新失败，可能是会话过期，退出登录
        useAuthStore.getState().logout()
        window.dispatchEvent(new CustomEvent('auth:session_expired'))
        return false
      }
    } catch (error) {
      console.error('Token refresh error:', error)
      return false
    } finally {
      this.refreshing = false
    }
  }

  /**
   * 检查是否应该刷新 Token（在 API 请求前调用）
   */
  shouldRefresh(): boolean {
    const state = useAuthStore.getState()
    if (!state.isAuthenticated || !state.accessToken) {
      return false
    }
    return this.isTokenExpiringSoon(state.accessToken)
  }
}

export const tokenManager = new TokenManager()
