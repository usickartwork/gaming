'use client'

import { useState } from 'react'
import type { Player } from '@/lib/types'
import { PlusIcon, MinusIcon, EditIcon, RefreshIcon, CheckIcon, CrossIcon } from '@/components/shared/Icons'

interface PlayerListPanelProps {
  players: Player[]
  onUpdateScore?: (playerId: string, newScore: number) => Promise<void>
  onResetAllScores?: () => Promise<void>
  isLoading?: boolean
}

export function PlayerListPanel({
  players,
  onUpdateScore,
  onResetAllScores,
  isLoading,
}: PlayerListPanelProps) {
  const sorted = [...players].sort((a, b) => b.score - a.score)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState<string>('')
  const [confirmReset, setConfirmReset] = useState(false)

  const handleStartEdit = (p: Player) => {
    setEditingId(p.id)
    setEditValue(String(p.score))
  }

  const handleSaveEdit = async (playerId: string) => {
    const num = parseInt(editValue, 10)
    if (!isNaN(num) && onUpdateScore) {
      await onUpdateScore(playerId, Math.max(0, num))
    }
    setEditingId(null)
  }

  const handleAdjustScore = async (playerId: string, currentScore: number, delta: number) => {
    if (onUpdateScore) {
      await onUpdateScore(playerId, Math.max(0, currentScore + delta))
    }
  }

  const handleResetAll = async () => {
    if (onResetAllScores) {
      await onResetAllScores()
    }
    setConfirmReset(false)
  }

  return (
    <div className="space-y-3">
      {/* Header bar with Reset All button */}
      <div className="flex items-center justify-between pb-2 border-b border-white/5">
        <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">
          Pemain ({players.length})
        </span>

        {players.length > 0 && onResetAllScores && (
          <div>
            {!confirmReset ? (
              <button
                type="button"
                onClick={() => setConfirmReset(true)}
                disabled={isLoading}
                className="inline-flex items-center gap-1 text-[11px] font-bold text-slate-400 hover:text-rose-400 transition-colors py-1 px-2.5 rounded-lg bg-white/5 hover:bg-rose-500/10 active:scale-95"
              >
                <RefreshIcon size={12} />
                <span>Reset Semua Poin</span>
              </button>
            ) : (
              <div className="flex items-center gap-1 bg-rose-950/80 border border-rose-500/40 px-2 py-0.5 rounded-lg text-xs">
                <span className="text-[10px] text-rose-300 font-bold mr-1">Yakin reset?</span>
                <button
                  type="button"
                  onClick={handleResetAll}
                  disabled={isLoading}
                  className="px-1.5 py-0.5 rounded bg-rose-500 text-slate-950 font-black text-[10px] hover:bg-rose-400"
                >
                  Ya
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmReset(false)}
                  className="px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] hover:text-white"
                >
                  Batal
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Players List with Quick Adjusters & Inline Edit */}
      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
        {sorted.map((p, i) => (
          <div
            key={p.id}
            className="flex items-center justify-between p-2.5 rounded-xl bg-slate-900/60 border border-white/5 hover:border-white/10 transition-all gap-2"
          >
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  p.connected ? 'bg-emerald-400 shadow-sm shadow-emerald-400' : 'bg-slate-600'
                }`}
                title={p.connected ? 'Online' : 'Offline'}
              />
              <span className="text-xs text-slate-500 font-mono font-bold w-4 shrink-0">{i + 1}.</span>
              <span className="text-sm text-slate-200 font-bold truncate">{p.name}</span>
            </div>

            {/* Score Controls */}
            {editingId === p.id ? (
              <div className="flex items-center gap-1 shrink-0">
                <input
                  type="number"
                  value={editValue}
                  onChange={(e) => setEditValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveEdit(p.id)
                    if (e.key === 'Escape') setEditingId(null)
                  }}
                  autoFocus
                  className="w-16 px-1.5 py-1 text-center bg-slate-950 border border-emerald-400 rounded-lg text-white font-mono font-bold text-xs outline-none"
                />
                <button
                  type="button"
                  onClick={() => handleSaveEdit(p.id)}
                  className="p-1 rounded-md bg-emerald-500 text-slate-950 hover:bg-emerald-400"
                  title="Simpan"
                >
                  <CheckIcon size={12} />
                </button>
                <button
                  type="button"
                  onClick={() => setEditingId(null)}
                  className="p-1 rounded-md bg-slate-800 text-slate-400 hover:text-white"
                  title="Batal"
                >
                  <CrossIcon size={12} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-1 shrink-0">
                {onUpdateScore && (
                  <button
                    type="button"
                    onClick={() => handleAdjustScore(p.id, p.score, -1)}
                    disabled={isLoading || p.score <= 0}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 disabled:opacity-30 flex items-center justify-center transition-colors"
                    title="-1 Poin"
                  >
                    <MinusIcon size={12} />
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleStartEdit(p)}
                  className="group flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-xs"
                  title="Klik untuk ubah skor"
                >
                  <span className="text-emerald-400 font-mono font-black">{p.score}</span>
                  <EditIcon size={10} className="text-slate-500 group-hover:text-slate-300" />
                </button>

                {onUpdateScore && (
                  <button
                    type="button"
                    onClick={() => handleAdjustScore(p.id, p.score, 1)}
                    disabled={isLoading}
                    className="w-6 h-6 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-400 hover:text-emerald-300 disabled:opacity-30 flex items-center justify-center transition-colors"
                    title="+1 Poin"
                  >
                    <PlusIcon size={12} />
                  </button>
                )}
              </div>
            )}
          </div>
        ))}

        {players.length === 0 && (
          <p className="text-slate-500 text-center py-6 text-xs">Belum ada pemain bergabung di room ini.</p>
        )}
      </div>
    </div>
  )
}
