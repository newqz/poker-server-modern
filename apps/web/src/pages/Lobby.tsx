/**
 * 游戏大厅页面 - 增强视觉效果
 * @page Lobby
 * @author ARCH
 * @date 2026-03-26
 * @task FE-003
 * @updated 2026-04-03 - 视觉增强
 */

import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { roomAPI } from '../services/api'
import { socketService } from '../services/socket'
import { useAuthStore } from '../store'

export function Lobby() {
  const { user } = useAuthStore()
  const [showCreateModal, setShowCreateModal] = useState(false)

  // 获取房间列表
  const { data: roomsData, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomAPI.getRooms({ status: 'WAITING' }),
    refetchInterval: 5000,
  })

  // 连接 Socket
  useEffect(() => {
    socketService.connect()
    return () => {
      socketService.disconnect()
    }
  }, [])

  const rooms = roomsData?.data.data || []

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* 头部信息卡 */}
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-gray-800 via-gray-800/95 to-gray-800 border border-gray-700/50 p-5 sm:p-8 mb-6 sm:mb-10">
          {/* 装饰 */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-poker-gold/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-blue-500/5 rounded-full blur-3xl"></div>
          
          <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 sm:gap-6">
            <div>
              <h1 className="text-2xl sm:text-3xl font-black mb-2">
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  欢迎回来,
                </span>
                <span className="block text-poker-gold mt-1">{user?.username}!</span>
              </h1>
              <div className="flex items-center gap-2 text-sm sm:text-base text-gray-400">
                <span className="text-gray-500">💰</span>
                <span>筹码余额:</span>
                <span className="text-poker-gold font-bold text-lg">
                  ${user?.balance.toLocaleString()}
                </span>
              </div>
            </div>

            <button
              onClick={() => setShowCreateModal(true)}
              className="group relative px-6 py-3 text-base font-bold rounded-xl overflow-hidden shadow-lg shadow-green-500/20"
            >
              <span className="absolute inset-0 bg-gradient-to-r from-green-500 to-emerald-600 group-hover:from-green-400 group-hover:to-emerald-500 transition-all duration-300"></span>
              <span className="relative flex items-center justify-center gap-2 text-white">
                <span className="text-xl">✨</span>
                <span>创建房间</span>
              </span>
            </button>
          </div>
        </div>

        {/* 房间列表标题 */}
        <div className="flex items-center gap-3 mb-4 sm:mb-6">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-poker-green to-emerald-700 flex items-center justify-center shadow-lg">
            <span className="text-xl">🎰</span>
          </div>
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white">游戏房间</h2>
            <p className="text-sm text-gray-400">{rooms.length} 个房间等待加入</p>
          </div>
        </div>

        {/* 房间列表 */}
        <div className="relative rounded-2xl overflow-hidden bg-gray-800/50 backdrop-blur-sm border border-gray-700/50">
          {/* 加载状态 */}
          {isLoading && (
            <div className="p-12 text-center">
              <div className="animate-spin w-12 h-12 border-4 border-poker-gold border-t-transparent rounded-full mx-auto mb-4"></div>
              <p className="text-gray-400 animate-pulse">加载房间中...</p>
            </div>
          )}

          {/* 无房间 */}
          {!isLoading && rooms.length === 0 && (
            <div className="p-12 text-center">
              <div className="text-6xl mb-4">🃏</div>
              <p className="text-xl text-gray-300 mb-2">暂无等待中的房间</p>
              <p className="text-gray-500 mb-6">成为第一个创建房间的玩家吧！</p>
              <button
                onClick={() => setShowCreateModal(true)}
                className="btn-primary px-6 py-3"
              >
                + 创建房间
              </button>
            </div>
          )}

          {/* 房间列表 - 移动端卡片 */}
          {!isLoading && rooms.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 p-3 sm:p-4">
              {rooms.map((room: any, index: number) => (
                <Link
                  key={room.id}
                  to={`/room/${room.code}`}
                  className="group relative bg-gradient-to-br from-gray-800/80 to-gray-900/80 rounded-xl p-4 border border-gray-700/30 hover:border-poker-green/50 transition-all duration-300 hover:scale-[1.02] hover:shadow-xl hover:shadow-green-500/10"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  {/* 房间状态指示器 */}
                  <div className="absolute top-3 right-3">
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-green-500/10 border border-green-500/20">
                      <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                      <span className="text-xs text-green-400 font-medium">等待中</span>
                    </div>
                  </div>

                  {/* 房间名称 */}
                  <h3 className="font-bold text-base sm:text-lg text-white mb-3 pr-16 truncate group-hover:text-poker-gold transition-colors">
                    {room.name}
                  </h3>

                  {/* 房间信息 */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="text-gray-500">🏷️</span>
                      <span className="font-mono bg-gray-700/50 px-2 py-0.5 rounded text-xs">
                        {room.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="text-gray-500">💎</span>
                      <span className="text-poker-gold font-semibold">
                        ${room.smallBlind}/${room.bigBlind}
                      </span>
                      <span className="text-gray-500">盲注</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-400">
                      <span className="text-gray-500">📊</span>
                      <span>
                        买入: ${room.minBuyIn.toLocaleString()} - ${room.maxBuyIn.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* 玩家数 */}
                  <div className="flex items-center justify-between pt-3 border-t border-gray-700/30">
                    <div className="flex items-center gap-2">
                      <div className="flex -space-x-2">
                        {room.members.slice(0, 3).map((m: any, i: number) => (
                          <div
                            key={i}
                            className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 border-2 border-gray-800 flex items-center justify-center text-[10px] font-bold text-white"
                          >
                            {m.user.username.charAt(0).toUpperCase()}
                          </div>
                        ))}
                        {room.members.length > 3 && (
                          <div className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center text-[10px] font-bold text-gray-300">
                            +{room.members.length - 3}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-lg font-bold text-white">
                        {room._count?.members || room.members?.length || 0}
                      </span>
                      <span className="text-gray-500">/</span>
                      <span className="text-lg font-bold text-gray-400">
                        {room.maxPlayers}
                      </span>
                    </div>
                  </div>

                  {/* 悬停箭头 */}
                  <div className="absolute bottom-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                    <span className="text-poker-gold text-xl">→</span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <CreateRoomModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

/** 创建房间弹窗 */
function CreateRoomModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    maxPlayers: 6,
    smallBlind: 10,
    bigBlind: 20,
    minBuyIn: 1000,
    maxBuyIn: 10000,
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    socketService.createRoom(formData)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="relative w-full max-w-md bg-gradient-to-b from-gray-800 to-gray-900 rounded-2xl border border-gray-700/50 shadow-2xl overflow-hidden">
        {/* 装饰 */}
        <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-green-500 via-emerald-500 to-green-500"></div>
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-white">创建房间</h2>
            <button
              onClick={onClose}
              className="w-8 h-8 rounded-full bg-gray-700 hover:bg-gray-600 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
            >
              ✕
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                房间名称
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="input"
                placeholder="输入房间名称"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  小盲注
                </label>
                <input
                  type="number"
                  value={formData.smallBlind}
                  onChange={(e) => setFormData({ ...formData, smallBlind: Number(e.target.value) })}
                  className="input"
                  min={1}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  大盲注
                </label>
                <input
                  type="number"
                  value={formData.bigBlind}
                  onChange={(e) => setFormData({ ...formData, bigBlind: Number(e.target.value) })}
                  className="input"
                  min={2}
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  最小买入
                </label>
                <input
                  type="number"
                  value={formData.minBuyIn}
                  onChange={(e) => setFormData({ ...formData, minBuyIn: Number(e.target.value) })}
                  className="input"
                  min={100}
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  最大买入
                </label>
                <input
                  type="number"
                  value={formData.maxBuyIn}
                  onChange={(e) => setFormData({ ...formData, maxBuyIn: Number(e.target.value) })}
                  className="input"
                  min={100}
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                最大玩家数: {formData.maxPlayers}
              </label>
              <input
                type="range"
                min={2}
                max={9}
                value={formData.maxPlayers}
                onChange={(e) => setFormData({ ...formData, maxPlayers: Number(e.target.value) })}
                className="w-full accent-green-500"
              />
            </div>

            <div className="flex gap-4 pt-2">
              <button type="button" onClick={onClose} className="flex-1 btn-secondary py-3">
                取消
              </button>
              <button type="submit" className="flex-1 btn-primary py-3">
                创建
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
