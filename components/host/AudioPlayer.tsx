'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import { MusicIcon, DiscIcon, PlayIcon, PauseIcon, StopIcon, ShuffleIcon } from '@/components/shared/Icons'
import type { BuzzState } from '@/lib/types'

interface AudioPlayerProps {
  audioUrl: string | null
  songTitle: string | null
  songArtist: string | null
  buzzState?: BuzzState
  songId?: string | null
}

export function AudioPlayer({ audioUrl, songTitle, songArtist, buzzState, songId }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [randomStart, setRandomStart] = useState(0)
  const [isFullPlay, setIsFullPlay] = useState(false)

  const calcRandomStart = useCallback((dur: number) => {
    if (!dur || dur <= 10) return 0
    const min = Math.min(15, dur * 0.15)
    const max = Math.max(min + 5, dur * 0.65)
    return Math.floor(min + Math.random() * (max - min))
  }, [])

  // Re-roll random start position
  const handleReRoll = useCallback(() => {
    if (!duration) return
    const nextStart = calcRandomStart(duration)
    setRandomStart(nextStart)
    if (audioRef.current && !playing) {
      audioRef.current.currentTime = nextStart
      setCurrentTime(nextStart)
    }
  }, [duration, calcRandomStart, playing])

  // Reset when song changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setIsFullPlay(false)
    setRandomStart(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [audioUrl, songId])

  // Auto-pause when player buzzes in
  useEffect(() => {
    if (buzzState === 'LOCKED' || buzzState === 'ANSWERING') {
      if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlaying(false)
    }
  }, [buzzState])

  // Auto-play FULL song from 0:00 when answer is CORRECT (buzzState === RESULT)
  useEffect(() => {
    if (buzzState === 'RESULT') {
      setIsFullPlay(true)
      if (audioRef.current) {
        audioRef.current.currentTime = 0
        setCurrentTime(0)
        const playPromise = audioRef.current.play()
        if (playPromise !== undefined) {
          playPromise
            .then(() => setPlaying(true))
            .catch((err) => console.log('Autoplay blocked by browser:', err))
        }
      }
    }
  }, [buzzState])

  const handlePlay = () => {
    if (!audioRef.current) return
    // If starting for the first time in guess mode, jump to random start
    if (!isFullPlay && currentTime === 0 && randomStart > 0) {
      audioRef.current.currentTime = randomStart
      setCurrentTime(randomStart)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  const handlePause = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      const resetTime = isFullPlay ? 0 : randomStart
      audioRef.current.currentTime = resetTime
      setCurrentTime(resetTime)
    }
    setPlaying(false)
  }

  const handleMetadata = (e: React.SyntheticEvent<HTMLAudioElement>) => {
    const dur = e.currentTarget.duration
    setDuration(dur)
    if (!isFullPlay) {
      const start = calcRandomStart(dur)
      setRandomStart(start)
      if (audioRef.current && currentTime === 0) {
        audioRef.current.currentTime = start
        setCurrentTime(start)
      }
    }
  }

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60)
    const sec = Math.floor(s % 60)
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!audioUrl) {
    return (
      <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center space-y-3">
        <div className="w-14 h-14 rounded-full bg-slate-800/80 border border-white/5 flex items-center justify-center text-slate-400 mx-auto">
          <MusicIcon size={24} />
        </div>
        <div>
          <p className="text-white font-bold text-base">Belum Ada Lagu Dipilih</p>
          <p className="text-slate-400 text-xs">Pilih salah satu lagu di daftar bawah untuk mulai memutar.</p>
        </div>
      </div>
    )
  }

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const target = pos * duration
    audioRef.current.currentTime = target
    setCurrentTime(target)
  }

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-5 shadow-2xl relative overflow-hidden">
      {/* Subtle ambient glow behind player */}
      <div className={`absolute top-0 right-0 w-64 h-32 rounded-full blur-[80px] pointer-events-none transition-all duration-700 ${playing ? 'bg-emerald-500/20' : 'bg-transparent'}`} />

      {audioUrl && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => { setPlaying(false); setCurrentTime(0) }}
          preload="metadata"
        />
      )}

      {/* Mode Banner: Full Song on Correct or Random Start indicator */}
      {isFullPlay && buzzState === 'RESULT' ? (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold relative z-10 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Jawaban Benar! Memutar Lagu Penuh Otomatis</span>
          </div>
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 bg-emerald-400/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
            FULL TRACK
          </span>
        </div>
      ) : (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-white/5 text-slate-300 text-xs font-semibold relative z-10">
          <div className="flex items-center gap-2">
            <ShuffleIcon size={14} className="text-amber-400" />
            <span>
              Titik Mulai Acak: <span className="font-mono font-bold text-amber-400">{formatTime(randomStart)}</span>
            </span>
          </div>
          <button
            onClick={handleReRoll}
            type="button"
            disabled={playing}
            title="Acak titik mulai lagu lain"
            className="inline-flex items-center gap-1.5 text-[11px] font-bold text-slate-400 hover:text-emerald-300 disabled:opacity-40 transition-all py-1 px-2.5 rounded-xl bg-white/5 hover:bg-white/10 active:scale-95"
          >
            <ShuffleIcon size={12} />
            <span>Acak Ulang Posisi</span>
          </button>
        </div>
      )}

      {/* Track info with animated vinyl/soundwave */}
      <div className="flex items-center gap-4 relative z-10">
        <div className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shadow-inner shrink-0 ${playing ? 'ring-2 ring-emerald-400 text-emerald-400' : 'text-slate-400'}`}>
          <DiscIcon size={26} className={playing ? 'animate-spin' : ''} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {playing ? 'SEDANG MEMUTAR' : 'SIAP DIPUTAR'}
            </span>
            {playing && (
              <div className="flex items-end gap-0.5 h-3">
                <div className="w-1 bg-emerald-400 rounded-full animate-equalizer" style={{ animationDelay: '0ms' }} />
                <div className="w-1 bg-emerald-400 rounded-full animate-equalizer" style={{ animationDelay: '200ms' }} />
                <div className="w-1 bg-emerald-400 rounded-full animate-equalizer" style={{ animationDelay: '400ms' }} />
              </div>
            )}
          </div>
          <p className="text-white font-extrabold text-xl truncate mt-1">{songTitle}</p>
          <p className="text-slate-400 text-sm truncate">{songArtist}</p>
        </div>
      </div>

      {/* Interactive Progress bar with Seek */}
      <div className="space-y-1.5 relative z-10">
        <div
          onClick={handleSeek}
          className="relative h-2.5 bg-slate-900/90 rounded-full overflow-hidden cursor-pointer border border-white/5 group"
        >
          <div
            className="absolute h-full bg-gradient-to-r from-emerald-500 to-teal-400 rounded-full transition-all duration-100"
            style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-slate-400 font-semibold">
          <span>{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Control Buttons Deck */}
      <div className="flex gap-3 relative z-10">
        {!playing ? (
          <button
            onClick={handlePlay}
            className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <PlayIcon size={16} />
            <span>PUTAR LAGU (LAPTOP)</span>
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-amber-500/20 text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <PauseIcon size={16} />
            <span>JEDA AUDIO</span>
          </button>
        )}
        <button
          onClick={handleStop}
          className="bg-slate-900/90 hover:bg-slate-800 text-slate-300 hover:text-white font-bold py-4 px-6 rounded-2xl border border-white/10 transition-all active:scale-95 text-sm sm:text-base flex items-center justify-center gap-2"
        >
          <StopIcon size={16} />
          <span>STOP</span>
        </button>
      </div>
    </div>
  )
}
