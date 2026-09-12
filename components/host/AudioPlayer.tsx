'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import {
  MusicIcon,
  DiscIcon,
  PlayIcon,
  PauseIcon,
  StopIcon,
  ShuffleIcon,
} from '@/components/shared/Icons'
import type { BuzzState } from '@/lib/types'
import type { SpotifyPlayerInstance, SpotifyPlaybackState } from '@/types/spotify'

interface AudioPlayerProps {
  audioUrl: string | null
  songTitle: string | null
  songArtist: string | null
  buzzState?: BuzzState
  songId?: string | null
  roomCode?: string
  isCountingDown?: boolean
  shouldAutoPlay?: boolean
  onAutoPlayHandled?: () => void
  onStartCountdown?: () => void
}

export function AudioPlayer({
  audioUrl,
  songTitle,
  songArtist,
  buzzState,
  songId,
  roomCode,
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null)
  const isSpotifyTrack = Boolean(audioUrl && audioUrl.startsWith('spotify:track:'))

  // Spotify SDK State
  const [spotifyConnected, setSpotifyConnected] = useState<boolean | null>(null)
  const [spotifyToken, setSpotifyToken] = useState<string | null>(null)
  const [spotifyDeviceId, setSpotifyDeviceId] = useState<string | null>(null)
  const [spotifyError, setSpotifyError] = useState<string | null>(null)
  const spotifyPlayerRef = useRef<SpotifyPlayerInstance | null>(null)

  // Playback State
  const [playing, setPlaying] = useState(false)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [randomStart, setRandomStart] = useState(0)
  const [isFullPlay, setIsFullPlay] = useState(false)
  const [isTransferring, setIsTransferring] = useState(false)

  const calcRandomStart = useCallback((dur: number) => {
    if (!dur || dur <= 10) return 0
    const min = Math.min(15, dur * 0.15)
    const max = Math.max(min + 5, dur * 0.65)
    return Math.floor(min + Math.random() * (max - min))
  }, [])

  // 1. Fetch Spotify auth token & connection status
  const fetchSpotifyToken = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/spotify/token')
      const data = await res.json()
      if (data.connected && data.accessToken) {
        setSpotifyConnected(true)
        setSpotifyToken(data.accessToken)
        return data.accessToken
      } else {
        setSpotifyConnected(false)
        setSpotifyToken(null)
        return null
      }
    } catch (err) {
      console.error('Error fetching Spotify token:', err)
      setSpotifyConnected(false)
      return null
    }
  }, [])

  useEffect(() => {
    fetchSpotifyToken()
  }, [fetchSpotifyToken])

  // 2. Initialize Spotify Web Playback SDK when token is available
  useEffect(() => {
    if (!spotifyConnected) return

    // Inject SDK script tag if not present
    if (!document.getElementById('spotify-player-script')) {
      const script = document.createElement('script')
      script.id = 'spotify-player-script'
      script.src = 'https://sdk.scdn.co/spotify-player.js'
      script.async = true
      document.body.appendChild(script)
    }

    const initPlayer = () => {
      if (!window.Spotify || spotifyPlayerRef.current) return

      const player = new window.Spotify.Player({
        name: 'CG Guess The Song Web Player',
        getOAuthToken: async (cb) => {
          const token = await fetchSpotifyToken()
          if (token) cb(token)
        },
        volume: 0.8,
      })

      player.addListener('ready', ({ device_id }) => {
        console.log('Spotify Web Player Ready with Device ID', device_id)
        setSpotifyDeviceId(device_id)
        setSpotifyError(null)
      })

      player.addListener('not_ready', ({ device_id }) => {
        console.warn('Spotify Device ID has gone offline', device_id)
        setSpotifyDeviceId(null)
      })

      player.addListener('account_error', ({ message }) => {
        console.error('Spotify account error:', message)
        setSpotifyError('Akun Spotify kamu bukan Premium. Web Playback membutuhkan akun Spotify Premium.')
      })

      player.addListener('authentication_error', ({ message }) => {
        console.error('Spotify authentication error:', message)
        setSpotifyConnected(false)
        setSpotifyError('Sesi Spotify berakhir. Silakan login ulang.')
      })

      player.addListener('initialization_error', ({ message }) => {
        console.error('Spotify initialization error:', message)
        setSpotifyError('Browser memblokir pemutar musik atau tidak didukung.')
      })

      player.addListener('playback_error', ({ message }) => {
        console.error('Spotify playback error:', message)
      })

      player.addListener('player_state_changed', (state: SpotifyPlaybackState | null) => {
        if (!state) return
        setPlaying(!state.paused)
        if (state.duration) {
          const durSec = Math.floor(state.duration / 1000)
          setDuration(durSec)
        }
        if (state.position !== undefined) {
          setCurrentTime(Math.floor(state.position / 1000))
        }
      })

      player.connect().then((success) => {
        if (success) {
          spotifyPlayerRef.current = player
        }
      })
    }

    if (window.Spotify) {
      initPlayer()
    } else {
      window.onSpotifyWebPlaybackSDKReady = () => {
        initPlayer()
      }
    }

    return () => {
      if (spotifyPlayerRef.current) {
        spotifyPlayerRef.current.disconnect()
        spotifyPlayerRef.current = null
      }
    }
  }, [spotifyConnected, fetchSpotifyToken])

  // 3. Real-time progress tracker while Spotify is playing
  useEffect(() => {
    if (!playing || !isSpotifyTrack || !spotifyPlayerRef.current) return

    const interval = setInterval(async () => {
      try {
        const state = await spotifyPlayerRef.current?.getCurrentState()
        if (state) {
          setCurrentTime(Math.floor(state.position / 1000))
          if (state.duration) setDuration(Math.floor(state.duration / 1000))
          setPlaying(!state.paused)
        }
      } catch (e) {
        // ignore
      }
    }, 500)

    return () => clearInterval(interval)
  }, [playing, isSpotifyTrack])

  // 4. Re-roll random start position
  const handleReRoll = useCallback(() => {
    const estDur = duration || 180
    const nextStart = calcRandomStart(estDur)
    setRandomStart(nextStart)
    setCurrentTime(nextStart)

    if (isSpotifyTrack) {
      if (!playing && spotifyPlayerRef.current) {
        spotifyPlayerRef.current.seek(nextStart * 1000).catch(console.error)
      }
    } else {
      if (audioRef.current && !playing) {
        audioRef.current.currentTime = nextStart
      }
    }
  }, [duration, calcRandomStart, isSpotifyTrack, playing])

  // 5. Reset when song changes
  useEffect(() => {
    setPlaying(false)
    setCurrentTime(0)
    setIsFullPlay(false)

    // Calculate an initial random start so the host sees it immediately
    const initialStart = calcRandomStart(duration || 180)
    setRandomStart(initialStart)

    if (isSpotifyTrack) {
      spotifyPlayerRef.current?.pause().catch(() => {})
    } else if (audioRef.current) {
      audioRef.current.pause()
      audioRef.current.currentTime = 0
    }
  }, [audioUrl, songId, isSpotifyTrack, calcRandomStart])

  // 6. Auto-pause when player buzzes in
  useEffect(() => {
    if (buzzState === 'LOCKED' || buzzState === 'ANSWERING') {
      if (isSpotifyTrack) {
        spotifyPlayerRef.current?.pause().catch(() => {})
      } else if (audioRef.current) {
        audioRef.current.pause()
      }
      setPlaying(false)
    }
  }, [buzzState, isSpotifyTrack])

  // 7. Auto-resume song when answer is CORRECT (buzzState === RESULT)
  useEffect(() => {
    if (buzzState === 'RESULT') {
      setIsFullPlay(true)

      const timer = setTimeout(() => {
        if (isSpotifyTrack) {
          spotifyPlayerRef.current?.resume().then(() => setPlaying(true)).catch((err) => {
            console.error('Spotify resume error:', err)
          })
        } else if (audioRef.current) {
          if (audioRef.current.currentTime === 0 && randomStart > 0) {
            audioRef.current.currentTime = randomStart
            setCurrentTime(randomStart)
          }
          const playPromise = audioRef.current.play()
          if (playPromise !== undefined) {
            playPromise
              .then(() => setPlaying(true))
              .catch((err) => console.log('Autoplay error:', err))
          }
        }
      }, 1300)

      return () => clearTimeout(timer)
    }
  }, [buzzState, isSpotifyTrack, randomStart])

  // 8. Playback controls
  const handlePlay = async () => {
    if (isSpotifyTrack) {
      if (!spotifyConnected) {
        window.location.href = `/api/auth/spotify/login?roomCode=${encodeURIComponent(roomCode || '')}`
        return
      }

      if (!spotifyDeviceId) {
        alert('Pemutar Spotify sedang disiapkan... Mohon tunggu beberapa detik.')
        return
      }

      setIsTransferring(true)
      try {
        const token = spotifyToken || (await fetchSpotifyToken())
        const startPos = !isFullPlay && currentTime === 0 && randomStart > 0 ? randomStart * 1000 : currentTime * 1000

        const res = await fetch(`https://api.spotify.com/v1/me/player/play?device_id=${spotifyDeviceId}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            uris: [audioUrl],
            position_ms: startPos,
          }),
        })

        if (!res.ok) {
          // If already active or track paused, attempt resume
          await spotifyPlayerRef.current?.resume()
        }

        setPlaying(true)
      } catch (err) {
        console.error('Failed to play Spotify track:', err)
      } finally {
        setIsTransferring(false)
      }
      return
    }

    // HTML5 Playback
    if (!audioRef.current) return
    if (!isFullPlay && currentTime === 0 && randomStart > 0) {
      audioRef.current.currentTime = randomStart
      setCurrentTime(randomStart)
    }
    audioRef.current.play()
    setPlaying(true)
  }

  const handlePause = async () => {
    if (isSpotifyTrack) {
      await spotifyPlayerRef.current?.pause().catch(() => {})
      setPlaying(false)
      return
    }

    audioRef.current?.pause()
    setPlaying(false)
  }

  const handleStop = async () => {
    const resetTime = randomStart > 0 ? randomStart : 0
    if (isSpotifyTrack) {
      await spotifyPlayerRef.current?.pause().catch(() => {})
      await spotifyPlayerRef.current?.seek(resetTime * 1000).catch(() => {})
      setCurrentTime(resetTime)
      setPlaying(false)
      return
    }

    if (audioRef.current) {
      audioRef.current.pause()
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

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pos = (e.clientX - rect.left) / rect.width
    const target = pos * duration

    if (isSpotifyTrack) {
      spotifyPlayerRef.current?.seek(Math.floor(target * 1000)).catch(console.error)
      setCurrentTime(target)
      return
    }

    if (audioRef.current) {
      audioRef.current.currentTime = target
      setCurrentTime(target)
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
          <p className="text-slate-400 text-xs">Pilih salah satu lagu di daftar bawah atau cari di Spotify untuk mulai memutar.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="glass-panel rounded-3xl p-6 border border-white/10 space-y-5 shadow-2xl relative overflow-hidden">
      {/* Subtle ambient glow behind player */}
      <div
        className={`absolute top-0 right-0 w-64 h-32 rounded-full blur-[80px] pointer-events-none transition-all duration-700 ${
          playing ? 'bg-emerald-500/20' : 'bg-transparent'
        }`}
      />

      {/* HTML5 Audio element for non-Spotify tracks */}
      {!isSpotifyTrack && (
        <audio
          ref={audioRef}
          src={audioUrl}
          onLoadedMetadata={handleMetadata}
          onTimeUpdate={(e) => setCurrentTime(e.currentTarget.currentTime)}
          onEnded={() => {
            setPlaying(false)
            setCurrentTime(0)
          }}
          preload="metadata"
        />
      )}

      {/* Spotify Connection Warning/Prompt */}
      {isSpotifyTrack && spotifyConnected === false && (
        <div className="flex flex-col sm:flex-row items-center justify-between p-3.5 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 gap-3 relative z-10 shadow-lg">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-slate-950 flex items-center justify-center font-black shrink-0">
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.307c-.218.358-.68.472-1.038.254-2.846-1.74-6.428-2.133-10.648-1.168-.41.094-.82-.162-.914-.572-.093-.41.163-.82.573-.914 4.624-1.057 8.583-.615 11.773 1.362.358.218.472.68.254 1.038zm1.467-3.262c-.274.446-.86.588-1.306.314-3.258-2.003-8.224-2.585-12.077-1.415-.498.151-1.028-.135-1.18-.633-.15-.498.136-1.028.634-1.18 4.407-1.338 9.883-.69 13.615 1.608.446.274.588.86.314 1.306zm.126-3.41c-3.908-2.32-10.354-2.533-14.093-1.398-.6.182-1.238-.162-1.42-.762-.182-.6.162-1.238.762-1.42 4.303-1.306 11.417-1.055 15.918 1.617.538.319.713 1.018.394 1.556-.319.538-1.018.713-1.556.394z" />
              </svg>
            </div>
            <div>
              <p className="text-emerald-300 font-bold text-xs">Spotify Belum Terhubung</p>
              <p className="text-slate-300 text-[11px]">Hubungkan akun Spotify Premium Anda agar browser ini dapat memutar lagu langsung.</p>
            </div>
          </div>
          <a
            href={`/api/auth/spotify/login?roomCode=${encodeURIComponent(roomCode || '')}`}
            className="px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black text-xs transition-all active:scale-95 shrink-0 shadow-md shadow-emerald-500/20"
          >
            Hubungkan Spotify
          </a>
        </div>
      )}

      {/* Spotify Error Alert */}
      {spotifyError && (
        <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold relative z-10">
          {spotifyError}
        </div>
      )}

      {/* Mode Banner: Song Resumes on Correct or Random Start indicator */}
      {isFullPlay && buzzState === 'RESULT' ? (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold relative z-10 shadow-lg shadow-emerald-500/10">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
            <span>Jawaban Benar! Melanjutkan Lagu Sampai Selesai</span>
          </div>
          <span className="text-[10px] uppercase font-black tracking-wider text-emerald-400 bg-emerald-400/20 px-2.5 py-0.5 rounded-full border border-emerald-400/30">
            LANJUT MEMUTAR
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
        <div
          className={`w-14 h-14 rounded-2xl bg-gradient-to-br from-slate-800 to-slate-900 border border-white/10 flex items-center justify-center shadow-inner shrink-0 ${
            playing ? 'ring-2 ring-emerald-400 text-emerald-400' : 'text-slate-400'
          }`}
        >
          <DiscIcon size={26} className={playing ? 'animate-spin' : ''} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-emerald-400 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20">
              {playing ? 'SEDANG MEMUTAR' : 'SIAP DIPUTAR'}
            </span>
            {isSpotifyTrack && (
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center gap-1">
                <svg className="w-2.5 h-2.5 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.307c-.218.358-.68.472-1.038.254-2.846-1.74-6.428-2.133-10.648-1.168-.41.094-.82-.162-.914-.572-.093-.41.163-.82.573-.914 4.624-1.057 8.583-.615 11.773 1.362.358.218.472.68.254 1.038zm1.467-3.262c-.274.446-.86.588-1.306.314-3.258-2.003-8.224-2.585-12.077-1.415-.498.151-1.028-.135-1.18-.633-.15-.498.136-1.028.634-1.18 4.407-1.338 9.883-.69 13.615 1.608.446.274.588.86.314 1.306zm.126-3.41c-3.908-2.32-10.354-2.533-14.093-1.398-.6.182-1.238-.162-1.42-.762-.182-.6.162-1.238.762-1.42 4.303-1.306 11.417-1.055 15.918 1.617.538.319.713 1.018.394 1.556-.319.538-1.018.713-1.556.394z" />
                </svg>
                <span>Spotify</span>
              </span>
            )}
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
            disabled={isTransferring}
            className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-50 text-slate-950 font-black py-4 rounded-2xl transition-all active:scale-[0.98] shadow-lg shadow-emerald-500/20 text-sm sm:text-base flex items-center justify-center gap-2"
          >
            <PlayIcon size={16} />
            <span>{isTransferring ? 'MEMULAI AUDIO...' : 'PUTAR LAGU (LAPTOP)'}</span>
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
