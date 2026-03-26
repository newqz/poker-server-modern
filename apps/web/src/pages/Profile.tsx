/**
 * 个人中心页面
 * @page Profile
 * @author ARCH
 * @date 2026-03-26
 * @task FE-002
 */

import { useQuery } from '@tanstack/react-query'
import { userAPI } from '../services/api'
import { useAuthStore } from '../store'

export function Profile() {
  const { user } = useAuthStore()
  
  const { data: statsData } = useQuery({
    queryKey: ['userStats'],
    queryFn: () => userAPI.getStats(),
  })
  
  const stats = statsData?.data.data || {}
  
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* 用户信息卡片 */}
      <div className="card p-8 mb-8">
        <div className="flex items-center gap-6">
          <div className="w-24 h-24 bg-poker-green rounded-full flex items-center justify-center text-3xl font-bold">
            {user?.username[0].toUpperCase()}
          </div>
          
          <div className="flex-1">
            <h1 className="text-3xl font-bold mb-2">{user?.username}</h1>
            <p className="text-gray-400 mb-4">{user?.email}</p>
            
            <div className="flex gap-8">
              <div>
                <div className="text-2xl font-bold text-poker-gold">
                  {user?.balance.toLocaleString()}
                </div>
                <div className="text-sm text-gray-400">筹码余额</div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* 统计数据 */}
      <div className="grid md:grid-cols-2 gap-8">
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-6">游戏统计</h2>
          
          <div className="grid grid-cols-2 gap-4">
            <StatItem label="总游戏数" value={stats.totalGames || 0} />
            <StatItem label="获胜次数" value={stats.totalWins || 0} />
            <StatItem label="失败次数" value={stats.totalLosses || 0} />
            <StatItem 
              label="胜率" 
              value={`${stats.winRate?.toFixed(1) || 0}%`} 
            />
            <StatItem 
              label="总收益" 
              value={stats.totalProfit || 0}
              isCurrency
            />
            <StatItem 
              label="最大赢取" 
              value={stats.biggestWin || 0}
              isCurrency
            />
          </div>
        </div>
        
        <div className="card p-6">
          <h2 className="text-xl font-bold mb-6">成就</h2>
          
          <div className="space-y-4">
            <AchievementItem
              title="初来乍到"
              description="完成第一场游戏"
              unlocked={stats.totalGames > 0}
            />
            <AchievementItem
              title="首胜"
              description="赢得第一场游戏"
              unlocked={stats.totalWins > 0}
            />
            
            <AchievementItem
              title="百战老兵"
              description="完成100场游戏"
              unlocked={stats.totalGames >= 100}
            />
            
            <AchievementItem
              title="大赢家"
              description="单局赢取超过10000筹码"
              unlocked={stats.biggestWin >= 10000}
            />
          </div>
        </div>
      </div>
    </div>
  )
}

// 统计项组件
function StatItem({ 
  label, 
  value, 
  isCurrency = false 
}: { 
  label: string
  value: string | number
  isCurrency?: boolean
}) {
  const displayValue = isCurrency 
    ? `¥${Number(value).toLocaleString()}`
    : value
  
  return (
    <div className="bg-gray-700/50 rounded-lg p-4">
      <div className="text-2xl font-bold">{displayValue}</div>
      <div className="text-sm text-gray-400">{label}</div>
    </div>
  )
}

// 成就项组件
function AchievementItem({
  title,
  description,
  unlocked,
}: {
  title: string
  description: string
  unlocked: boolean
}) {
  return (
    <div className={`flex items-center gap-4 p-4 rounded-lg ${
      unlocked ? 'bg-poker-green/20' : 'bg-gray-700/30'
    }`}>
      <div className={`w-12 h-12 rounded-full flex items-center justify-center ${
        unlocked ? 'bg-poker-gold text-black' : 'bg-gray-700 text-gray-500'
      }`}>
        {unlocked ? '★' : '○'}
      </div>
      
      <div className={unlocked ? '' : 'opacity-50'}>
        <div className="font-bold">{title}</div>
        <div className="text-sm text-gray-400">{description}</div>
      </div>
    </div>
  )
}
