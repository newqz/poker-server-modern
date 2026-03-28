/**
 * 游戏房间页面 - 响应式布局
 * @page Room
 * @author ARCH
 * @date 2026-03-26
 * @task FE-004
 * @updated 2026-03-28 - 响应式重构：mobile-first 布局
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
    <div className="min-h-[calc(100vh-4rem)] sm:min-h-[calc(100vh-8rem)] bg-poker-green-dark flex flex-col">
      {/* 房间头部 - 紧凑模式 */}
      <RoomHeader
        room={room}
        isConnected={isConnected}
        onLeave={() => navigate('/lobby')}
      />

      {/* 游戏区域 - 自适应填充 */}
      <div className="flex-1 flex flex-col px-2 sm:px-4 py-2 sm:py-4 max-w-7xl mx-auto w-full">
        {/* 牌桌 */}
        <div className="flex-1 min-h-[50vh] sm:min-h-[400px] lg:min-h-[500px] bg-poker-green rounded-xl sm:rounded-2xl border-2 sm:border-4 border-poker-green-light shadow-2xl overflow-hidden flex flex-col">

          {/* 上方座位（对手） */}
          <div className="flex-shrink-0 px-2 pt-2 sm:px-4 sm:pt-4">
            <SeatRow
              members={getTopSeats(room.members)}
              userId={user?.id}
              gameState={gameState}
            />
          </div>

          {/* 中间区域：公共牌 + 底池 */}
          <div className="flex-1 flex items-center justify-center px-2 sm:px-4">
            <div className="text-center w-full">
              {/* 底池 */}
              <div className="mb-2 sm:mb-4 text-white">
                <span className="text-sm sm:text-lg font-bold">
                  底池: {gameState?.pot || 0}
                </span>
              </div>

              {/* 公共牌 - 小屏横向滚动 */}
              <div className="overflow-x-auto scrollbar-hide">
                <div className="flex gap-1 sm:gap-2 justify-center min-w-max px-2">
                  {gameState?.communityCards?.map((card: Card, index: number) => (
                    <PlayingCard key={index} card={card} responsive />
                  )) || (
                    <>
                      {[...Array(5)].map((_, i) => (
                        <div
                          key={i}
                          className="w-6 h-9 sm:w-8 sm:h-12 md:w-12 md:h-[72px] lg:w-16 lg:h-24 bg-gray-700/50 rounded-md sm:rounded-lg border-2 border-dashed border-gray-600 flex-shrink-0"
                        />
                      ))}
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 下方座位（自己+相邻） */}
          <div className="flex-shrink-0 px-2 pb-2 sm:px-4 sm:pb-4">
            <SeatRow
              members={getBottomSeats(room.members)}
              userId={user?.id}
              gameState={gameState}
            />
          </div>
        </div>

        {/* 操作按钮 - 桌面端在牌桌下方 */}
        <div className="hidden sm:block mt-4">
          <GameControls />
        </div>
      </div>

      {/* 操作按钮 - 移动端固定底部浮动 */}
      <div className="sm:hidden fixed bottom-0 inset-x-0 z-50">
        <GameControls mobile />
      </div>

      {/* 移动端底部占位，防止内容被固定按钮遮挡 */}
      <div className="sm:hidden h-20" />
    </div>
  )
}

/** 房间头部信息栏 */
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
    <div className="bg-gray-800 px-3 py-2 sm:p-4">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-2">
        <div className="min-w-0 flex-1">
          <h1 className="text-base sm:text-xl font-bold truncate">{room.name}</h1>
          <p className="text-xs sm:text-sm text-gray-400 truncate">
            {room.code} | {room.smallBlind}/{room.bigBlind}
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
          <div className="text-xs sm:text-sm">
            {isConnected ? (
              <span className="text-green-400">● 连接</span>
            ) : (
              <span className="text-red-400">● 断开</span>
            )}
          </div>
          <button
            onClick={onLeave}
            className="btn-secondary text-xs sm:text-sm px-2 py-1 sm:px-4 sm:py-2 min-h-touch"
          >
            离开
          </button>
        </div>
      </div>
    </div>
  )
}

