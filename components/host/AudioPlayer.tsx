'use client'

import { useRef, useState, useEffect } from 'react'
import { MusicIcon, DiscIcon, PlayIcon, PauseIcon, StopIcon } from '@/components/shared/Icons'

interface AudioPlayerProps {
  audioUrl: string | null
  songTitle: string | null
  songArtist: string | null
}

export function AudioPlayer({ audioUrl, songTitle, songArtist }: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)

  // Reset when song changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [audioUrl])

  const handlePlay = () => {
    audioRef.current?.play()
    setPlaying(true)
  }

  const handlePause = () => {
    audioRef.current?.pause()
    setPlaying(false)
  }

  const handleStop = () => {
    if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
    setPlaying(false)
    setCurrentTime(0)
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
          onLoadedMetadata={(e) => setDuration(e.currentTarget.duration)}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => { setPlaying(false); setCurrentTime(0) }}
          preload="metadata"
        />
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
