/**
 * 游戏房间页面
 * @page Room
 * @author ARCH
 * @date 2026-03-26
 * @task FE-004
 */

import { useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { roomAPI } from '../services/api'
import { socketService } from '../services/socket'
import { useGameStore, useAuthStore } from '../store'
import { PlayingCard } from '../components/PlayingCard'
import { Card } from '@poker/shared'

export function Room() {
  const { code } = useParams<{ code: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { currentRoom, gameState, isConnected } = useGameStore()
  
  // 获取房间信息
  const { data: roomData, isLoading } = useQuery({
    queryKey: ['room', code],
    queryFn: () => roomAPI.getRoom(code!),
    enabled: !!code,
  })
  
  useEffect(() => {
    if (!code) return
    
    // 连接并加入房间
    socketService.connect()
    socketService.joinRoom(code)
    
    return () => {
      if (currentRoom?.id) {
        socketService.leaveRoom(currentRoom.id)
      }
    }
  }, [code])
  
  if (isLoading) {
    return <div className="p-8 text-center">加载中...</div>
  }
  
  const room = roomData?.data.data
  if (!room) {
    return <div className="p-8 text-center text-red-400">房间不存在</div>
  }
  
  return (
    <div className="min-h-[calc(100vh-8rem)] bg-poker-green-dark">
      {/* 房间头部 */}
      <div className="bg-gray-800 p-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">{room.name}</h1>
            <p className="text-sm text-gray-400">
              代码: {room.code} | 
              盲注: {room.smallBlind}/{room.bigBlind}
            </p>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="text-sm">
              {isConnected ? (
                <span className="text-green-400">● 已连接</span>
              ) : (
                <span className="text-red-400">● 未连接</span>
              )}
            </div>
            <button
              onClick={() => navigate('/lobby')}
              className="btn-secondary text-sm"
            >
              离开房间
            </button>
          </div>
        </div>
      </div>
      
      {/* 游戏区域 */}
      <div className="max-w-7xl mx-auto p-4">
        <div className="relative h-[600px] bg-poker-green rounded-2xl border-4 border-poker-green-light shadow-2xl overflow-hidden">
          {/* 牌桌中心 - 公共牌和底池 */}
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-center">
            {/* 底池 */}
            <div className="mb-4 text-white">
              <span className="text-lg font-bold">底池: {gameState?.pot || 0}</span>
            </div>
            
            {/* 公共牌 */}
            <div className="flex gap-2 justify-center">
              {gameState?.communityCards?.map((card: Card, index: number) => (
                <PlayingCard key={index} card={card} size="md" />
              )) || (
                <>
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="w-16 h-24 bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-600"
                    />
                  ))}
                </>
              )}
            </div>
          </div>
          
          {/* 玩家座位 */}
          <div className="absolute inset-0">
            {room.members.map((member: any, index: number) => {
              const position = getSeatPosition(index, room.members.length)
              const isCurrentUser = member.user.id === user?.id
              
              return (
                <div
                  key={member.user.id}
                  className={`absolute transform -translate-x-1/2 -translate-y-1/2 ${position}`}
                >
                  <div
                    className={`p-3 rounded-lg ${
                      isCurrentUser ? 'bg-blue-600/80' : 'bg-gray-800/80'
                    }`}
                  >
                    <div className="text-white font-bold text-sm">
                      {member.user.username}
                    </div>
                    
                    <div className="text-yellow-400 text-sm">
                      {member.chips?.toLocaleString() || '0'}
                    </div>
                    
                    {/* 手牌 (仅自己可见) */}
                    <div className="flex gap-1 mt-2">
                      <PlayingCard hidden={!isCurrentUser} size="sm" />
                      <PlayingCard hidden={!isCurrentUser} size="sm" />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
        
        {/* 操作按钮 */}
        <GameControls />
      </div>
    </div>
  )
}

// 计算座位位置
function getSeatPosition(index: number, _total: number): string {
  const positions = [
    'top-1/4 left-4',      // 左上
    'top-4 left-1/4',      // 上左
    'top-4 left-1/2',      // 上中
    'top-4 right-1/4',     // 上右
    'top-1/4 right-4',     // 右上
    'bottom-1/4 right-4',  // 右下
    'bottom-4 right-1/4',  // 下右
    'bottom-4 left-1/2',   // 下中
    'bottom-4 left-1/4',   // 下左
    'bottom-1/4 left-4',   // 左下
  ]
  return positions[index] || positions[0]
}

// 游戏控制组件
function GameControls() {
  const { gameState } = useGameStore()
  
  if (!gameState || gameState.status === 'WAITING') {
    return (
      <div className="mt-4 text-center">
        <button
          onClick={() => socketService.ready(gameState?.roomId)}
          className="btn-primary text-lg px-8 py-3"
        >
          准备
        </button>
      </div>
    )
  }
  
  return (
    <div className="mt-4 flex justify-center gap-4">
      <button
        onClick={() => socketService.playerAction(gameState.id, 'fold')}
        className="btn-danger px-6 py-3"
      >
        弃牌
      </button>
      
      <button
        onClick={() => socketService.playerAction(gameState.id, 'check')}
        className="btn-secondary px-6 py-3"
      >
        过牌
      </button>
      
      <button
        onClick={() => socketService.playerAction(gameState.id, 'call')}
        className="btn-secondary px-6 py-3"
      >
        跟注
      </button>
      
      <button
        onClick={() => socketService.playerAction(gameState.id, 'raise', 100)}
        className="btn-primary px-6 py-3"
      >
        加注
      </button>
    </div>
  )
}
