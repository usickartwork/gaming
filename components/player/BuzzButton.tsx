'use client'

import { useState } from 'react'
import type { BuzzState } from '@/lib/types'
import { playBuzzSound } from '@/lib/audio'

interface BuzzButtonProps {
  buzzState: BuzzState
  isWinner: boolean
  onBuzz: () => Promise<void>
  isExcluded?: boolean
  isBuzzing?: boolean
}

export function BuzzButton({ buzzState, isWinner, onBuzz, isExcluded, isBuzzing }: BuzzButtonProps) {
  const [pressing, setPressing] = useState(false)

  const canBuzz = buzzState === 'READY' && !isWinner && !isExcluded && !isBuzzing

  const handleBuzz = (e: React.PointerEvent) => {
    if (!canBuzz || pressing) return
    e.preventDefault()
    setPressing(true)

    // Instant 0ms sound & haptic
    playBuzzSound()
    if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate([100, 30, 100])
    }

    onBuzz().finally(() => {
      setPressing(false)
    })
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
        disabled={!canBuzz || pressing || isBuzzing}
        className={`w-48 h-48 rounded-full font-black text-2xl tracking-wider transition-all duration-75 select-none
          ${pressing || isBuzzing
            ? 'scale-90 bg-yellow-500 border-8 border-yellow-300 text-black shadow-lg shadow-yellow-500/50 animate-pulse'
            : 'scale-100 bg-red-600 hover:bg-red-500 active:scale-90 border-8 border-red-400 text-white shadow-2xl shadow-red-900/50 animate-pulse-slow'
          }
          ${!canBuzz && !isBuzzing ? 'opacity-50' : ''}
        `}
        style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
      >
        {isBuzzing || pressing ? (
          <>⚡<br /><span className="text-xl">BUZZ!</span></>
        ) : (
          <>🔴<br />BUZZ</>
        )}
      </button>
      <p className={`text-sm font-semibold tracking-wider ${isBuzzing || pressing ? 'text-yellow-300 animate-bounce' : 'text-green-400 animate-pulse'}`}>
        {isBuzzing || pressing ? 'MENGIRIM BUZZ...' : 'TEKAN SEKARANG!'}
      </p>
    </div>
  )
}
