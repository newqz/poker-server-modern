/**
 * 游戏大厅页面
 * @page Lobby
 * @author ARCH
 * @date 2026-03-26
 * @task FE-003
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
    refetchInterval: 5000, // 每5秒刷新
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
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* 头部信息 */}
      <div className="card p-6 mb-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold mb-2">欢迎, {user?.username}! 👋</h1>
            <p className="text-gray-400">
              筹码余额: <span className="text-poker-gold font-bold">{user?.balance.toLocaleString()}</span>
            </p>
          </div>
          
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn-primary text-lg px-6 py-3"
          >
            + 创建房间
          </button>
        </div>
      </div>
      
      {/* 房间列表 */}
      <div className="card">
        <div className="p-6 border-b border-gray-700">
          <h2 className="text-xl font-bold">游戏房间</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center text-gray-400">加载中...</div>
        ) : rooms.length === 0 ? (
          <div className="p-8 text-center text-gray-400">
            暂无房间，快来创建一个吧！
          </div>
        ) : (
          <div className="divide-y divide-gray-700">
            {rooms.map((room: any) => (
              <Link
                key={room.id}
                to={`/room/${room.code}`}
                className="p-6 flex items-center justify-between hover:bg-gray-700/50 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-poker-green rounded-lg flex items-center justify-center text-xl font-bold">
                    {room.code}
                  </div>
                  
                  <div>
                    <h3 className="font-bold">{room.name}</h3>
                    <p className="text-sm text-gray-400">
                      盲注: {room.smallBlind}/{room.bigBlind} | 
                      买入: {room.minBuyIn}-{room.maxBuyIn}
                    </p>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="text-lg font-bold">
                    {room._count.members}/{room.maxPlayers}
                  </div>
                  <div className="text-sm text-gray-400">玩家</div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
      
      {/* 创建房间弹窗 */}
      {showCreateModal && (
        <CreateRoomModal onClose={() => setShowCreateModal(false)} />
      )}
    </div>
  )
}

// 创建房间弹窗
function CreateRoomModal({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    name: '',
    maxPlayers: 9,
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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="card w-full max-w-md p-6">
        <h2 className="text-2xl font-bold mb-6">创建房间</h2>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
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
              <label className="block text-sm font-medium text-gray-300 mb-1">
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
          
          <div className="flex gap-4 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 btn-secondary"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 btn-primary"
            >
              创建
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
