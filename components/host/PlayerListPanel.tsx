import type { Player } from '@/lib/types'

interface PlayerListPanelProps {
  players: Player[]
}

export function PlayerListPanel({ players }: PlayerListPanelProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Nama Pemain</span>
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Skor</span>
      </div>
      <div className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between px-3.5 py-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-all"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  p.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'
                }`}
                title={p.connected ? 'Online' : 'Offline'}
              />
              <span className="text-xs text-slate-500 font-mono font-bold w-4">{i + 1}.</span>
              <span className="text-sm text-slate-200 font-semibold truncate">{p.name}</span>
            </div>
            <span className="text-white font-mono font-black text-sm px-2.5 py-0.5 rounded-md bg-white/5 border border-white/5">
              {p.score}
            </span>
          </div>
        ))}
        {players.length === 0 && (
          <p className="text-slate-500 text-center py-6 text-xs">Belum ada pemain bergabung di room ini.</p>
        )}
      </div>
    </div>
  )
}
