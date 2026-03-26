/**
 * 登录页面
 * @page Login
 * @author ARCH
 * @date 2026-03-26
 * @task FE-002
 */

import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore, useUIStore } from '../store'

export function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const { setUser, setTokens } = useAuthStore()
  const { isLoading, setLoading, error, setError } = useUIStore()
  
  const [formData, setFormData] = useState({
    email: '',
    password: '',
  })
  
  const from = (location.state as any)?.from?.pathname || '/lobby'
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    
    try {
      const response = await authAPI.login(formData)
      const { user, accessToken, refreshToken } = response.data.data
      
      setUser(user)
      setTokens(accessToken, refreshToken)
      
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '登录失败')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center mb-8">登录</h1>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              邮箱
            </label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              className="input"
              placeholder="your@email.com"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              密码
            </label>
            <input
              type="password"
              value={formData.password}
              onChange={(e) => setFormData({ ...formData, password: e.target.value })}
              className="input"
              placeholder="••••••••"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {isLoading ? '登录中...' : '登录'}
          </button>
        </form>
        
        <p className="mt-6 text-center text-gray-400">
          还没有账号？{' '}
          <Link to="/register" className="text-poker-green hover:underline">
            立即注册
          </Link>
        </p>
      </div>
    </div>
  )
}
