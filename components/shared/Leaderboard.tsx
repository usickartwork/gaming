import type { Player } from '@/lib/types'

interface LeaderboardProps {
  players: Player[]
  highlightId?: string
}

const MEDALS = ['🥇', '🥈', '🥉']

export function Leaderboard({ players, highlightId }: LeaderboardProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-2">
      {sorted.map((player, i) => (
        <div
          key={player.id}
          className={`flex items-center justify-between px-4 py-3 rounded-xl transition-all duration-500 ${
            player.id === highlightId
              ? 'bg-yellow-400 text-black font-bold scale-105'
              : 'bg-white/10 text-white'
          }`}
        >
          <div className="flex items-center gap-3">
            <span className="text-xl w-8 text-center">
              {i < 3 ? MEDALS[i] : `${i + 1}.`}
            </span>
            <span className="text-lg truncate max-w-[160px]">{player.name}</span>
            {!player.connected && (
              <span className="text-xs opacity-50">(offline)</span>
            )}
          </div>
          <span className="text-2xl font-bold tabular-nums">{player.score}</span>
        </div>
      ))}
      {players.length === 0 && (
        <p className="text-center text-white/40 py-4">No players yet</p>
      )}
    </div>
  )
}
