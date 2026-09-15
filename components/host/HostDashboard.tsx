'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameState, broadcastHostAction } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { playDingSound, playCorrectFanfareSound, playWrongSound } from '@/lib/audio'
import {
  MicIcon,
  MusicIcon,
  UsersIcon,
  TrophyIcon,
  ArrowRightIcon,
  TrashIcon,
  SwordsIcon,
  CrownIcon,
  CheckIcon,
  RefreshIcon,
} from '@/components/shared/Icons'
import { AudioPlayer } from './AudioPlayer'
import { BuzzControlPanel } from './BuzzControlPanel'
import { SongSelector } from './SongSelector'
import { SpotifySearchModal } from './SpotifySearchModal'
import { PlayerListPanel } from './PlayerListPanel'
import { TournamentBracket } from './TournamentBracket'
import { Leaderboard } from '@/components/shared/Leaderboard'
import { WaitingRoom } from '@/components/shared/WaitingRoom'
import {
  getGameDisplayName,
  getGameMode,
  getTournamentState,
} from '@/lib/tournament-utils'
import type { Game, Player, Song, RoundType, HostSession, GameMode, TournamentPhase, PlaylistSection } from '@/lib/types'

interface HostDashboardProps {
  initialGame: Game
  initialPlayers: Player[]
  songs: Song[]
  hostSession: HostSession
}

