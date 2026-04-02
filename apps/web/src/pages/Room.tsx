/**
 * 游戏房间页面 - 增强视觉版本
 * @page Room
 * @author ARCH
 * @date 2026-03-26
 * @task FE-004
 * @updated 2026-04-03 - 视觉增强
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
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-16 h-16 border-4 border-poker-gold border-t-transparent rounded-full mx-auto mb-4"></div>
          <p className="text-poker-gold text-xl font-semibold animate-pulse">加载中...</p>
        </div>
      </div>
    )
  }

  const room = roomData?.data.data
  if (!room) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-gray-900 to-gray-800 flex items-center justify-center">
        <div className="card p-8 text-center">
          <p className="text-red-400 text-xl mb-4">房间不存在</p>
          <button onClick={() => navigate('/lobby')} className="btn-primary">
            返回大厅
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-900 via-green-950 to-gray-900">
      {/* 房间头部 */}
      <RoomHeader
        room={room}
        isConnected={isConnected}
        onLeave={() => navigate('/lobby')}
      />

      {/* 游戏区域 */}
      <div className="px-2 sm:px-4 py-2 sm:py-4 max-w-7xl mx-auto">
        {/* 牌桌 - 增强视觉效果 */}
        <div className="relative rounded-2xl overflow-hidden shadow-2xl">
          {/* 外发光效果 */}
          <div className="absolute inset-0 bg-gradient-to-br from-poker-green-light/20 via-transparent to-poker-green-dark/20 rounded-2xl blur-sm"></div>
          
          {/* 牌桌主体 */}
          <div className="relative bg-gradient-to-br from-poker-green via-emerald-800 to-poker-green-dark rounded-2xl border-4 border-poker-green-light/50 p-4 sm:p-6 min-h-[60vh] sm:min-h-[450px]">
            
            {/* 牌桌纹理叠加 */}
            <div className="absolute inset-0 opacity-30 pointer-events-none"
              style={{
                backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='0.1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
              }}
            ></div>

            {/* 发牌区域 */}
            <div className="relative z-10 flex flex-col h-full min-h-[50vh]">
              
              {/* 上方座位 */}
              <div className="flex-shrink-0">
                <SeatRow
                  members={getTopSeats(room.members)}
                  userId={user?.id}
                  gameState={gameState}
                />
              </div>

              {/* 中间区域 */}
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center w-full">
                  {/* 底池 - 增强视觉效果 */}
                  <div className="mb-4 sm:mb-6">
                    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-yellow-600/80 via-yellow-500/90 to-yellow-600/80 px-4 sm:px-8 py-2 sm:py-3 rounded-full shadow-lg border-2 border-yellow-400/50 backdrop-blur-sm">
                      <span className="text-yellow-100 text-xs sm:text-sm opacity-80">底池</span>
                      <span className="text-white font-bold text-lg sm:text-2xl drop-shadow-lg">
                        ${gameState?.pot?.toLocaleString() || '0'}
                      </span>
                      <span className="text-yellow-200 text-xs sm:text-sm opacity-80">筹码</span>
                    </div>
                  </div>

                  {/* 公共牌区 */}
                  <div className="flex gap-2 sm:gap-3 justify-center">
                    {gameState?.communityCards?.map((card: Card, index: number) => (
                      <div key={index} className="animate-deal" style={{ animationDelay: `${index * 0.1}s` }}>
                        <PlayingCard card={card} size="lg" />
                      </div>
                    )) || (
                      <>
                        {[...Array(5)].map((_, i) => (
                          <div
                            key={i}
                            className="w-12 h-16 sm:w-16 sm:h-24 md:w-20 md:h-28 bg-gray-700/50 rounded-lg border-2 border-dashed border-gray-500/50 shadow-inner"
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* 下方座位 */}
              <div className="flex-shrink-0">
                <SeatRow
                  members={getBottomSeats(room.members)}
                  userId={user?.id}
                  gameState={gameState}
                />
              </div>
            </div>
          </div>
        </div>

        {/* 控制按钮 */}
        <div className="mt-4 hidden sm:block">
          <GameControls />
        </div>
      </div>

      {/* 移动端固定底部 */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-50">
        <GameControls mobile />
      </div>
      <div className="sm:hidden h-24"></div>
    </div>
  )
}

/** 房间头部 - 增强视觉效果 */
function RoomHeader({
  room,
  isConnected,
  onLeave,
}: {
  room: any
  isConnected: boolean
  onLeave: () => void
}) {
  return (
    <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 border-b border-gray-700/50 px-4 py-3 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-lg sm:text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent truncate">
            {room.name}
          </h1>
          <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400">
            <span className="font-mono bg-gray-700/50 px-2 py-0.5 rounded">{room.code}</span>
            <span>|</span>
            <span className="text-poker-gold font-semibold">
              ${room.smallBlind}/${room.bigBlind}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* 连接状态 */}
          <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
            isConnected 
              ? 'bg-green-500/20 text-green-400 border border-green-500/30' 
              : 'bg-red-500/20 text-red-400 border border-red-500/30'
          }`}>
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'}`}></span>
            {isConnected ? '已连接' : '断开'}
          </div>

          <button
            onClick={onLeave}
            className="btn-danger px-4 py-2 text-sm font-medium rounded-lg hover:scale-105 transition-transform"
          >
            离开
          </button>
        </div>
      </div>
    </div>
  )
}

