/**
 * 首页
 * @page Home
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import { Link } from 'react-router-dom'
import { useAuthStore } from '../store'

export function Home() {
  const { isAuthenticated } = useAuthStore()
  
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4">
      <div className="text-center">
        <h1 className="text-5xl md:text-7xl font-bold mb-6">
          <span className="text-poker-gold">♠</span>
          <span className="text-red-500">♥</span>
          <span className="text-black">♣</span>
          <span className="text-red-500">♦</span>
        </h1>
        
        <h2 className="text-3xl md:text-4xl font-bold mb-4">
          Poker Server Modern
        </h2>
        
        <p className="text-xl text-gray-400 mb-8 max-w-2xl">
          现代化的德州扑克游戏平台，支持多人在线对战，
          实时语音聊天，公平竞技环境
        </p>
        
        <div className="flex gap-4 justify-center">
          {isAuthenticated ? (
            <Link to="/lobby" className="btn-primary text-lg px-8 py-3">
              进入游戏大厅
            </Link>
          ) : (
            <>
              <Link to="/login" className="btn-primary text-lg px-8 py-3">
                登录
              </Link>
              <Link to="/register" className="btn-secondary text-lg px-8 py-3">
                注册账号
              </Link>
            </>
          )}
        </div>
      </div>
      
      {/* 特性介绍 */}
      <div className="grid md:grid-cols-3 gap-8 mt-16 max-w-5xl w-full">
        <div className="card p-6">
          <h3 className="text-xl font-bold mb-2 text-poker-gold">🎮 实时对战</h3>
          <p className="text-gray-400">低延迟 WebSocket 连接，流畅的游戏体验</p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-xl font-bold mb-2 text-poker-gold">🏆 公平竞技</h3>
          <p className="text-gray-400">服务器权威验证，杜绝作弊行为</p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-xl font-bold mb-2 text-poker-gold">💬 社交互动</h3>
          <p className="text-gray-400">内置聊天系统，结识更多扑克爱好者</p>
        </div>
      </div>
    </div>
  )
}