export function HostDashboard({
  initialGame,
  initialPlayers,
  songs,
  hostSession,
}: HostDashboardProps) {
  const router = useRouter()
  const game = useGameState(initialGame.id, initialGame)
  const players = usePlayers(initialGame.id, initialPlayers)
  const [isLoading, setIsLoading] = useState(false)
  const [tab, setTab] = useState<'bracket' | 'players' | 'leaderboard'>('players')
  const [confirmEndGame, setConfirmEndGame] = useState(false)
  const [feedbackAnim, setFeedbackAnim] = useState<'none' | 'correct' | 'wrong'>('none')
  const [playerViolations, setPlayerViolations] = useState<Record<string, number>>({})

  const gameMode = getGameMode(game)
  const tournamentState = getTournamentState(game)

  // Switch tab to bracket automatically when tournament mode is selected
  useEffect(() => {
    if (gameMode === 'KNOCKOUT') {
      setTab('bracket')
    }
  }, [gameMode])

  const [isSpotifyModalOpen, setIsSpotifyModalOpen] = useState(false)
  const [spotifyInitialQuery, setSpotifyInitialQuery] = useState('')
  const [songList, setSongList] = useState<Song[]>(songs)
  const [spotifyConnectedBanner, setSpotifyConnectedBanner] = useState(false)

  // ── Host API helper ──────────────────────────────────────────────
  const hostAction = useCallback(
    async (action: string, payload?: object) => {
      setIsLoading(true)
      try {
        // If opening buzzer or resetting all buzzers, ensure DB is READY first so no player buzzes before DB is updated
        if (
          action === 'RESET_BUZZ' ||
          (action === 'SET_BUZZ_STATE' && (payload as any)?.buzzState === 'READY')
        ) {
          await fetch(`/api/admin/${game.room_code}`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
              'x-host-password': hostSession.hostPassword,
            },
            body: JSON.stringify({ action, payload }),
          })
          // Now that DB is 100% READY and exclusions cleared, signal all players
          broadcastHostAction(game.id, action, payload)
          return
        }

        // For other actions, broadcast immediately for snappy UI
        broadcastHostAction(game.id, action, payload)
        await fetch(`/api/admin/${game.room_code}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-host-password': hostSession.hostPassword,
          },
          body: JSON.stringify({ action, payload }),
        })
      } finally {
        setIsLoading(false)
      }
    },
    [game.room_code, hostSession.hostPassword, game.id]
  )

  // Playlist Sections State (Permanent across rooms and sessions)
  const [playlists, setPlaylists] = useState<PlaylistSection[]>(tournamentState?.playlists || [])
  const [activePlaylistId, setActivePlaylistId] = useState<string | null>(null)

  // Central sync helper: Saves to current room, localStorage, and permanent Supabase cloud master
  const persistPlaylists = useCallback(
    async (updated: PlaylistSection[]) => {
      setPlaylists(updated)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('cg-admin-master-playlists', JSON.stringify(updated))
        } catch {}
      }
      // 1. Sync to active room
      await hostAction('UPDATE_PLAYLISTS', { playlists: updated })
      // 2. Sync to Supabase cloud master record (permanent across all games/rooms)
      try {
        await fetch('/api/admin/master-playlists', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playlists: updated }),
        })
      } catch (err) {
        console.error('Failed to sync master playlists to cloud:', err)
      }
    },
    [hostAction]
  )

  // Sync playlists from tournamentState if present
  useEffect(() => {
    if (tournamentState?.playlists && tournamentState.playlists.length > 0) {
      setPlaylists(tournamentState.playlists)
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('cg-admin-master-playlists', JSON.stringify(tournamentState.playlists))
        } catch {}
      }
    }
  }, [tournamentState?.playlists])

  // If current room has no playlists, automatically load from master playlists (cloud & localStorage)
  useEffect(() => {
    const initMasterPlaylists = async () => {
      if ((!tournamentState?.playlists || tournamentState.playlists.length === 0) && playlists.length === 0) {
        // 1. Instant check from localStorage
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('cg-admin-master-playlists')
            if (cached) {
              const parsed = JSON.parse(cached)
              if (Array.isArray(parsed) && parsed.length > 0) {
                setPlaylists(parsed)
                await hostAction('UPDATE_PLAYLISTS', { playlists: parsed })
              }
            }
          } catch {}
        }

        // 2. Fetch master playlists from Supabase cloud
        try {
          const res = await fetch('/api/admin/master-playlists')
          const data = await res.json()
          if (data.playlists && Array.isArray(data.playlists) && data.playlists.length > 0) {
            setPlaylists(data.playlists)
            if (typeof window !== 'undefined') {
              try {
                localStorage.setItem('cg-admin-master-playlists', JSON.stringify(data.playlists))
              } catch {}
            }
            await hostAction('UPDATE_PLAYLISTS', { playlists: data.playlists })
          }
        } catch (err) {
          console.error('Error loading master playlists:', err)
        }
      }
    }
    initMasterPlaylists()
  }, []) // run once on mount

  const handleOpenSpotifySearch = (query?: string) => {
    setSpotifyInitialQuery(query || '')
    setIsSpotifyModalOpen(true)
  }

  const handleCreatePlaylist = useCallback(
    async (name: string) => {
      const newPl: PlaylistSection = {
        id: 'pl_' + Date.now(),
        name,
        songIds: [],
      }
      const updated = [...playlists, newPl]
      setActivePlaylistId(newPl.id)
      await persistPlaylists(updated)
    },
    [playlists, persistPlaylists]
  )

  const handleDeletePlaylist = useCallback(
    async (playlistId: string) => {
      const updated = playlists.filter((p) => p.id !== playlistId)
      if (activePlaylistId === playlistId) setActivePlaylistId(null)
      await persistPlaylists(updated)
    },
    [playlists, activePlaylistId, persistPlaylists]
  )

  const handleRenamePlaylist = useCallback(
    async (playlistId: string, newName: string) => {
      const updated = playlists.map((p) => (p.id === playlistId ? { ...p, name: newName } : p))
      await persistPlaylists(updated)
    },
    [playlists, persistPlaylists]
  )

  const handleRemoveSongFromPlaylist = useCallback(
    async (playlistId: string, songId: string) => {
      const updated = playlists.map((p) =>
        p.id === playlistId ? { ...p, songIds: p.songIds.filter((id) => id !== songId) } : p
      )
      await persistPlaylists(updated)
    },
    [playlists, persistPlaylists]
  )

  // Keep songList updated with prop and refresh from Supabase cloud
  useEffect(() => {
    setSongList(songs)

    const fetchLatestSongs = async () => {
      try {
        const supabase = getSupabaseBrowserClient()
        const { data: latest } = await supabase
          .from('songs')
          .select('*')
          .eq('active', true)
          .order('title')
        if (latest && latest.length > 0) {
          setSongList(latest)
        }
      } catch (err) {
        console.warn('Failed to load latest songs:', err)
      }
    }
    fetchLatestSongs()
  }, [songs])

  // Check URL param if Spotify just connected
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      if (params.get('spotify') === 'connected') {
        setSpotifyConnectedBanner(true)
        const timer = setTimeout(() => setSpotifyConnectedBanner(false), 7000)
        return () => clearTimeout(timer)
      }
    }
  }, [])

  const [optimisticSongId, setOptimisticSongId] = useState<string | null>(null)
  const effectiveSongId = optimisticSongId ?? game.current_song_id

  // Clear optimistic ID when realtime sync arrives
  useEffect(() => {
    if (optimisticSongId && game.current_song_id === optimisticSongId) {
      setOptimisticSongId(null)
    }
  }, [game.current_song_id, optimisticSongId])

  const currentSong = songList.find((s) => s.id === effectiveSongId) ?? null
  const buzzWinner = players.find((p) => p.id === game.buzz_winner_id) ?? null

  const handleSelectSpotifyTrack = async (track: { title: string; artist: string; uri: string }) => {
    setIsLoading(true)
    try {
      const res = await fetch(`/api/admin/${game.room_code}/spotify-song`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-host-password': hostSession.hostPassword,
        },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          spotifyUri: track.uri,
          roundType: game.current_round,
          setActive: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Gagal memilih lagu dari Spotify')
        return
      }
      if (data.songId) {
        const newSong: Song = {
          id: data.songId,
          title: track.title,
          artist: track.artist,
          audio_url: track.uri,
          round_type: game.current_round,
          difficulty: 'MEDIUM',
          active: true,
        }
        setSongList((prev) => {
          if (prev.some((s) => s.id === data.songId)) return prev
          return [...prev, newSong]
        })

        // If currently in a playlist section, attach song to it
        if (activePlaylistId) {
          const updated = playlists.map((p) =>
            p.id === activePlaylistId
              ? { ...p, songIds: [...new Set([...p.songIds, data.songId])] }
              : p
          )
          await persistPlaylists(updated)
        }
      }
    } catch (err) {
      console.error('Error selecting Spotify song:', err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddToPlaylist = async (track: { title: string; artist: string; uri: string }) => {
    try {
      const res = await fetch(`/api/admin/${game.room_code}/spotify-song`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-host-password': hostSession.hostPassword,
        },
        body: JSON.stringify({
          title: track.title,
          artist: track.artist,
          spotifyUri: track.uri,
          roundType: game.current_round,
          setActive: false, // Do not change active playing song!
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        alert(data.error || 'Gagal menambahkan lagu ke playlist')
        return
      }
      if (data.songId) {
        const newSong: Song = {
          id: data.songId,
          title: track.title,
          artist: track.artist,
          audio_url: track.uri,
          round_type: game.current_round,
          difficulty: 'MEDIUM',
          active: true,
        }
        setSongList((prev) => {
          if (prev.some((s) => s.id === data.songId)) return prev
          return [...prev, newSong]
        })

        // If currently in a playlist section, attach song to it
        if (activePlaylistId) {
          const updated = playlists.map((p) =>
            p.id === activePlaylistId
              ? { ...p, songIds: [...new Set([...p.songIds, data.songId])] }
              : p
          )
          await persistPlaylists(updated)
        }
      }
    } catch (err) {
      console.error('Error adding song to playlist:', err)
    }
  }

  const handleDeleteSong = async (songId: string) => {
    try {
      const res = await fetch(`/api/admin/${game.room_code}/spotify-song`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'x-host-password': hostSession.hostPassword,
        },
        body: JSON.stringify({ songId }),
      })
      if (res.ok) {
        setSongList((prev) => prev.filter((s) => s.id !== songId))
        // Also remove from any playlist sections
        const updated = playlists.map((p) => ({
          ...p,
          songIds: p.songIds.filter((id) => id !== songId),
        }))
        await persistPlaylists(updated)
      }
    } catch (err) {
      console.error('Failed to delete song:', err)
    }
  }

  // Play sound when someone buzzes in
  const lastWinnerRef = useRef<string | null>(null)
  useEffect(() => {
    if (game.buzz_winner_id && game.buzz_winner_id !== lastWinnerRef.current) {
      playDingSound()
    }
    lastWinnerRef.current = game.buzz_winner_id
  }, [game.buzz_winner_id])

  const handleUpdateScore = useCallback(
    async (playerId: string, score: number) => {
      await hostAction('UPDATE_PLAYER_SCORE', { playerId, score })
    },
    [hostAction]
  )

  const handleResetAllScores = useCallback(async () => {
    await hostAction('RESET_ALL_SCORES')
  }, [hostAction])

  const handleSetGameMode = useCallback(
    async (mode: GameMode) => {
      await hostAction('SET_GAME_MODE', { mode })
    },
    [hostAction]
  )

  const handleGenerateBracket = useCallback(
    async (targetPoints: number) => {
      await hostAction('GENERATE_BRACKET', { targetPoints })
    },
    [hostAction]
  )

  const handleSetActiveMatch = useCallback(
    async (matchId: string) => {
      await hostAction('SET_ACTIVE_MATCH', { matchId })
    },
    [hostAction]
  )

  const handleAdvanceWinner = useCallback(
    async (matchId: string, winnerId: string) => {
      await hostAction('ADVANCE_MATCH_WINNER', { matchId, winnerId })
    },
    [hostAction]
  )

  const handleSetTournamentPhase = useCallback(
    async (phase: TournamentPhase) => {
      await hostAction('SET_TOURNAMENT_PHASE', { phase })
    },
    [hostAction]
  )

  const handleShuffleGroups = useCallback(async () => {
    await hostAction('SHUFFLE_GROUPS')
  }, [hostAction])

  const handleStartGroupA = useCallback(async () => {
    await hostAction('SET_TOURNAMENT_PHASE', { phase: 'GROUP_A' })
  }, [hostAction])

  const handleStartGroupB = useCallback(async () => {
    await hostAction('SET_TOURNAMENT_PHASE', { phase: 'GROUP_B' })
  }, [hostAction])

  const handleResetTournament = useCallback(async () => {
    await hostAction('RESET_TOURNAMENT')
  }, [hostAction])

  const handleSetQualifyCount = useCallback(
    async (count: 2 | 3) => {
      await hostAction('SET_QUALIFY_COUNT', { count })
    },
    [hostAction]
  )

  const handleEndGame = async () => {
    setIsLoading(true)
    try {
      await fetch(`/api/admin/${game.room_code}`, {
        method: 'DELETE',
        headers: {
          'x-host-password': hostSession.hostPassword,
        },
      })
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`cg-host-${game.room_code}`)
      }
      router.push('/')
    } catch (err) {
      console.error('Error ending game:', err)
    } finally {
      setIsLoading(false)
      setConfirmEndGame(false)
    }
  }

  // Track previous buzz state and attempt to detect answer evaluations in real-time
  const prevBuzzStateRef = useRef(game.buzz_state)
  const prevAttemptRef = useRef(game.current_attempt)
  const lastHostResultKeyRef = useRef<string | null>(null)
  const lastHostWrongKeyRef = useRef<string | null>(null)

  // Reset feedback keys when song changes
  useEffect(() => {
    lastHostResultKeyRef.current = null
    lastHostWrongKeyRef.current = null
  }, [game.current_song_id])

  // Synchronized sound & visual feedback on Host
  // Triggers ONLY after real-time update arrives from server if not already triggered at 0ms
  useEffect(() => {
    // When answer is evaluated as CORRECT or all failed (game transitions to RESULT)
    if (game.buzz_state === 'RESULT' && prevBuzzStateRef.current !== 'RESULT') {
      const outcome = tournamentState?.lastSongOutcome
      const resultKey = `${game.current_song_id || 'song'}_${outcome || 'CORRECT'}`
      if (lastHostResultKeyRef.current === resultKey) {
        prevBuzzStateRef.current = game.buzz_state
        prevAttemptRef.current = game.current_attempt
        return
      }
      lastHostResultKeyRef.current = resultKey

      const isAllWrong = outcome === 'ALL_WRONG'
      if (isAllWrong) {
        playWrongSound()
        setFeedbackAnim('wrong')
        setTimeout(() => setFeedbackAnim('none'), 800)
      } else {
        playCorrectFanfareSound()
        setFeedbackAnim('correct')
        setTimeout(() => setFeedbackAnim('none'), 1000)
      }
      prevBuzzStateRef.current = game.buzz_state
      prevAttemptRef.current = game.current_attempt
      return
    }

    // When answer is evaluated as WRONG (attempt increments and state returns to READY)
    if (
      game.buzz_state === 'READY' &&
      (prevBuzzStateRef.current === 'LOCKED' || prevBuzzStateRef.current === 'ANSWERING') &&
      game.current_attempt > prevAttemptRef.current
    ) {
      const wrongKey = `${game.current_song_id || 'song'}_WRONG_${game.current_attempt}`
      if (lastHostWrongKeyRef.current === wrongKey) {
        prevBuzzStateRef.current = game.buzz_state
        prevAttemptRef.current = game.current_attempt
        return
      }
      lastHostWrongKeyRef.current = wrongKey

      playWrongSound()
      setFeedbackAnim('wrong')
      setTimeout(() => setFeedbackAnim('none'), 800)
      prevBuzzStateRef.current = game.buzz_state
      prevAttemptRef.current = game.current_attempt
      return
    }

    // Auto-close popup immediately whenever buzz_state transitions away from RESULT
    if (prevBuzzStateRef.current === 'RESULT' && game.buzz_state !== 'RESULT') {
      setFeedbackAnim('none')
    }

    prevBuzzStateRef.current = game.buzz_state
    prevAttemptRef.current = game.current_attempt
  }, [game.buzz_state, game.current_attempt, game.current_song_id, tournamentState?.lastSongOutcome])

  const answerAction = useCallback(
    async (result: 'CORRECT' | 'WRONG') => {
      const currentBuzzWinner = players.find((p) => p.id === game.buzz_winner_id)
      const currentSongData = currentSong ? { title: currentSong.title, artist: currentSong.artist } : null
      const evaluatedPlayerId = game.buzz_winner_id

      if (result === 'CORRECT') {
        const resultKey = `${game.current_song_id || 'song'}_CORRECT`
        lastHostResultKeyRef.current = resultKey

        playCorrectFanfareSound()
        setFeedbackAnim('correct')
        setTimeout(() => setFeedbackAnim('none'), 1000)

        // Instant broadcast to all players (0ms WebSocket)
        broadcastHostAction(game.id, 'ANSWER_RESULT', {
          result: 'CORRECT',
          winnerId: game.buzz_winner_id,
          winnerName: currentBuzzWinner?.name || 'Pemain Lain',
          revealedSong: currentSongData,
        })
      } else {
        const nextAttemptNum = (game.current_attempt || 1) + 1
        const wrongKey = `${game.current_song_id || 'song'}_WRONG_${nextAttemptNum}`
        lastHostWrongKeyRef.current = wrongKey

        playWrongSound()
        setFeedbackAnim('wrong')
        setTimeout(() => setFeedbackAnim('none'), 800)

        // Instant broadcast to all players (0ms WebSocket) — barengan seperti CORRECT!
        broadcastHostAction(game.id, 'ANSWER_RESULT', {
          result: 'WRONG',
          wrongPlayerId: evaluatedPlayerId,
          winnerName: currentBuzzWinner?.name || 'Pemain Lain',
          nextAttempt: nextAttemptNum,
        })
      }

      setIsLoading(true)
      try {
        const res = await fetch(`/api/admin/${game.room_code}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-host-password': hostSession.hostPassword,
          },
          body: JSON.stringify({ result }),
        })
        const data = await res.json()

        // If special resolution (ALL_WRONG or DUEL_TURN_PASSED), broadcast the special resolution
        if (res.ok && result === 'WRONG') {
          if (data.allWrong) {
            broadcastHostAction(game.id, 'ANSWER_RESULT', {
              result: 'WRONG',
              allWrong: true,
              revealedSong: currentSongData,
              wrongPlayerId: data.wrongPlayerId || evaluatedPlayerId,
              winnerName: currentBuzzWinner?.name || 'Pemain Lain',
            })
          } else if (data.duelTurnPassed) {
            broadcastHostAction(game.id, 'ANSWER_RESULT', {
              result: 'WRONG',
              duelTurnPassed: true,
              nextPlayerId: data.nextPlayerId ?? null,
              revealedSong: currentSongData,
              wrongPlayerId: data.wrongPlayerId || evaluatedPlayerId,
              winnerName: currentBuzzWinner?.name || 'Pemain Lain',
            })
          }
        }
      } finally {
        setIsLoading(false)
      }
    },
    [game.room_code, hostSession.hostPassword, game.id, game.buzz_winner_id, game.current_attempt, game.current_song_id, players, currentSong]
  )

  if (!game || !game.room_code) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
        <div className="flex items-center gap-3">
          <div className="w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          <span className="text-sm text-slate-400">Sinkronisasi data game...</span>
        </div>
      </div>
    )
  }

  // ── Waiting Room ──────────────────────────────────────────────────
  if (game.status === 'LOBBY') {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        gameName={game.name}
        players={players}
        isHost={true}
        gameMode={gameMode}
        onSetGameMode={handleSetGameMode}
        onStartGame={() => hostAction('SET_GAME_STATUS', { status: 'ROUND_ACTIVE' })}
        isStarting={isLoading}
      />
    )
  }

  // ── Active Game Dashboard ─────────────────────────────────────────
  return (
    <div
      className={`min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-5 transition-all ${
        feedbackAnim === 'wrong'
          ? 'animate-shake animate-flash-red'
          : feedbackAnim === 'correct'
          ? 'animate-flash-green'
          : ''
      }`}
    >
      {/* Top Command Bar */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 shrink-0">
            <MicIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black text-xl tracking-tight">CG GUESS THE SONG</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                HOST CONSOLE
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Room Code: <span className="text-white font-mono font-bold tracking-widest text-sm bg-white/10 px-2 py-0.5 rounded-md ml-1">{game.room_code}</span>
            </p>
          </div>
        </div>

        {/* Right side controls: Mode Switcher + Round switch pills + Selesaikan Game */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Game Mode Switcher */}
          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => handleSetGameMode('CLASSIC')}
              disabled={isLoading}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'CLASSIC'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrophyIcon size={14} />
              <span>Klasik (FFA)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetGameMode('KNOCKOUT')}
              disabled={isLoading}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'KNOCKOUT'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SwordsIcon size={14} />
              <span>Babak Gugur (1v1)</span>
            </button>
          </div>

          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shrink-0">
            {(['GUESS', 'LYRICS'] as RoundType[]).map((r) => (
              <button
                key={r}
                onClick={() => hostAction('SET_ROUND', { round: r })}
                disabled={isLoading}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  game.current_round === r
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === 'GUESS' ? <MusicIcon size={14} /> : <MicIcon size={14} />}
                <span>{r === 'GUESS' ? 'Tebak Lagu' : 'Sambung Lirik'}</span>
              </button>
            ))}
          </div>

          {game.status === 'ROUND_COMPLETE' ? (
            <button
              type="button"
              onClick={() => hostAction('SET_GAME_STATUS', { status: 'ROUND_ACTIVE' })}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-2xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs sm:text-sm font-black transition-all active:scale-95 shadow-md shadow-emerald-500/25 flex items-center gap-2"
              title="Kembali ke gameplay aktif"
            >
              <MusicIcon size={14} />
              <span>Lanjutkan Permainan</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => hostAction('SET_GAME_STATUS', { status: 'ROUND_COMPLETE' })}
              disabled={isLoading}
              className="px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 text-xs sm:text-sm font-black transition-all active:scale-95 shadow-md shadow-amber-400/25 flex items-center gap-2"
              title="Tampilkan podium pemenang juara 1 dan leaderboard lengkap ke seluruh layar pemain"
            >
              <CrownIcon size={14} />
              <span>Umumkan Juara</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => setConfirmEndGame(true)}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
          >
            <TrashIcon size={14} />
            <span>Selesaikan Permainan</span>
          </button>
        </div>
      </div>

      {/* Spotify Connected Success Banner */}
      {spotifyConnectedBanner && (
        <div className="glass-panel rounded-2xl p-4 border border-emerald-500/50 bg-emerald-500/20 text-emerald-300 text-sm font-bold flex items-center justify-between gap-3 shadow-lg shadow-emerald-500/10 animate-in fade-in">
          <div className="flex items-center gap-2.5">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
            <span>Akun Spotify Anda berhasil terhubung! Web Playback SDK kini aktif.</span>
          </div>
          <button
            type="button"
            onClick={() => setSpotifyConnectedBanner(false)}
            className="text-xs bg-emerald-500/30 hover:bg-emerald-500/40 text-emerald-200 px-3 py-1 rounded-xl transition-colors"
          >
            Tutup
          </button>
        </div>
      )}

      {/* Confirmation Modal: End Game & Delete Room */}
      {confirmEndGame && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full border border-rose-500/40 bg-slate-950 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <TrashIcon size={26} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-white text-xl sm:text-2xl font-black tracking-tight">
                Selesaikan Permainan?
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Tindakan ini akan mengakhiri sesi untuk seluruh pemain dan menghapus seluruh data room, riwayat attempt, serta pemain dari Supabase secara permanen.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmEndGame(false)}
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-sm border border-white/10 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleEndGame}
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                {isLoading ? 'Menghapus...' : 'Ya, Selesaikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Stage & Duel Header Banner if Knockout Mode is on */}
      {gameMode === 'KNOCKOUT' && (
        <div className="glass-panel rounded-3xl p-5 border border-amber-400/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900/90 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/20 shrink-0">
              <SwordsIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-xs font-black uppercase tracking-wider">
                  {(() => {
                    const phase = tournamentState?.phase ?? (tournamentState?.stage === 'GROUP_B' ? 'GROUP_B' : tournamentState?.stage === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP_A')
                    if (phase === 'GROUP_A') return 'BABAK PENYISIHAN • GRUP A'
                    if (phase === 'GROUP_B') return 'BABAK PENYISIHAN • GRUP B'
                    if (phase === 'KNOCKOUT') {
                      return `${tournamentState?.matches?.find((m) => m.id === tournamentState.activeMatchId)?.roundName ?? 'Babak Gugur'} • LIVE DUEL`
                    }
                    return 'MODE TURNAMEN'
                  })()}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase border border-amber-400/30">
                  {(tournamentState?.phase ?? tournamentState?.stage) === 'KNOCKOUT' ? `TARGET: ${tournamentState?.targetPoints ?? 2} POIN (BO3)` : 'TOP 2 LOLOS'}
                </span>
              </div>
              <p className="text-white text-base sm:text-lg font-black mt-0.5">
                {(() => {
                  const phase = tournamentState?.phase ?? (tournamentState?.stage === 'GROUP_B' ? 'GROUP_B' : tournamentState?.stage === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP_A')
                  if (phase === 'GROUP_A') {
                    return `Hanya Grup A yang dapat menekan buzzer. Selesaikan 5–7 lagu untuk klasemen.`
                  }
                  if (phase === 'GROUP_B') {
                    return `Hanya Grup B yang dapat menekan buzzer. Selesaikan 5–7 lagu untuk klasemen.`
                  }
                  if (phase === 'KNOCKOUT') {
                    const am = tournamentState?.matches?.find((m) => m.id === tournamentState.activeMatchId)
                    if (!am || !am.player1Id || !am.player2Id) return 'Babak gugur BO3 aktif. Buka tab Bagan Turnamen untuk memilih duel.'
                    const p1 = players.find((p) => p.id === am.player1Id)
                    const p2 = players.find((p) => p.id === am.player2Id)
                    return `${p1?.name ?? 'P1'} (${am.player1Score}) VS ${p2?.name ?? 'P2'} (${am.player2Score})`
                  }
                  return 'Pemain dibagi ke Grup A & B. Mulai babak penyisihan untuk bertanding.'
                })()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTab('bracket')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === 'bracket' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <SwordsIcon size={14} />
            <span>Kelola Turnamen</span>
          </button>
        </div>
      )}

      {/* Main Command Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column: Music, Buzzer Controller & Tracklist (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Audio Player Deck */}
          <AudioPlayer
            audioUrl={currentSong?.audio_url ?? null}
            songTitle={currentSong?.title ?? null}
            songArtist={currentSong?.artist ?? null}
            buzzState={game.buzz_state}
            songId={effectiveSongId}
            roomCode={game.room_code}
            lastSongOutcome={tournamentState?.lastSongOutcome}
          />

          {/* Buzzer Console (Status Buzzer HP ditaruh di bawah pemutar lagu) */}
          <BuzzControlPanel
            buzzState={game.buzz_state}
            buzzWinner={buzzWinner}
            currentAttempt={game.current_attempt}
            onEnableBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'READY' })}
            onDisableBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'DISABLED' })}
            onResetBuzz={() => hostAction('RESET_BUZZ')}
            onCorrect={() => answerAction('CORRECT')}
            onWrong={() => answerAction('WRONG')}
            isLoading={isLoading}
          />

          {/* Next Song Action Banner */}
          {game.buzz_state === 'RESULT' && (
            <div
              className={`glass-panel rounded-3xl p-5 border shadow-lg flex items-center justify-between gap-4 animate-pulse ${
                tournamentState?.lastSongOutcome === 'ALL_WRONG'
                  ? 'border-rose-500/40 bg-rose-500/10 shadow-rose-950/40'
                  : 'border-emerald-500/40 bg-emerald-500/10 shadow-emerald-950/40'
              }`}
            >
              <div>
                <p
                  className={`font-bold text-sm ${
                    tournamentState?.lastSongOutcome === 'ALL_WRONG' ? 'text-rose-300' : 'text-emerald-300'
                  }`}
                >
                  {tournamentState?.lastSongOutcome === 'ALL_WRONG'
                    ? 'Kesempatan Menebak Habis!'
                    : 'Soal telah terjawab!'}
                </p>
                <p className="text-slate-300 text-xs">
                  {tournamentState?.lastSongOutcome === 'ALL_WRONG'
                    ? 'Semua pemain salah menebak lagu ini. Tidak ada pemain yang mendapat poin.'
                    : gameMode === 'KNOCKOUT'
                    ? 'Poin duel telah diperbarui di bagan turnamen.'
                    : 'Poin sudah masuk ke leaderboard.'}
                </p>
              </div>
              <button
                onClick={() => hostAction('NEXT_SONG')}
                disabled={isLoading}
                className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black px-6 py-3 rounded-2xl text-sm transition-all active:scale-95 shadow-lg shadow-emerald-400/20 shrink-0 flex items-center gap-2"
              >
                <span>LANJUT LAGU BERIKUTNYA</span>
                <ArrowRightIcon size={16} />
              </button>
            </div>
          )}

          {/* Tracklist Selector */}
          <SongSelector
            songs={songList}
            currentSongId={effectiveSongId}
            currentRound={game.current_round}
            playlists={playlists}
            activePlaylistId={activePlaylistId}
            onSelectPlaylist={setActivePlaylistId}
            onCreatePlaylist={handleCreatePlaylist}
            onDeletePlaylist={handleDeletePlaylist}
            onRenamePlaylist={handleRenamePlaylist}
            onSelectSong={(song) => {
              setOptimisticSongId(song.id)
              hostAction('SET_CURRENT_SONG', { songId: song.id })
            }}
            onChangeRound={(round) => hostAction('SET_ROUND', { round })}
            onOpenSpotifySearch={handleOpenSpotifySearch}
            onDeleteSong={handleDeleteSong}
            onRemoveSongFromPlaylist={handleRemoveSongFromPlaylist}
          />
        </div>

        {/* Right column: Players, Leaderboard & Tournament Tabs (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Players & Leaderboard & Tournament Tabs */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-xl">
            <div className="flex border-b border-white/5 bg-slate-900/60 p-1.5 gap-1">
              {gameMode === 'KNOCKOUT' && (
                <button
                  key="bracket"
                  onClick={() => setTab('bracket')}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'bracket'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SwordsIcon size={14} />
                  <span>Bagan (1v1)</span>
                </button>
              )}
              {(['players', 'leaderboard'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === t
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'players' ? <UsersIcon size={14} /> : <TrophyIcon size={14} />}
                  <span>{t === 'players' ? `Pemain (${players.length})` : 'Klasemen'}</span>
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === 'bracket' && gameMode === 'KNOCKOUT' && (
                <TournamentBracket
                  tournamentState={tournamentState}
                  players={players}
                  onSetTournamentPhase={handleSetTournamentPhase}
                  onSetActiveMatch={handleSetActiveMatch}
                  onAdvanceWinner={handleAdvanceWinner}
                  onGenerateBracket={handleGenerateBracket}
                  onShuffleGroups={handleShuffleGroups}
                  onStartGroupA={handleStartGroupA}
                  onStartGroupB={handleStartGroupB}
                  onResetTournament={handleResetTournament}
                  onSetQualifyCount={handleSetQualifyCount}
                  isLoading={isLoading}
                />
              )}
              {tab === 'players' && (
                <PlayerListPanel
                  players={players}
                  onUpdateScore={handleUpdateScore}
                  onResetAllScores={handleResetAllScores}
                  isLoading={isLoading}
                  playerViolations={playerViolations}
                />
              )}
              {tab === 'leaderboard' && (
                <Leaderboard players={players} />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Spotify Track Search Modal */}
      <SpotifySearchModal
        isOpen={isSpotifyModalOpen}
        onClose={() => setIsSpotifyModalOpen(false)}
        onSelectTrack={handleSelectSpotifyTrack}
        onAddToPlaylist={handleAddToPlaylist}
        existingSongUris={songList.map((s) => s.audio_url)}
        initialQuery={spotifyInitialQuery}
        targetPlaylistName={playlists.find((p) => p.id === activePlaylistId)?.name}
        isLoading={isLoading}
      />
    </div>
  )
}
