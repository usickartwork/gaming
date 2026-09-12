'use client'

import { useState } from 'react'
import type { BuzzState } from '@/lib/types'

interface BuzzButtonProps {
  buzzState: BuzzState
  isWinner: boolean
  onBuzz: () => Promise<void>
  isExcluded?: boolean
}

export function BuzzButton({ buzzState, isWinner, onBuzz, isExcluded }: BuzzButtonProps) {
  const [pressing, setPressing] = useState(false)

  const canBuzz = buzzState === 'READY' && !isWinner && !isExcluded

  const handleBuzz = async () => {
    if (!canBuzz || pressing) return
    setPressing(true)

    // Haptic feedback
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(150)
    }

    await onBuzz()
    setTimeout(() => setPressing(false), 500)
  }

  // State-dependent rendering
  if (buzzState === 'DISABLED') {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-48 rounded-full bg-white/5 border-4 border-white/10 flex items-center justify-center">
          <span className="text-white/30 text-5xl">⚫</span>
        </div>
        <p className="text-white/40 text-lg font-semibold animate-pulse">Menunggu host...</p>
      </div>
    )
  }

  if (buzzState === 'LOCKED' || buzzState === 'RESULT') {
    return null // PlayerStatus handles this
  }

  if (buzzState === 'READY' && isExcluded) {
    return (
      <div className="flex flex-col items-center gap-4">
        <div className="w-48 h-48 rounded-full bg-orange-950 border-4 border-orange-500/50 flex items-center justify-center">
          <span className="text-orange-400 text-5xl">🚫</span>
        </div>
        <p className="text-orange-400 text-base font-semibold text-center">
          Kamu tidak bisa buzz<br/>di attempt ini
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <button
        onPointerDown={handleBuzz}
        disabled={!canBuzz || pressing}
        className={`w-48 h-48 rounded-full font-black text-2xl tracking-wider transition-all duration-100 select-none
          ${pressing
            ? 'scale-90 bg-red-900 border-8 border-red-700 text-red-300'
            : 'scale-100 bg-red-600 hover:bg-red-500 active:scale-90 border-8 border-red-400 text-white shadow-2xl shadow-red-900/50'
          }
          ${!canBuzz ? 'opacity-50' : 'animate-pulse-slow'}
        `}
        style={{ WebkitTapHighlightColor: 'transparent' }}
      >
        🔴<br />BUZZ
      </button>
      <p className="text-green-400 text-sm font-semibold tracking-wider animate-pulse">
        TEKAN SEKARANG!
      </p>
    </div>
  )
}
