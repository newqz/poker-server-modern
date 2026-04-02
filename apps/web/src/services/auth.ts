/**
 * 认证服务
 * @module services/auth
 * @description 认证服务，使用 httpOnly Cookie 存储 refreshToken
 * 
 * 安全设计：
 * - Access Token: 存储在内存中 (Zustand store)
 * - Refresh Token: 仅存在于 httpOnly Cookie，由后端设置
 * - 前端不存储 refreshToken，避免 XSS 攻击
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface LoginResponse {
  success: boolean
  data?: {
    user: {
      id: string
      username: string
      email: string
      balance: number
    }
    accessToken: string
    // 注意：refreshToken 不再从 body 返回，已通过 httpOnly Cookie 设置
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * 登录
 * - 后端返回 accessToken (内存存储)
 * - 后端设置 refreshToken 为 httpOnly Cookie
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',  // 包含 httpOnly Cookie
    body: JSON.stringify({ email, password })
  })
  
  return response.json()
}

/**
 * 注册
 * - 后端返回 accessToken (内存存储)
 * - 后端设置 refreshToken 为 httpOnly Cookie
 */
export async function register(
  username: string, 
  email: string, 
  password: string
): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/register`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',  // 包含 httpOnly Cookie
    body: JSON.stringify({ username, email, password })
  })
  
  return response.json()
}

/**
 * 刷新 Access Token
 * - 自动使用 httpOnly Cookie 中的 refreshToken
 * - 无需手动传递 refreshToken
 */
export async function refreshAccessToken(): Promise<{
  success: boolean
  accessToken?: string
  error?: string
}> {
  try {
    // credentials: 'include' 会自动发送 httpOnly Cookie
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'  // 关键：自动发送 httpOnly Cookie
    })
    
    const data = await response.json()
    
    if (data.success) {
      return {
        success: true,
        accessToken: data.data.accessToken
        // 新的 refreshToken 会在 response cookie 中自动更新
      }
    } else {
      return {
        success: false,
        error: data.error?.message || 'Token refresh failed'
      }
    }
  } catch (error) {
    return {
      success: false,
      error: 'Network error during token refresh'
    }
  }
}

/**
 * 登出
 * - 调用后端登出接口（会清除 httpOnly Cookie）
 * - 清除本地存储的 accessToken
 */
export async function logout(accessToken: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'  // 确保 cookie 被发送
    })
  } catch (error) {
    console.error('Logout API call failed:', error)
  }
}

/**
 * 检查认证状态
 * - 尝试刷新 token 来验证会话是否有效
 */
export async function checkAuth(): Promise<{
  isValid: boolean
  newAccessToken?: string
}> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })
    
    const data = await response.json()
    
    if (data.success) {
      return {
        isValid: true,
        newAccessToken: data.data.accessToken
      }
    } else {
      return { isValid: false }
    }
  } catch (error) {
    return { isValid: false }
  }
}
