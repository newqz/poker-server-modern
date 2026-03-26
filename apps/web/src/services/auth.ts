/**
 * 认证服务
 * @module services/auth
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
    refreshToken: string
  }
  error?: {
    code: string
    message: string
  }
}

/**
 * 登录
 */
export async function login(email: string, password: string): Promise<LoginResponse> {
  const response = await fetch(`${API_URL}/api/v1/auth/login`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    credentials: 'include',  // 包含 cookie
    body: JSON.stringify({ email, password })
  })
  
  return response.json()
}

/**
 * 注册
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
    credentials: 'include',
    body: JSON.stringify({ username, email, password })
  })
  
  return response.json()
}

/**
 * 刷新 Access Token
 */
export async function refreshToken(refreshToken: string): Promise<{
  success: boolean
  accessToken?: string
  refreshToken?: string
  error?: string
}> {
  try {
    const response = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      credentials: 'include',
      body: JSON.stringify({ refreshToken })
    })
    
    const data = await response.json()
    
    if (data.success) {
      return {
        success: true,
        accessToken: data.data.accessToken,
        refreshToken: data.data.refreshToken
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
 * 登出（调用后端吊销接口）
 */
export async function logout(accessToken: string): Promise<void> {
  try {
    await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      credentials: 'include'
    })
  } catch (error) {
    console.error('Logout API call failed:', error)
  }
}
