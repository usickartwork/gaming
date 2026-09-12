import type { Player } from '@/lib/types'

interface PlayerListPanelProps {
  players: Player[]
}

export function PlayerListPanel({ players }: PlayerListPanelProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="bg-white/5 rounded-2xl p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-semibold">Players</h3>
        <span className="text-purple-400 text-sm font-bold">{players.length} joined</span>
      </div>
      <div className="space-y-1 max-h-64 overflow-y-auto">
        {sorted.map((p, i) => (
          <div key={p.id} className="flex items-center justify-between py-2 border-b border-white/5 last:border-0">
            <div className="flex items-center gap-2">
              <span className={`text-xs ${p.connected ? 'text-green-400' : 'text-white/30'}`}>
                {p.connected ? '●' : '○'}
              </span>
              <span className="text-sm text-white/80">{i + 1}. {p.name}</span>
            </div>
            <span className="text-white font-bold">{p.score}</span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-white/40 text-center py-4 text-sm">No players joined</p>
        )}
      </div>
    </div>
  )
}