/** 座位行 */
function SeatRow({
  members,
  userId,
  gameState,
}: {
  members: any[]
  userId?: string
  gameState: any
}) {
  if (!members.length) return <div className="h-28"></div>

  return (
    <div className="flex items-center justify-center gap-3 sm:gap-4 flex-wrap">
      {members.map((member: any) => {
        const isCurrentUser = member.user.id === userId
        return (
          <SeatCard
            key={member.user.id}
            member={member}
            isCurrentUser={isCurrentUser}
            gameState={gameState}
          />
        )
      })}
    </div>
  )
}

/** 单个座位卡片 - 增强视觉效果 */
function SeatCard({
  member,
  isCurrentUser,
  gameState,
}: {
  member: any
  isCurrentUser: boolean
  gameState: any
}) {
  const playerState = gameState?.players?.find((p: any) => p.userId === member.user.id)
  const holeCards = isCurrentUser ? playerState?.holeCards : undefined
  const isActive = gameState?.currentPlayerSeat === playerState?.seatNumber

  return (
    <div
      className={`relative rounded-xl px-3 py-2 sm:px-4 sm:py-3 min-w-[90px] sm:min-w-[120px] text-center transition-all duration-300 ${
        isCurrentUser
          ? 'bg-gradient-to-br from-blue-600 to-blue-700 ring-2 ring-blue-400 shadow-lg shadow-blue-500/30'
          : 'bg-gradient-to-br from-gray-800/90 to-gray-900/90 backdrop-blur-sm border border-gray-600/30'
      } ${isActive ? 'ring-2 ring-yellow-400 shadow-lg shadow-yellow-500/30 animate-pulse-subtle' : ''}`}
    >
      {/* 当前回合指示器 */}
      {isActive && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full shadow-lg animate-bounce-subtle">
          回合
        </div>
      )}

      {/* 用户名 */}
      <div className={`font-bold text-xs sm:text-sm truncate max-w-[80px] sm:max-w-[110px] ${isCurrentUser ? 'text-white' : 'text-gray-200'}`}>
        {member.user.username}
      </div>

      {/* 筹码 */}
      <div className="flex items-center justify-center gap-1 text-yellow-400 text-xs sm:text-sm font-semibold mt-1">
        <span className="text-yellow-300">💰</span>
        <span>{member.chips?.toLocaleString() || '0'}</span>
      </div>

      {/* 手牌 */}
      <div className="flex gap-1 sm:gap-2 mt-2 justify-center">
        <PlayingCard card={holeCards?.[0]} hidden={!isCurrentUser} size="sm" />
        <PlayingCard card={holeCards?.[1]} hidden={!isCurrentUser} size="sm" />
      </div>

      {/* 自己标记 */}
      {isCurrentUser && (
        <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] text-blue-300 font-medium">
          你
        </div>
      )}
    </div>
  )
}

function getTopSeats(members: any[]): any[] {
  if (members.length <= 2) return []
  const half = Math.ceil(members.length / 2)
  return members.slice(0, half)
}

function getBottomSeats(members: any[]): any[] {
  if (members.length <= 2) return members
  const half = Math.ceil(members.length / 2)
  return members.slice(half)
}

/** 游戏控制组件 - 增强视觉效果 */
function GameControls({ mobile = false }: { mobile?: boolean }) {
  const { gameState } = useGameStore()

  const baseBtnClass = mobile
    ? 'flex-1 min-h-[52px] text-base font-bold rounded-xl active:scale-95 transition-all shadow-lg'
    : 'px-8 py-4 text-lg font-bold rounded-xl'

  if (!gameState || gameState.status === 'WAITING') {
    return (
      <div className={`${mobile ? 'bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 px-4 py-4' : 'text-center'}`}>
        <button
          onClick={() => socketService.ready(gameState?.roomId)}
          className={`btn-primary ${baseBtnClass} bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-400 hover:to-emerald-500 shadow-lg shadow-green-500/30`}
        >
          ✋ 准备开始
        </button>
      </div>
    )
  }

  return (
    <div className={`${mobile ? 'bg-gray-900/95 backdrop-blur-lg border-t border-gray-700 px-3 py-3' : ''}`}>
      <div className={`flex gap-2 sm:gap-4 ${mobile ? '' : 'justify-center'}`}>
        <button
          onClick={() => socketService.playerAction(gameState.id, 'fold')}
          className={`btn ${baseBtnClass} bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-500 hover:to-rose-600 text-white shadow-lg shadow-red-500/30`}
        >
          🃏 弃牌
        </button>

        <button
          onClick={() => socketService.playerAction(gameState.id, 'check')}
          className={`btn ${baseBtnClass} bg-gradient-to-r from-gray-600 to-gray-700 hover:from-gray-500 hover:to-gray-600 text-white shadow-lg`}
        >
          ✋ 过牌
        </button>

        <button
          onClick={() => socketService.playerAction(gameState.id, 'call')}
          className={`btn ${baseBtnClass} bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-500 hover:to-indigo-600 text-white shadow-lg shadow-blue-500/30`}
        >
          👆 跟注
        </button>

        <button
          onClick={() => socketService.playerAction(gameState.id, 'raise', 100)}
          className={`btn ${baseBtnClass} bg-gradient-to-r from-yellow-500 to-orange-600 hover:from-yellow-400 hover:to-orange-500 text-white shadow-lg shadow-yellow-500/30`}
        >
          ⬆️ 加注
        </button>
      </div>
    </div>
  )
}
