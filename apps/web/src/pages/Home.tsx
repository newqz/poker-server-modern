/**
 * 首页 - 增强视觉效果
 * @page Home
 * @author ARCH
 * @date 2026-03-26
 * @updated 2026-04-03 - 视觉增强
 */

import { Link } from 'react-router-dom'
import { useAuthStore } from '../store'

export function Home() {
  const { isAuthenticated } = useAuthStore()
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 relative overflow-hidden">
      {/* 背景装饰 */}
      <div className="absolute inset-0 overflow-hidden">
        {/* 渐变光晕 */}
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-poker-gold/10 rounded-full blur-3xl animate-pulse-slow"></div>
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl animate-pulse-slow" style={{ animationDelay: '1s' }}></div>
        
        {/* 扑克牌装饰 */}
        <div className="absolute top-20 left-10 text-8xl opacity-5 rotate-[-15deg] animate-float">♠</div>
        <div className="absolute top-40 right-20 text-7xl opacity-5 rotate-[20deg] animate-float" style={{ animationDelay: '0.5s' }}>♥</div>
        <div className="absolute bottom-40 left-1/4 text-6xl opacity-5 rotate-[10deg] animate-float" style={{ animationDelay: '1.5s' }}>♦</div>
        <div className="absolute bottom-20 right-1/3 text-8xl opacity-5 rotate-[-25deg] animate-float" style={{ animationDelay: '2s' }}>♣</div>
      </div>

      {/* 内容 */}
      <div className="relative z-10 min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center px-4 py-16">
        <div className="text-center max-w-4xl">
          {/* Logo */}
          <div className="mb-8">
            <div className="inline-flex items-center gap-4 mb-6">
              <span className="text-6xl md:text-8xl filter drop-shadow-lg animate-float">♠</span>
              <span className="text-6xl md:text-8xl text-red-500 filter drop-shadow-lg animate-float" style={{ animationDelay: '0.3s' }}>♥</span>
              <span className="text-6xl md:text-8xl text-red-500 filter drop-shadow-lg animate-float" style={{ animationDelay: '0.6s' }}>♦</span>
              <span className="text-6xl md:text-8xl filter drop-shadow-lg animate-float" style={{ animationDelay: '0.9s' }}>♣</span>
            </div>
          </div>
          
          {/* 标题 */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-black mb-6">
            <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-2xl">
              Poker Server
            </span>
            <span className="block text-2xl md:text-4xl mt-2 bg-gradient-to-r from-poker-gold via-yellow-300 to-poker-gold bg-clip-text text-transparent">
              Modern
            </span>
          </h1>
          
          {/* 副标题 */}
          <p className="text-lg md:text-xl text-gray-300 mb-10 max-w-2xl mx-auto leading-relaxed">
            现代化德州扑克游戏平台
            <br className="hidden sm:block" />
            多人在线对战 · 公平竞技 · 实时社交
          </p>
          
          {/* 按钮 */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {isAuthenticated ? (
              <Link 
                to="/lobby" 
                className="group relative px-8 py-4 text-lg font-bold rounded-xl overflow-hidden shadow-xl shadow-green-500/30"
              >
                <span className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 group-hover:from-green-400 group-hover:to-emerald-500 transition-all duration-300"></span>
                <span className="relative text-white flex items-center justify-center gap-2">
                  <span>🎰</span>
                  <span>进入游戏大厅</span>
                </span>
              </Link>
            ) : (
              <>
                <Link 
                  to="/login" 
                  className="group relative px-8 py-4 text-lg font-bold rounded-xl overflow-hidden shadow-xl shadow-blue-500/30"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-blue-500 to-indigo-600 group-hover:from-blue-400 group-hover:to-indigo-500 transition-all duration-300"></span>
                  <span className="relative text-white flex items-center justify-center gap-2">
                    <span>🔑</span>
                    <span>登录</span>
                  </span>
                </Link>
                <Link 
                  to="/register" 
                  className="group relative px-8 py-4 text-lg font-bold rounded-xl overflow-hidden shadow-xl shadow-poker-gold/30 border-2 border-poker-gold/50"
                >
                  <span className="absolute inset-0 bg-gradient-to-r from-poker-gold to-yellow-500 group-hover:from-yellow-400 group-hover:to-yellow-500 transition-all duration-300"></span>
                  <span className="relative text-gray-900 flex items-center justify-center gap-2">
                    <span>✨</span>
                    <span>注册账号</span>
                  </span>
                </Link>
              </>
            )}
          </div>
        </div>
        
        {/* 特性介绍 */}
        <div className="grid md:grid-cols-3 gap-6 mt-20 max-w-5xl w-full px-4">
          <FeatureCard
            icon="⚡"
            title="实时对战"
            description="低延迟 WebSocket 连接，流畅的游戏体验，支持万人同时在线"
            gradient="from-yellow-500/20 to-orange-500/20"
            borderColor="border-yellow-500/30"
            iconBg="bg-yellow-500/20"
          />
          <FeatureCard
            icon="🏆"
            title="公平竞技"
            description="服务器权威验证，可验证随机发牌，多重反作弊机制保障"
            gradient="from-blue-500/20 to-indigo-500/20"
            borderColor="border-blue-500/30"
            iconBg="bg-blue-500/20"
          />
          <FeatureCard
            icon="💬"
            title="社交互动"
            description="内置聊天系统，表情互动，结识来自世界各地的扑克爱好者"
            gradient="from-green-500/20 to-emerald-500/20"
            borderColor="border-green-500/30"
            iconBg="bg-green-500/20"
          />
        </div>
      </div>
    </div>
  )
}

/** 特性卡片组件 */
function FeatureCard({
  icon,
  title,
  description,
  gradient,
  borderColor,
  iconBg
}: {
  icon: string
  title: string
  description: string
  gradient: string
  borderColor: string
  iconBg: string
}) {
  return (
    <div className={`group relative bg-gradient-to-br ${gradient} backdrop-blur-sm rounded-2xl border ${borderColor} p-6 hover:scale-105 transition-all duration-300 hover:shadow-xl`}>
      {/* 图标 */}
      <div className={`inline-flex items-center justify-center w-14 h-14 ${iconBg} rounded-xl text-3xl mb-4 group-hover:scale-110 transition-transform`}>
        {icon}
      </div>
      
      {/* 标题 */}
      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-poker-gold transition-colors">
        {title}
      </h3>
      
      {/* 描述 */}
      <p className="text-gray-400 text-sm leading-relaxed">
        {description}
      </p>
      
      {/* 装饰 */}
      <div className="absolute -bottom-1 right-0 w-20 h-20 bg-gradient-to-t from-white/5 to-transparent rounded-full blur-xl"></div>
    </div>
  )
}
