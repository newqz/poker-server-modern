/**
 * Token 管理器
 * 自动刷新即将过期的 Access Token
 */

import { useAuthStore } from '../store'
import { refreshToken as apiRefreshToken } from './auth'

const TOKEN_CHECK_INTERVAL = 60 * 1000; // 每分钟检查一次
const TOKEN_EXPIRY_BUFFER = 5 * 60; // 提前5分钟刷新

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
    
    if (!state.isAuthenticated || !state.refreshToken) {
      return
    }

    // 检查 accessToken 是否即将过期
    // 由于我们在内存中存储，需要在发请求时检查
    // 这里主要是定期刷新，确保不会突然过期
    
    try {
      await this.refresh()
    } catch (error) {
      console.error('Auto token refresh failed:', error)
    }
  }

  /**
   * 刷新 Token
   */
  async refresh(): Promise<boolean> {
    if (this.refreshing) {
      return false
    }

    const state = useAuthStore.getState()
    if (!state.refreshToken) {
      return false
    }

    this.refreshing = true

    try {
      const result = await apiRefreshToken(state.refreshToken)

      if (result.success && result.accessToken && result.refreshToken) {
        // 更新 store 中的 token
        state.login(state.user!, result.accessToken, result.refreshToken)
        console.log('Token refreshed successfully')
        return true
      } else {
        console.error('Token refresh failed:', result.error)
        // 刷新失败，可能是 refreshToken 过期，退出登录
        state.logout()
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
   * 检查请求是否需要刷新 Token
   * 在 API 请求拦截器中调用
   */
  shouldRefresh(): boolean {
    const state = useAuthStore.getState()
    return state.isAuthenticated && !!state.accessToken
  }
}

export const tokenManager = new TokenManager()
