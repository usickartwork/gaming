'use client'

import { useState, useCallback } from 'react'
import { useGameState } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
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
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-white font-black text-xl">CG GUESS THE SONG</h1>
          <p className="text-purple-400 text-sm">Room: {game.room_code} · {game.status}</p>
        </div>
        <div className="bg-white/10 rounded-xl px-3 py-2 text-center">
          <p className="text-white/50 text-xs">Round</p>
          <p className="text-white font-bold">{game.current_round}</p>
        </div>
      </div>

      {/* Round switcher */}
      <div className="flex gap-2 mb-4">
        {(['GUESS', 'LYRICS'] as RoundType[]).map((r) => (
          <button
            key={r}
            onClick={() => hostAction('SET_ROUND', { round: r })}
            disabled={isLoading}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              game.current_round === r
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {r === 'GUESS' ? '🎵 Round 1' : '🎤 Round 2'}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left column */}
        <div className="space-y-4">
          {/* Song Selector */}
          <SongSelector
            songs={songs}
            currentSongId={game.current_song_id}
            currentRound={game.current_round}
            onSelectSong={(song) => hostAction('SET_CURRENT_SONG', { songId: song.id })}
            onChangeRound={(round) => hostAction('SET_ROUND', { round })}
          />

          {/* Audio Player */}
          <AudioPlayer
            audioUrl={currentSong?.audio_url ?? null}
            songTitle={currentSong?.title ?? null}
            songArtist={currentSong?.artist ?? null}
          />

          {/* Next Song button */}
          {game.buzz_state === 'RESULT' && (
            <button
              onClick={() => hostAction('NEXT_SONG')}
              disabled={isLoading}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all active:scale-95"
            >
              ▶▶ NEXT SONG
            </button>
          )}
        </div>

        {/* Right column */}
        <div className="space-y-4">
          {/* Buzz Control */}
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

          {/* Players / Leaderboard tabs */}
          <div className="bg-white/5 rounded-2xl overflow-hidden">
            <div className="flex">
              {(['players', 'leaderboard'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-3 text-sm font-bold capitalize transition-all ${
                    tab === t ? 'bg-white/10 text-white' : 'text-white/40 hover:text-white/70'
                  }`}
                >
                  {t === 'players' ? '👥 Players' : '🏆 Leaderboard'}
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
