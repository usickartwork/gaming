'use client'

import type { Player } from '@/lib/types'

interface WaitingRoomProps {
  roomCode: string
  gameName: string
  players: Player[]
  isHost: boolean
  onStartGame?: () => void
  isStarting?: boolean
}

export function WaitingRoom({
  roomCode,
  gameName,
  players,
  isHost,
  onStartGame,
  isStarting,
}: WaitingRoomProps) {
  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex flex-col items-center justify-center p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <p className="text-purple-400 text-sm font-semibold tracking-widest uppercase mb-2">
          CG Guess The Song
        </p>
        <h1 className="text-white text-3xl font-bold mb-1">{gameName}</h1>
        <div className="inline-block bg-white/10 border border-white/20 rounded-2xl px-6 py-3 mt-4">
          <p className="text-purple-300 text-xs uppercase tracking-wider mb-1">Room Code</p>
          <p className="text-white text-5xl font-black tracking-[0.2em]">{roomCode}</p>
        </div>
      </div>

      {/* Players list */}
      <div className="w-full max-w-sm bg-white/5 rounded-2xl p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold">Players Joined</h2>
          <span className="text-purple-400 font-bold">{players.length}/20</span>
        </div>
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {players.map((p) => (
            <div key={p.id} className="flex items-center gap-2 py-1">
              <span className="text-green-400 text-xs">●</span>
              <span className="text-white">{p.name}</span>
            </div>
          ))}
          {players.length === 0 && (
            <p className="text-white/40 text-sm text-center py-4">
              Waiting for players to join...
            </p>
          )}
        </div>
      </div>

      {/* Action */}
      {isHost ? (
        <button
          onClick={onStartGame}
          disabled={players.length === 0 || isStarting}
          className="w-full max-w-sm bg-green-500 hover:bg-green-400 disabled:bg-white/20 disabled:cursor-not-allowed text-white text-xl font-bold py-5 rounded-2xl transition-all duration-200 active:scale-95"
        >
          {isStarting ? 'Starting...' : '▶ START GAME'}
        </button>
      ) : (
        <div className="text-center">
          <div className="animate-pulse">
            <div className="w-4 h-4 bg-green-400 rounded-full mx-auto mb-3" />
          </div>
          <p className="text-white/60">Waiting for host to start...</p>
        </div>
      )}
    </div>
  )
}
