'use client'

import { useState } from 'react'
import type { BuzzState } from '@/lib/types'
import { playBuzzSound } from '@/lib/audio'
import { LockIcon, BlockedIcon, LightningIcon } from '@/components/shared/Icons'

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
      <div className="flex flex-col items-center gap-6">
        <div className="relative p-3 rounded-full bg-slate-900 border border-white/5 shadow-2xl">
          <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-gradient-to-b from-slate-800/80 to-slate-950 border-4 border-slate-700/40 flex flex-col items-center justify-center text-slate-600 shadow-inner">
            <LockIcon size={36} className="mb-2 opacity-40 text-slate-400" />
            <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Buzzer Terkunci</span>
          </div>
        </div>
        <div className="text-center">
          <p className="text-slate-300 font-bold text-base">Mendengarkan Lagu...</p>
          <p className="text-slate-500 text-xs mt-1">Host akan membuka buzzer jika lagu sudah siap ditebak.</p>
        </div>
      </div>
    )
  }

  if (buzzState === 'LOCKED' || buzzState === 'RESULT') {
    return null
  }

  if (buzzState === 'READY' && isExcluded) {
    return (
      <div className="flex flex-col items-center gap-5">
        <div className="p-3 rounded-full bg-slate-900 border border-white/5 shadow-2xl">
          <div className="w-52 h-52 sm:w-60 sm:h-60 rounded-full bg-gradient-to-b from-rose-950/60 to-slate-950 border-4 border-rose-500/30 flex flex-col items-center justify-center text-center p-4">
            <BlockedIcon size={44} className="mb-2 text-rose-400" />
            <p className="text-rose-400 text-sm font-bold leading-snug">
              Kamu Salah Jawab
            </p>
            <p className="text-slate-400 text-[11px] mt-1">
              Menunggu giliran lagu berikutnya
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center gap-6">
      {/* Outer arcade bezel */}
      <div className="relative p-3.5 sm:p-4 rounded-full bg-gradient-to-b from-slate-800 via-slate-900 to-black border-2 border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
        {/* Glow ambient ring */}
        <div className="absolute inset-0 rounded-full bg-rose-500/20 blur-xl pointer-events-none animate-pulse" />

        {/* 3D Push Button */}
        <button
          onPointerDown={handleBuzz}
          disabled={!canBuzz || pressing || isBuzzing}
          className={`relative w-52 h-52 sm:w-60 sm:h-60 rounded-full font-black text-3xl tracking-widest select-none transition-all duration-75 flex flex-col items-center justify-center
            ${pressing || isBuzzing
              ? 'translate-y-2.5 scale-95 bg-gradient-to-b from-amber-400 via-amber-500 to-yellow-600 border-4 border-amber-300 text-slate-950 shadow-[0_4px_15px_rgba(245,158,11,0.6)]'
              : 'translate-y-0 scale-100 bg-gradient-to-b from-rose-500 via-red-600 to-red-800 border-4 border-rose-300/40 text-white shadow-[0_15px_35px_rgba(225,29,72,0.7),inset_0_4px_10px_rgba(255,255,255,0.4)] hover:brightness-110 active:translate-y-2'
            }
          `}
          style={{ WebkitTapHighlightColor: 'transparent', touchAction: 'manipulation' }}
        >
          {/* Bevel light highlight on top */}
          <div className="absolute top-2 w-36 h-12 bg-white/20 rounded-full blur-[2px] pointer-events-none" />

          {isBuzzing || pressing ? (
            <>
              <LightningIcon size={40} className="animate-bounce text-slate-950" />
              <span className="text-xl font-black mt-1 tracking-wider">BUZZ!</span>
            </>
          ) : (
            <>
              <div className="w-9 h-9 rounded-full border-2 border-white/60 flex items-center justify-center mb-1">
                <div className="w-3.5 h-3.5 rounded-full bg-white animate-pulse" />
              </div>
              <span className="text-2xl font-black tracking-widest mt-0.5 drop-shadow-md">BUZZ</span>
            </>
          )}
        </button>
      </div>

      <div className="text-center">
        <p className={`text-base font-black tracking-widest ${isBuzzing || pressing ? 'text-amber-400 animate-bounce' : 'text-emerald-400 animate-pulse'}`}>
          {isBuzzing || pressing ? 'MENGIRIM KE SERVER...' : 'TEKAN SEKARANG!'}
        </p>
        <p className="text-slate-500 text-xs mt-0.5 font-medium">Siapa cepat dia dapat giliran bicara</p>
      </div>
    </div>
  )
}
