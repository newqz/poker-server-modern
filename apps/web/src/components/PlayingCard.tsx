/**
 * 扑克牌组件 - 响应式多尺寸
 * @component PlayingCard
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 * @updated 2026-03-28 - 新增 xs 尺寸，支持响应式缩放
 */

import { Card } from '@poker/shared'

type CardSize = 'xs' | 'sm' | 'md' | 'lg'

interface PlayingCardProps {
  card?: Card
  hidden?: boolean
  size?: CardSize
  /** 启用响应式尺寸：xs -> sm:sm -> md:md -> lg:lg */
  responsive?: boolean
  className?: string
}

const sizeClasses: Record<CardSize, string> = {
  xs: 'w-6 h-9 text-[10px]',        // 24x36 - 手机小屏
  sm: 'w-8 h-12 text-xs',            // 32x48 - 手机
  md: 'w-12 h-[72px] text-base',     // 48x72 - 平板
  lg: 'w-16 h-24 text-xl',           // 64x96 - 桌面
}

/** 响应式尺寸：mobile-first 自适应断点 */
const responsiveClasses = 'w-6 h-9 text-[10px] sm:w-8 sm:h-12 sm:text-xs md:w-12 md:h-[72px] md:text-base lg:w-16 lg:h-24 lg:text-xl'

/** 响应式牌背装饰尺寸 */
const backDecoSizeClasses: Record<CardSize, string> = {
  xs: 'w-4 h-5',
  sm: 'w-5 h-6',
  md: 'w-8 h-10',
  lg: 'w-10 h-12',
}

const responsiveBackDecoClasses = 'w-4 h-5 sm:w-5 sm:h-6 md:w-8 md:h-10 lg:w-10 lg:h-12'

/** 花色符号显示尺寸 */
const suitFontClasses: Record<CardSize, string> = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-xl',
  lg: 'text-2xl',
}

const responsiveSuitFontClasses = 'text-xs sm:text-sm md:text-xl lg:text-2xl'

export function PlayingCard({
  card,
  hidden = false,
  size = 'md',
  responsive = false,
  className = '',
}: PlayingCardProps) {
  const cardSizeClass = responsive ? responsiveClasses : sizeClasses[size]
  const backDecoClass = responsive ? responsiveBackDecoClasses : backDecoSizeClasses[size]
  const suitFontClass = responsive ? responsiveSuitFontClasses : suitFontClasses[size]

  if (hidden || !card) {
    return (
      <div
        className={`${cardSizeClass} bg-blue-800 rounded-md sm:rounded-lg shadow-lg flex items-center justify-center flex-shrink-0 ${className}`}
      >
        <div className={`${backDecoClass} border-2 border-blue-600 rounded`}></div>
      </div>
    )
  }

  const rank = card[0]
  const suit = card[1]

  const suitSymbols: Record<string, string> = {
    s: '♠',
    h: '♥',
    d: '♦',
    c: '♣',
  }

  const suitColors: Record<string, string> = {
    s: 'text-black',
    h: 'text-red-500',
    d: 'text-red-500',
    c: 'text-black',
  }

  const rankDisplay = rank === 'T' ? '10' : rank

  return (
    <div
      className={`${cardSizeClass} bg-white rounded-md sm:rounded-lg shadow-lg flex flex-col items-center justify-between p-0.5 sm:p-1 ${suitColors[suit]} flex-shrink-0 ${className}`}
    >
      <span className="font-bold leading-none">{rankDisplay}</span>
      <span className={`${suitFontClass} leading-none`}>{suitSymbols[suit]}</span>
      <span className="font-bold leading-none rotate-180">{rankDisplay}</span>
    </div>
  )
}
