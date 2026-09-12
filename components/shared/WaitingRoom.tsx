'use client'

import { UsersIcon, PlayIcon, SwordsIcon, TrophyIcon } from '@/components/shared/Icons'
import { getGameDisplayName } from '@/lib/tournament-utils'
import type { Player, GameMode } from '@/lib/types'

interface WaitingRoomProps {
  roomCode: string
  gameName: string
  players: Player[]
  isHost: boolean
  gameMode?: GameMode
  onSetGameMode?: (mode: GameMode) => void
  onStartGame?: () => void
  isStarting?: boolean
}

export function WaitingRoom({
  roomCode,
  gameName,
  players,
  isHost,
  gameMode = 'CLASSIC',
  onSetGameMode,
  onStartGame,
  isStarting,
}: WaitingRoomProps) {
  const displayName = getGameDisplayName(gameName)

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-5 sm:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/3 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[140px] pointer-events-none" />

      {/* Header */}
      <div className="text-center mb-6 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold uppercase tracking-widest mb-3">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          Lobi Permainan
        </div>
        <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight">{displayName}</h1>

        {/* Mode Selector in Lobby (Host Only) */}
        {isHost && onSetGameMode && (
          <div className="mt-4 inline-flex items-center gap-2 p-1.5 rounded-2xl bg-slate-900/90 border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={() => onSetGameMode('CLASSIC')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'CLASSIC'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrophyIcon size={14} />
              <span>Mode Bebas (Klasik)</span>
            </button>
            <button
              type="button"
              onClick={() => onSetGameMode('KNOCKOUT')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'KNOCKOUT'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SwordsIcon size={14} />
              <span>Babak Gugur (1v1)</span>
            </button>
          </div>
        )}

        {/* Mode Pill for Players */}
        {!isHost && (
          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-800 border border-white/10 text-xs text-slate-300 font-bold">
            {gameMode === 'KNOCKOUT' ? <SwordsIcon size={13} className="text-amber-400" /> : <TrophyIcon size={13} className="text-emerald-400" />}
            <span>Mode: {gameMode === 'KNOCKOUT' ? 'Babak Gugur (1v1 Duel)' : 'Mode Bebas (Klasik)'}</span>
          </div>
        )}
        
        {/* Room Code Glowing Card */}
        <div className="mt-5 inline-block glass-panel rounded-3xl p-5 sm:p-6 border border-emerald-500/30 shadow-xl shadow-emerald-950/40">
          <p className="text-slate-400 text-xs font-bold uppercase tracking-[0.2em] mb-1">
            BAGIKAN KODE ROOM KE PEMAIN
          </p>
          <p className="text-white text-5xl sm:text-6xl font-black tracking-[0.25em] font-mono select-all">
            {roomCode}
          </p>
        </div>
      </div>

      {/* Players list card */}
      <div className="w-full max-w-md glass-panel rounded-3xl p-5 mb-6 border border-white/10 shadow-2xl relative z-10">
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-white/5">
          <div className="flex items-center gap-2">
            <UsersIcon size={18} className="text-emerald-400" />
            <h2 className="text-white font-bold text-sm">Pemain Terhubung</h2>
          </div>
          <span className="px-2.5 py-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 font-bold text-xs">
            {players.length} / 20 Pemain
          </span>
        </div>

        <div className="grid grid-cols-2 gap-2 max-h-56 overflow-y-auto pr-1">
          {players.map((p, idx) => (
            <div
              key={p.id}
              className="flex items-center gap-2.5 bg-slate-900/80 border border-white/5 px-3 py-2.5 rounded-xl text-left"
            >
              <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0 shadow-sm shadow-emerald-400" />
              <span className="text-slate-200 text-sm font-semibold truncate">
                {p.name}
              </span>
            </div>
          ))}
          {players.length === 0 && (
            <div className="col-span-2 text-center py-8 text-slate-500 text-xs">
              Menunggu pemain memasukkan kode room...
            </div>
          )}
        </div>
      </div>

      {/* Action footer */}
      <div className="w-full max-w-md relative z-10">
        {isHost ? (
          <button
            onClick={onStartGame}
            disabled={players.length === 0 || isStarting}
            className="w-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 text-base font-black py-4 rounded-2xl transition-all shadow-xl shadow-emerald-500/25 active:scale-95 flex items-center justify-center gap-2"
          >
            <PlayIcon size={14} />
            <span>{isStarting ? 'MEMULAI GAME...' : 'MULAI GAME SEKARANG'}</span>
          </button>
        ) : (
          <div className="glass-panel rounded-2xl p-4 text-center border border-white/5">
            <div className="flex items-center justify-center gap-2 mb-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              <p className="text-white text-sm font-bold">Menunggu Host Memulai Game</p>
            </div>
            <p className="text-slate-400 text-xs">Siap-siap pegang tombol buzzer!</p>
          </div>
        )}
      </div>
    </div>
  )
}
