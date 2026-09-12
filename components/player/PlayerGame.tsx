'use client'

import { useState, useEffect } from 'react'
import { useGameState } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { usePresence } from '@/lib/hooks/usePresence'
import { playDingSound } from '@/lib/audio'
import { BuzzButton } from './BuzzButton'
import { Leaderboard } from '@/components/shared/Leaderboard'
import { WaitingRoom } from '@/components/shared/WaitingRoom'
import type { Game, Player, PlayerSession } from '@/lib/types'

interface PlayerGameProps {
  initialGame: Game
  initialPlayers: Player[]
  session: PlayerSession
}

export function PlayerGame({ initialGame, initialPlayers, session }: PlayerGameProps) {
  const game = useGameState(initialGame.id, initialGame)
  const players = usePlayers(initialGame.id, initialPlayers)

  const [isBuzzing, setIsBuzzing] = useState(false)
  const [localWinner, setLocalWinner] = useState<boolean | null>(null)
  const [localWinnerName, setLocalWinnerName] = useState<string | null>(null)

  // Reset local state when host enables buzz again
  useEffect(() => {
    if (game.buzz_state === 'READY' && game.buzz_winner_id === null) {
      setLocalWinner(null)
      setLocalWinnerName(null)
      setIsBuzzing(false)
    }
  }, [game.buzz_state, game.buzz_winner_id])

  // Track online presence
  usePresence(initialGame.id, session.playerId, session.playerName, session.sessionToken)

  const me = players.find((p) => p.id === session.playerId)
  const isWinner = localWinner === true || game.buzz_winner_id === session.playerId
  const isExcluded = me?.excluded_attempt === game.current_attempt
  const buzzWinnerPlayer = players.find((p) => p.id === game.buzz_winner_id)

  const handleBuzz = async () => {
    if (isBuzzing) return
    setIsBuzzing(true)

    try {
      const res = await fetch(`/api/admin/${game.room_code}/buzz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': session.sessionToken,
        },
        body: JSON.stringify({ playerId: session.playerId }),
      })
      const data = await res.json()
      if (data.winner) {
        setLocalWinner(true)
        playDingSound()
      } else if (data.winnerId) {
        setLocalWinner(false)
        setLocalWinnerName(data.winnerName || 'Someone')
      }
    } catch (err) {
      console.error('Buzz error:', err)
    } finally {
      setIsBuzzing(false)
    }
  }

  // ── Waiting Room ─────────────────────────────────────────────────
  if (game.status === 'LOBBY') {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        gameName={game.name}
        players={players}
        isHost={false}
      />
    )
  }

  // ── LOCKED: This player won ─────────────────────────────────────
  if ((game.buzz_state === 'LOCKED' || game.buzz_state === 'ANSWERING') && isWinner) {
    return (
      <div className="min-h-screen bg-green-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="animate-bounce text-8xl mb-6">🔴</div>
        <h1 className="text-white text-4xl font-black mb-2">YOU BUZZED FIRST!</h1>
        <p className="text-green-300 text-2xl font-bold mb-8">YOUR TURN 🎤</p>
        <p className="text-green-400/60 text-sm">Jawab secara lisan</p>
        <div className="mt-8 bg-white/10 rounded-2xl px-6 py-3">
          <p className="text-green-300 text-sm">Score</p>
          <p className="text-white text-3xl font-black">{me?.score ?? 0}</p>
        </div>
      </div>
    )
  }

  // ── LOCKED: Someone else won ────────────────────────────────────
  if ((localWinner === false || game.buzz_state === 'LOCKED' || game.buzz_state === 'ANSWERING') && !isWinner) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="text-8xl mb-6">🔒</div>
        <h1 className="text-white text-3xl font-black mb-2">LOCKED</h1>
        <p className="text-white/60 text-lg mb-8">
          {localWinnerName || buzzWinnerPlayer?.name || 'Someone'} buzzed first.
        </p>
        <div className="bg-white/10 rounded-2xl px-6 py-3">
          <p className="text-white/50 text-sm">Score kamu</p>
          <p className="text-white text-3xl font-black">{me?.score ?? 0}</p>
        </div>
      </div>
    )
  }

  // ── RESULT state ────────────────────────────────────────────────
  if (game.buzz_state === 'RESULT') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex flex-col items-center justify-center p-6">
        <h2 className="text-purple-300 text-xl font-bold mb-6 tracking-wider">🏆 LEADERBOARD</h2>
        <div className="w-full max-w-sm">
          <Leaderboard players={players} highlightId={session.playerId} />
        </div>
        <p className="text-white/30 text-sm mt-8 animate-pulse">Menunggu lagu berikutnya...</p>
      </div>
    )
  }

  // ── Active game: DISABLED or READY ─────────────────────────────
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4">
        <div>
          <p className="text-purple-400 text-xs uppercase tracking-wider">CG Guess The Song</p>
          <p className="text-white font-bold">{session.playerName}</p>
        </div>
        <div className="text-right">
          <p className="text-white/50 text-xs">Score</p>
          <p className="text-white text-2xl font-black">{me?.score ?? 0}</p>
        </div>
      </div>

      {/* Round badge */}
      <div className="text-center py-2">
        <span className="bg-purple-800/50 text-purple-300 text-xs px-3 py-1 rounded-full">
          {game.current_round === 'GUESS' ? '🎵 Guess The Song' : '🎤 Sambung Lirik'}
          {' '}· Attempt #{game.current_attempt}
        </span>
      </div>

      {/* Main buzz area */}
      <div className="flex-1 flex flex-col items-center justify-center p-6">
        <BuzzButton
          buzzState={game.buzz_state}
          isWinner={isWinner}
          onBuzz={handleBuzz}
          isExcluded={isExcluded}
          isBuzzing={isBuzzing}
        />
      </div>

      {/* Bottom: mini leaderboard */}
      <div className="p-4 pb-8">
        <p className="text-white/30 text-xs text-center uppercase tracking-wider mb-3">Top 3</p>
        <div className="space-y-1">
          {[...players]
            .sort((a, b) => b.score - a.score)
            .slice(0, 3)
            .map((p, i) => (
              <div
                key={p.id}
                className={`flex justify-between px-3 py-2 rounded-lg ${
                  p.id === session.playerId ? 'bg-purple-800/50' : 'bg-white/5'
                }`}
              >
                <span className="text-white/80 text-sm">
                  {['🥇', '🥈', '🥉'][i]} {p.name}
                </span>
                <span className="text-white font-bold text-sm">{p.score}</span>
              </div>
            ))}
        </div>
      </div>
    </div>
  )
}
