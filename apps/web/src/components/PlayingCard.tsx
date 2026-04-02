/**
 * 扑克牌组件 - 增强视觉效果
 * @component PlayingCard
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 * @updated 2026-04-03 - 视觉增强版本
 */

import { Card } from '@poker/shared'

type CardSize = 'xs' | 'sm' | 'md' | 'lg'

interface PlayingCardProps {
  card?: Card
  hidden?: boolean
  size?: CardSize
  responsive?: boolean
  className?: string
}

const sizeClasses: Record<CardSize, string> = {
  xs: 'w-8 h-12 text-[8px]',
  sm: 'w-10 h-14 text-xs',
  md: 'w-14 h-20 text-sm',
  lg: 'w-20 h-28 text-base',
}

const responsiveClasses = 'w-10 h-14 text-xs sm:w-12 sm:h-16 sm:text-sm md:w-14 md:h-20 md:text-base lg:w-20 lg:h-28 lg:text-base'

/** 牌背图案 */
const CARD_BACK_PATTER = `
  repeating-linear-gradient(
    45deg,
    transparent,
    transparent 2px,
    rgba(59, 130, 246, 0.15) 2px,
    rgba(59, 130, 246, 0.15) 4px
  )
`

export function PlayingCard({
  card,
  hidden = false,
  size = 'md',
  responsive = false,
  className = '',
}: PlayingCardProps) {
  const cardSizeClass = responsive ? responsiveClasses : sizeClasses[size]

  if (hidden || !card) {
    return (
      <div
        className={`${cardSizeClass} rounded-lg shadow-xl flex items-center justify-center flex-shrink-0 bg-gradient-to-br from-blue-700 via-blue-800 to-blue-900 border-2 border-blue-500/30 hover:scale-105 transition-transform cursor-pointer ${className}`}
        style={{ backgroundImage: CARD_BACK_PATTER }}
      >
        {/* 中心装饰 */}
        <div className="w-6 h-8 sm:w-8 sm:h-10 md:w-10 md:h-14 border-2 border-blue-400/40 rounded-md flex items-center justify-center">
          <span className="text-blue-300 text-xs sm:text-sm md:text-lg font-bold">PK</span>
        </div>
      </div>
    )
  }

  const rank = card[0]
  const suit = card[1]

  const suitSymbols: Record<string, string> = {
    spade: '♠',
    heart: '♥',
    diamond: '♦',
    club: '♣',
  }

  const suitColors: Record<string, string> = {
    spade: 'text-gray-900',
    heart: 'text-red-500',
    diamond: 'text-red-500',
    club: 'text-gray-900',
  }

  const suitBgColors: Record<string, string> = {
    spade: 'bg-gray-900',
    heart: 'bg-red-500',
    diamond: 'bg-red-500',
    club: 'bg-gray-900',
  }

  const rankDisplay = rank === 'T' ? '10' : rank
  const suitName = card.suit?.toLowerCase().charAt(0) || 
                   (card.display?.includes('♠') ? 'spade' : 
                    card.display?.includes('♥') ? 'heart' :
                    card.display?.includes('♦') ? 'diamond' : 'club')

  return (
    <div
      className={`${cardSizeClass} rounded-lg shadow-xl flex flex-col items-center justify-between p-1 sm:p-1.5 bg-gradient-to-br from-white via-gray-50 to-gray-100 border border-gray-200 flex-shrink-0 hover:scale-105 hover:shadow-2xl transition-all duration-200 ${className}`}
    >
      {/* 左上角 */}
      <div className="flex flex-col items-center self-start">
        <span className={`font-black leading-none ${suitColors[suitName]} text-[10px] sm:text-xs`}>
          {rankDisplay}
        </span>
        <span className={`${suitColors[suitName]} text-[10px] sm:text-sm leading-none`}>
          {suitSymbols[suitName]}
        </span>
      </div>

      {/* 中央花色 */}
      <div className={`${suitColors[suitName]} text-xl sm:text-2xl md:text-3xl lg:text-4xl font-black drop-shadow-md`}>
        {suitSymbols[suitName]}
      </div>

      {/* 右下角 (旋转180度) */}
      <div className="flex flex-col items-center self-end rotate-180">
        <span className={`font-black leading-none ${suitColors[suitName]} text-[10px] sm:text-xs`}>
          {rankDisplay}
        </span>
        <span className={`${suitColors[suitName]} text-[10px] sm:text-sm leading-none`}>
          {suitSymbols[suitName]}
        </span>
      </div>

      {/* 高光效果 */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 via-transparent to-transparent rounded-lg pointer-events-none"></div>
    </div>
  )
}
