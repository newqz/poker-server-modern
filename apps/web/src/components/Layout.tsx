/**
 * 页面布局组件 - 响应式 + 移动端 Hamburger 菜单
 * @component Layout
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 * @updated 2026-03-28 - 添加移动端 hamburger 菜单
 */

import { useState } from 'react'
import { Outlet, Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../store'

export function Layout() {
  const { user, isAuthenticated, logout } = useAuthStore()
  const navigate = useNavigate()
  const location = useLocation()
  const [menuOpen, setMenuOpen] = useState(false)

  const handleLogout = () => {
    logout()
    setMenuOpen(false)
    navigate('/')
  }

  const closeMenu = () => setMenuOpen(false)

  // 在游戏房间内隐藏导航栏底部间距（Room 有自己的固定按钮区）
  const isInRoom = location.pathname.startsWith('/room/')

  return (
    <div className="min-h-screen flex flex-col">
      {/* 导航栏 */}
      <nav className="bg-gray-800 border-b border-gray-700 relative z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-14 sm:h-16">
            {/* Logo */}
            <div className="flex items-center">
              <Link
                to="/"
                className="text-lg sm:text-xl font-bold text-poker-gold"
                onClick={closeMenu}
              >
                ♠ Poker Server
              </Link>
            </div>

            {/* 桌面端导航 */}
            <div className="hidden sm:flex items-center gap-4">
              {isAuthenticated ? (
                <>
                  <Link
                    to="/lobby"
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    游戏大厅
                  </Link>
                  <Link
                    to="/profile"
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    {user?.username}
                  </Link>
                  <button
                    onClick={handleLogout}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    退出
                  </button>
                </>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    登录
                  </Link>
                  <Link to="/register" className="btn-primary">
                    注册
                  </Link>
                </>
              )}
            </div>

            {/* 移动端 Hamburger 按钮 */}
            <div className="flex items-center sm:hidden">
              <button
                onClick={() => setMenuOpen(!menuOpen)}
                className="inline-flex items-center justify-center w-10 h-10 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-poker-gold transition-colors"
                aria-expanded={menuOpen}
                aria-label="主菜单"
              >
                {menuOpen ? (
                  /* X 关闭图标 */
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                ) : (
                  /* Hamburger 图标 */
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth="2"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* 移动端下拉菜单 */}
        {menuOpen && (
          <>
            {/* 背景遮罩 */}
            <div
              className="fixed inset-0 bg-black/50 sm:hidden z-30"
              onClick={closeMenu}
            />
            {/* 菜单面板 */}
            <div className="absolute top-full left-0 right-0 bg-gray-800 border-b border-gray-700 shadow-xl sm:hidden z-40">
              <div className="px-4 py-3 space-y-1">
                {isAuthenticated ? (
                  <>
                    {/* 用户信息 */}
                    <div className="px-3 py-2 border-b border-gray-700 mb-2">
                      <div className="text-white font-bold">
                        {user?.username}
                      </div>
                      <div className="text-poker-gold text-sm">
                        余额: {user?.balance?.toLocaleString() || '0'}
                      </div>
                    </div>

                    <MobileNavLink to="/lobby" onClick={closeMenu}>
                      🎰 游戏大厅
                    </MobileNavLink>
                    <MobileNavLink to="/profile" onClick={closeMenu}>
                      👤 个人资料
                    </MobileNavLink>
                    <button
                      onClick={handleLogout}
                      className="w-full text-left px-3 py-3 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors min-h-touch"
                    >
                      🚪 退出登录
                    </button>
                  </>
                ) : (
                  <>
                    <MobileNavLink to="/login" onClick={closeMenu}>
                      登录
                    </MobileNavLink>
                    <MobileNavLink to="/register" onClick={closeMenu}>
                      注册
                    </MobileNavLink>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </nav>

      {/* 主内容 */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* 页脚 - 在游戏房间内隐藏 */}
      {!isInRoom && (
        <footer className="bg-gray-800 border-t border-gray-700 py-3 sm:py-4">
          <div className="max-w-7xl mx-auto px-4 text-center text-gray-400 text-xs sm:text-sm">
            Poker Server Modern © 2026
          </div>
        </footer>
      )}
    </div>
  )
}

/** 移动端导航链接 - 触摸友好 */
function MobileNavLink({
  to,
  onClick,
  children,
}: {
  to: string
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <Link
      to={to}
      onClick={onClick}
      className="block px-3 py-3 rounded-md text-gray-300 hover:text-white hover:bg-gray-700 transition-colors min-h-touch"
    >
      {children}
    </Link>
  )
}
