'use client'

import { useState, useEffect, useRef } from 'react'
import { playCountdownBeep } from '@/lib/audio'
import { LightningIcon } from '@/components/shared/Icons'

interface CountdownOverlayProps {
  countdownEndTime: number | null
  onFinished?: () => void
  isHost?: boolean
}

export function CountdownOverlay({
  countdownEndTime,
  onFinished,
  isHost = false,
}: CountdownOverlayProps) {
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null)
  const lastSecondRef = useRef<number | null>(null)
  const finishedCalledRef = useRef(false)
  // Store onFinished in a ref so changing callback reference doesn't restart the timer effect
  const onFinishedRef = useRef(onFinished)
  useEffect(() => {
    onFinishedRef.current = onFinished
  }, [onFinished])

  useEffect(() => {
    if (!countdownEndTime) {
      setSecondsLeft(null)
      lastSecondRef.current = null
      finishedCalledRef.current = false
      return
    }

    finishedCalledRef.current = false

    const updateTimer = () => {
      const now = Date.now()
      const diff = countdownEndTime - now

      if (diff <= 0) {
        setSecondsLeft(0)
        if (lastSecondRef.current !== 0) {
          playCountdownBeep(true)
          lastSecondRef.current = 0
        }
        if (!finishedCalledRef.current) {
          finishedCalledRef.current = true
          // Small grace period for "MULAI!" display before callback
          setTimeout(() => {
            onFinishedRef.current?.()
          }, 450)
        }
        return
      }

      const sec = Math.min(3, Math.max(1, Math.ceil(diff / 1000)))
      setSecondsLeft(sec)

      if (lastSecondRef.current !== sec) {
        playCountdownBeep(false)
        lastSecondRef.current = sec
      }
    }

    updateTimer()
    const interval = setInterval(updateTimer, 50)
    return () => clearInterval(interval)
  }, [countdownEndTime])

  if (secondsLeft === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 backdrop-blur-xl animate-in fade-in duration-200">
      {/* Radiant glow ring */}
      <div
        className={`absolute w-80 h-80 rounded-full blur-[100px] pointer-events-none transition-all duration-300 ${
          secondsLeft === 0
            ? 'bg-emerald-500/40 scale-125'
            : secondsLeft === 1
            ? 'bg-emerald-500/30 scale-110'
            : secondsLeft === 2
            ? 'bg-cyan-500/30 scale-100'
            : 'bg-amber-500/30 scale-90'
        }`}
      />

      <div className="relative z-10 text-center space-y-6 max-w-sm px-6">
        {/* Top badge */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-black uppercase tracking-widest text-slate-200 shadow-xl">
          <LightningIcon size={14} className="text-amber-400" />
          <span>{isHost ? 'Memulai Musik Segera' : 'Buzzer Akan Terbuka'}</span>
        </div>

        {/* Big Animated Number / Word */}
        <div className="flex items-center justify-center h-44">
          {secondsLeft > 0 ? (
            <div
              key={secondsLeft}
              className={`font-black font-mono tracking-tighter text-8xl sm:text-9xl transition-all duration-300 animate-in zoom-in-50 ${
                secondsLeft === 1
                  ? 'text-emerald-400 drop-shadow-[0_0_40px_rgba(52,211,153,0.8)]'
                  : secondsLeft === 2
                  ? 'text-cyan-400 drop-shadow-[0_0_40px_rgba(34,211,238,0.8)]'
                  : 'text-amber-400 drop-shadow-[0_0_40px_rgba(251,191,36,0.8)]'
              }`}
            >
              {secondsLeft}
            </div>
          ) : (
            <div
              key="mulai"
              className="text-white font-black text-6xl sm:text-7xl tracking-tight uppercase animate-in zoom-in-75 text-emerald-400 drop-shadow-[0_0_50px_rgba(52,211,153,0.9)]"
            >
              MULAI!
            </div>
          )}
        </div>

        {/* Subtitle instructions */}
        <div className="space-y-1">
          <h2 className="text-white font-bold text-lg">
            {secondsLeft === 3 && 'Bersiap di Tombol HP...'}
            {secondsLeft === 2 && 'Dengarkan Musik Baik-Baik...'}
            {secondsLeft === 1 && 'Konsentrasi! Segera Dimulai!'}
            {secondsLeft === 0 && 'TEKAN BUZZER JIKA TAHU!'}
          </h2>
          <p className="text-slate-400 text-xs">
            {isHost
              ? 'Lagu akan otomatis diputar begitu hitungan selesai.'
              : 'Tombol buzzer akan otomatis aktif saat hitungan berakhir.'}
          </p>
        </div>
      </div>
    </div>
  )
}

