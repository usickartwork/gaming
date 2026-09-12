import type { Player } from '@/lib/types'

interface LeaderboardProps {
  players: Player[]
  highlightId?: string
}

export function Leaderboard({ players, highlightId }: LeaderboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-2.5">
      {sorted.map((player, i) => {
        const isUser = player.id === highlightId
        const isGold = i === 0
        const isSilver = i === 1
        const isBronze = i === 2

        return (
          <div
            key={player.id}
            className={`flex items-center justify-between px-4 py-3 rounded-2xl transition-all duration-300 border ${
              isUser
                ? 'ring-2 ring-emerald-400 bg-emerald-500/15 border-emerald-500/40 shadow-lg shadow-emerald-950/50'
                : isGold
                ? 'bg-gradient-to-r from-amber-500/20 via-slate-900/60 to-slate-900/90 border-amber-500/40 shadow-md shadow-amber-500/10'
                : isSilver
                ? 'bg-gradient-to-r from-slate-400/15 via-slate-900/60 to-slate-900/90 border-slate-400/30'
                : isBronze
                ? 'bg-gradient-to-r from-orange-600/15 via-slate-900/60 to-slate-900/90 border-orange-600/30'
                : 'bg-slate-900/60 border-white/5 text-slate-300'
            }`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-8 h-8 rounded-xl font-black font-mono flex items-center justify-center text-xs shrink-0 ${
                isGold
                  ? 'bg-amber-400 text-slate-950 shadow-sm shadow-amber-400/40'
                  : isSilver
                  ? 'bg-slate-300 text-slate-950'
                  : isBronze
                  ? 'bg-amber-700 text-amber-100'
                  : 'bg-slate-800/80 text-slate-400 border border-white/5'
              }`}>
                #{i + 1}
              </span>
              <div className="truncate">
                <p className={`text-base truncate font-bold ${isUser ? 'text-emerald-300' : isGold ? 'text-amber-200' : 'text-white'}`}>
                  {player.name}
                  {isUser && <span className="ml-2 text-xs text-emerald-400 font-semibold px-2 py-0.5 rounded-full bg-emerald-500/20">(Kamu)</span>}
                </p>
                {!player.connected && (
                  <span className="text-[10px] text-slate-500">offline</span>
                )}
              </div>
            </div>

            <div className="flex items-baseline gap-1 shrink-0 pl-3">
              <span className={`text-2xl font-black tabular-nums ${isGold ? 'text-amber-400' : isUser ? 'text-emerald-400' : 'text-white'}`}>
                {player.score}
              </span>
              <span className="text-xs text-slate-500 font-semibold">pts</span>
            </div>
          </div>
        )
      })}

      {players.length === 0 && (
        <p className="text-center text-slate-500 text-sm py-6">Belum ada skor tercatat</p>
      )}
    </div>
  )
}
