/**
 * 注册页面
 * @page Register
 * @author ARCH
 * @date 2026-03-26
 * @task FE-002
 */

import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { authAPI } from '../services/api'
import { useAuthStore, useUIStore } from '../store'

export function Register() {
  const navigate = useNavigate()
  const { login } = useAuthStore()
  const { isLoading, setLoading, error, setError } = useUIStore()
  
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (formData.password !== formData.confirmPassword) {
      setError('两次输入的密码不一致')
      return
    }
    
    setLoading(true)
    setError(null)
    
    try {
      const { confirmPassword, ...registerData } = formData
      const response = await authAPI.register(registerData)
      const { user, accessToken } = response.data.data
      
      // refreshToken 已通过 httpOnly Cookie 设置，前端不需要存储
      login(user, accessToken)
      
      navigate('/lobby')
    } catch (err: any) {
      setError(err.response?.data?.error?.message || '注册失败')
    } finally {
      setLoading(false)
    }
  }
  
  return (
    <div className="min-h-[calc(100vh-8rem)] flex items-center justify-center px-4">
      <div className="card w-full max-w-md p-8">
        <h1 className="text-3xl font-bold text-center mb-8">注册</h1>
        
        {error && (
          <div className="bg-red-900/50 border border-red-500 text-red-200 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              用户名
            </label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              className="input"
              placeholder="3-32位字母数字下划线"
              pattern="^[a-zA-Z0-9_]{3,32}$"
              required
            />
          </div>
          
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
              placeholder="至少8位"
              minLength={8}
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-2">
              确认密码
            </label>
            <input
              type="password"
              value={formData.confirmPassword}
              onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
              className="input"
              placeholder="再次输入密码"
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isLoading}
            className="w-full btn-primary py-3 disabled:opacity-50"
          >
            {isLoading ? '注册中...' : '注册'}
          </button>
        </form>
        
        <p className="mt-6 text-center text-gray-400">
          已有账号？{' '}
          <Link to="/login" className="text-poker-green hover:underline">
            立即登录
          </Link>
        </p>
      </div>
    </div>
  )
}
