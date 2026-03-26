/**
 * 扑克牌组件
 * @component PlayingCard
 * @author ARCH
 * @date 2026-03-26
 * @task FE-001
 */

import { Card } from '@poker/shared'

interface PlayingCardProps {
  card?: Card
  hidden?: boolean
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const sizeClasses = {
  sm: 'w-10 h-14 text-sm',
  md: 'w-16 h-24 text-xl',
  lg: 'w-20 h-32 text-2xl',
}

export function PlayingCard({ card, hidden = false, size = 'md', className = '' }: PlayingCardProps) {
  if (hidden || !card) {
    return (
      <div
        className={`${sizeClasses[size]} bg-blue-800 rounded-lg shadow-lg flex items-center justify-center ${className}`}
      >
        <div className="w-8 h-10 border-2 border-blue-600 rounded"></div>
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
      className={`${sizeClasses[size]} bg-white rounded-lg shadow-lg flex flex-col items-center justify-between p-1 ${suitColors[suit]} ${className}`}
    >
      <span className="font-bold">{rankDisplay}</span>
      <span className="text-2xl">{suitSymbols[suit]}</span>
      <span className="font-bold rotate-180">{rankDisplay}</span>
    </div>
  )
}