/** 座位行组件 - flex 响应式布局 */
function SeatRow({
  members,
  userId,
  gameState,
}: {
  members: any[]
  userId?: string
  gameState: any
}) {
  if (!members.length) return null

  return (
    <div className="flex items-center justify-center gap-1 sm:gap-2 md:gap-4 flex-wrap">
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

/** 单个座位卡片 */
function SeatCard({
  member,
  isCurrentUser,
  gameState,
}: {
  member: any
  isCurrentUser: boolean
  gameState: any
}) {
  // 从 gameState 中查找该玩家的手牌
  const playerState = gameState?.players?.find(
    (p: any) => p.userId === member.user.id
  )
  const holeCards = isCurrentUser ? playerState?.holeCards : undefined

  return (
    <div
      className={`rounded-lg px-2 py-1.5 sm:p-3 min-w-[72px] sm:min-w-[100px] text-center ${
        isCurrentUser
          ? 'bg-blue-600/80 ring-2 ring-blue-400'
          : 'bg-gray-800/80'
      }`}
    >
      {/* 用户名 */}
      <div className="text-white font-bold text-[11px] sm:text-sm truncate max-w-[64px] sm:max-w-[90px]">
        {member.user.username}
      </div>

      {/* 筹码 */}
      <div className="text-yellow-400 text-[10px] sm:text-sm">
        {member.chips?.toLocaleString() || '0'}
      </div>

      {/* 手牌 */}
      <div className="flex gap-0.5 sm:gap-1 mt-1 sm:mt-2 justify-center">
        <PlayingCard
          card={holeCards?.[0]}
          hidden={!isCurrentUser}
          responsive
        />
        <PlayingCard
          card={holeCards?.[1]}
          hidden={!isCurrentUser}
          responsive
        />
      </div>
    </div>
  )
}

/**
 * 座位分配：将成员按上下两排分布
 * - 上排：除自己以外的对手
 * - 下排：自己（居中）+ 左右相邻
 * 简化实现：前半放上面，后半放下面
 */
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

/** 游戏控制组件 - 支持移动端和桌面端两种模式 */
function GameControls({ mobile = false }: { mobile?: boolean }) {
  const { gameState } = useGameStore()

  const baseBtnClass = mobile
    ? 'min-h-[48px] min-w-[48px] px-4 py-3 text-sm font-semibold rounded-lg active:scale-95 transition-transform'
    : 'px-6 py-3 rounded-lg'

  if (!gameState || gameState.status === 'WAITING') {
    return (
      <div
        className={
          mobile
            ? 'bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 px-4 py-3 pb-safe-b'
            : 'text-center'
        }
      >
        <button
          onClick={() => socketService.ready(gameState?.roomId)}
          className={`btn-primary w-full sm:w-auto ${baseBtnClass} ${
            mobile ? '' : 'text-lg px-8'
          }`}
        >
          准备
        </button>
      </div>
    )
  }

  return (
    <div
      className={
        mobile
          ? 'bg-gray-900/95 backdrop-blur-sm border-t border-gray-700 px-3 py-2 pb-safe-b'
          : 'flex justify-center gap-4'
      }
    >
      <div
        className={
          mobile
            ? 'grid grid-cols-4 gap-2'
            : 'contents'
        }
      >
        <button
          onClick={() => socketService.playerAction(gameState.id, 'fold')}
          className={`btn-danger ${baseBtnClass}`}
        >
          弃牌
        </button>

        <button
          onClick={() => socketService.playerAction(gameState.id, 'check')}
          className={`btn-secondary ${baseBtnClass}`}
        >
          过牌
        </button>

        <button
          onClick={() => socketService.playerAction(gameState.id, 'call')}
          className={`btn-secondary ${baseBtnClass}`}
        >
          跟注
        </button>

        <button
          onClick={() =>
            socketService.playerAction(gameState.id, 'raise', 100)
          }
          className={`btn-primary ${baseBtnClass}`}
        >
          加注
        </button>
      </div>
    </div>
  )
}
