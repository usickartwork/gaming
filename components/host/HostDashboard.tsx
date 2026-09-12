'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useGameState } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { playDingSound } from '@/lib/audio'
import {
  MicIcon,
  MusicIcon,
  UsersIcon,
  TrophyIcon,
  ArrowRightIcon,
} from '@/components/shared/Icons'
import { AudioPlayer } from './AudioPlayer'
import { BuzzControlPanel } from './BuzzControlPanel'
import { SongSelector } from './SongSelector'
import { PlayerListPanel } from './PlayerListPanel'
import { Leaderboard } from '@/components/shared/Leaderboard'
import { WaitingRoom } from '@/components/shared/WaitingRoom'
import type { Game, Player, Song, RoundType, HostSession } from '@/lib/types'

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
  const game = useGameState(initialGame.id, initialGame)
  const players = usePlayers(initialGame.id, initialPlayers)
  const [isLoading, setIsLoading] = useState(false)
  const [tab, setTab] = useState<'players' | 'leaderboard'>('players')

  const currentSong = songs.find((s) => s.id === game.current_song_id) ?? null
  const buzzWinner = players.find((p) => p.id === game.buzz_winner_id) ?? null

  // Play sound when someone buzzes in
  const lastWinnerRef = useRef<string | null>(null)
  useEffect(() => {
    if (game.buzz_winner_id && game.buzz_winner_id !== lastWinnerRef.current) {
      playDingSound()
    }
    lastWinnerRef.current = game.buzz_winner_id
  }, [game.buzz_winner_id])

  // ── Host API helper ──────────────────────────────────────────────
  const hostAction = useCallback(
    async (action: string, payload?: object) => {
      setIsLoading(true)
      try {
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
    [game.room_code, hostSession.hostPassword]
  )

  const answerAction = useCallback(
    async (result: 'CORRECT' | 'WRONG') => {
      setIsLoading(true)
      try {
        await fetch(`/api/admin/${game.room_code}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-host-password': hostSession.hostPassword,
          },
          body: JSON.stringify({ result }),
        })
      } finally {
        setIsLoading(false)
      }
    },
    [game.room_code, hostSession.hostPassword]
  )

  // ── Waiting Room ──────────────────────────────────────────────────
  if (game.status === 'LOBBY') {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        gameName={game.name}
        players={players}
        isHost={true}
        onStartGame={() => hostAction('SET_GAME_STATUS', { status: 'ROUND_ACTIVE' })}
        isStarting={isLoading}
      />
    )
  }

  // ── Active Game Dashboard ─────────────────────────────────────────
  return (
    <div className="min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-5">
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

        {/* Round switch pills */}
        <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shrink-0">
          {(['GUESS', 'LYRICS'] as RoundType[]).map((r) => (
            <button
              key={r}
              onClick={() => hostAction('SET_ROUND', { round: r })}
              disabled={isLoading}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                game.current_round === r
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {r === 'GUESS' ? <MusicIcon size={14} /> : <MicIcon size={14} />}
              <span>{r === 'GUESS' ? 'Round 1: Tebak Lagu' : 'Round 2: Sambung Lirik'}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Command Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column: Music & Tracklist (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Audio Player Deck */}
          <AudioPlayer
            audioUrl={currentSong?.audio_url ?? null}
            songTitle={currentSong?.title ?? null}
            songArtist={currentSong?.artist ?? null}
          />

          {/* Next Song Action Banner */}
          {game.buzz_state === 'RESULT' && (
            <div className="glass-panel rounded-3xl p-5 border border-emerald-500/40 bg-emerald-500/10 shadow-lg shadow-emerald-950/40 flex items-center justify-between gap-4 animate-pulse">
              <div>
                <p className="text-emerald-300 font-bold text-sm">Soal telah terjawab!</p>
                <p className="text-slate-300 text-xs">Poin sudah masuk ke leaderboard.</p>
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
            songs={songs}
            currentSongId={game.current_song_id}
            currentRound={game.current_round}
            onSelectSong={(song) => hostAction('SET_CURRENT_SONG', { songId: song.id })}
            onChangeRound={(round) => hostAction('SET_ROUND', { round })}
          />
        </div>

        {/* Right column: Buzzer Controller & Leaderboard (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Buzzer Console */}
          <BuzzControlPanel
            buzzState={game.buzz_state}
            buzzWinner={buzzWinner}
            currentAttempt={game.current_attempt}
            onEnableBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'READY' })}
            onDisableBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'DISABLED' })}
            onResetBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'READY' })}
            onCorrect={() => answerAction('CORRECT')}
            onWrong={() => answerAction('WRONG')}
            isLoading={isLoading}
          />

          {/* Players & Leaderboard Tabs */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-xl">
            <div className="flex border-b border-white/5 bg-slate-900/60 p-1.5">
              {(['players', 'leaderboard'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-2 ${
                    tab === t
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'players' ? <UsersIcon size={16} /> : <TrophyIcon size={16} />}
                  <span>{t === 'players' ? `Pemain (${players.length})` : 'Klasemen Skor'}</span>
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === 'players' ? (
                <PlayerListPanel players={players} />
              ) : (
                <Leaderboard players={players} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
