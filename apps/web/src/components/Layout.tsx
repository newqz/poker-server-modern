/**
 * 页面布局组件
 * @component Layout
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import { Outlet, Link, useNavigate } from 'react-router-dom'
import { useAuthStore } from '../store'

export function Layout() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  
  const handleLogout = () => {
    logout()
    navigate('/')
  }
  
  return (
    <div className="min-h-screen flex flex-col">
      {/* 导航栏 */}
      <nav className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-xl font-bold text-poker-gold">
                ♠ Poker Server
              </Link>
            </div>
            
            <div className="flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link to="/lobby" className="text-gray-300 hover:text-white">
                    游戏大厅
                  </Link>
                  <Link to="/profile" className="text-gray-300 hover:text-white">
                    {user?.username}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-300 hover:text-white"
                  >
                    退出
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="text-gray-300 hover:text-white">
                    登录
                  </Link>
                  <Link
                    to="/register"
                    className="btn-primary"
                  >
                    注册
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>
      
      {/* 主内容 */}
      <main className="flex-1">
        <Outlet />
      </main>
      
      {/* 页脚 */}
      <footer className="bg-gray-800 border-t border-gray-700 py-4">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-sm">
          Poker Server Modern © 2026
        </div>
      </footer>
    </div>
  )
}
