'use client'

import { useRef, useState, useEffect } from 'react'

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
      <div className="bg-white/5 rounded-2xl p-4 text-white/40 text-center">
        No song selected
      </div>
    )
  }

  return (
    <div className="bg-white/5 rounded-2xl p-4 space-y-3">
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

      <div>
        <p className="text-white font-bold text-lg truncate">{songTitle}</p>
        <p className="text-purple-300 text-sm">{songArtist}</p>
      </div>

      {/* Progress bar */}
      <div className="relative h-2 bg-white/10 rounded-full overflow-hidden">
        <div
          className="absolute h-full bg-purple-500 rounded-full transition-all"
          style={{ width: duration ? `${(currentTime / duration) * 100}%` : '0%' }}
        />
      </div>
      <div className="flex justify-between text-xs text-white/40">
        <span>{formatTime(currentTime)}</span>
        <span>{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex gap-3">
        {!playing ? (
          <button
            onClick={handlePlay}
            className="flex-1 bg-green-500 hover:bg-green-400 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            ▶ PLAY
          </button>
        ) : (
          <button
            onClick={handlePause}
            className="flex-1 bg-yellow-500 hover:bg-yellow-400 text-white font-bold py-3 rounded-xl transition-all active:scale-95"
          >
            ⏸ PAUSE
          </button>
        )}
        <button
          onClick={handleStop}
          className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-5 rounded-xl transition-all active:scale-95"
        >
          ⏹ STOP
        </button>
      </div>
    </div>
  )
}
