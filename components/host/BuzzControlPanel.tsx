'use client'

import {
  CheckIcon,
  CrossIcon,
  LockIcon,
  RefreshIcon,
  MicIcon,
  LightningIcon,
} from '@/components/shared/Icons'
import type { BuzzState, Player } from '@/lib/types'

interface BuzzControlPanelProps {
  buzzState: BuzzState
  buzzWinner: Player | null
  currentAttempt: number
  onEnableBuzz: () => void
  onDisableBuzz: () => void
  onResetBuzz: () => void
  onCorrect: () => void
  onWrong: () => void
  isLoading?: boolean
}

const ATTEMPT_POINTS = [
  { attempt: 1, correct: 10, wrong: -3 },
  { attempt: 2, correct: 7, wrong: -2 },
  { attempt: 3, correct: 5, wrong: 0 },
]

const BUZZ_STATE_LABELS: Record<BuzzState, { label: string; badgeClass: string }> = {
  DISABLED: { label: 'Buzzer Dikunci', badgeClass: 'bg-slate-800 text-slate-400 border-slate-700' },
  READY:    { label: 'Buzzer Siap Dipencet', badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 animate-pulse' },
  LOCKED:   { label: 'Pemain Memencet', badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40' },
  ANSWERING:{ label: 'Sedang Menjawab', badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40' },
  RESULT:   { label: 'Hasil Dinilai', badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40' },
}

export function BuzzControlPanel({
  buzzState,
  buzzWinner,
  currentAttempt,
  onEnableBuzz,
  onDisableBuzz,
  onResetBuzz,
  onCorrect,
  onWrong,
  isLoading,
}: BuzzControlPanelProps) {
  const pts = ATTEMPT_POINTS.find((p) => p.attempt === currentAttempt) ?? ATTEMPT_POINTS[0]
  const stateInfo = BUZZ_STATE_LABELS[buzzState]

  return (
    <div className="space-y-4">
      {/* State controller card */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex items-center justify-between">
          <span className="text-slate-400 text-xs font-bold uppercase tracking-wider">Status Buzzer HP</span>
          <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider border ${stateInfo.badgeClass}`}>
            {stateInfo.label}
          </span>
        </div>

        {/* Master Buzzer Action Buttons */}
        <div className="flex gap-2">
          <button
            onClick={onEnableBuzz}
            disabled={buzzState === 'READY' || isLoading}
            className="flex-1 bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 disabled:opacity-30 disabled:cursor-not-allowed text-slate-950 font-black py-3.5 rounded-2xl transition-all shadow-md shadow-emerald-500/15 active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-1.5"
          >
            <CheckIcon size={16} />
            <span>BUKA BUZZER</span>
          </button>
          <button
            onClick={onDisableBuzz}
            disabled={buzzState === 'DISABLED' || isLoading}
            className="flex-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-30 disabled:cursor-not-allowed text-slate-300 hover:text-white font-bold py-3.5 rounded-2xl border border-white/5 transition-all active:scale-95 text-xs sm:text-sm flex items-center justify-center gap-1.5"
          >
            <LockIcon size={14} />
            <span>KUNCI</span>
          </button>
          <button
            onClick={onResetBuzz}
            disabled={isLoading}
            className="bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white font-bold py-3.5 px-4 rounded-2xl border border-white/10 transition-all active:scale-95 text-xs sm:text-sm flex items-center justify-center"
            title="Reset ulang ke READY"
          >
            <RefreshIcon size={14} />
          </button>
        </div>
      </div>

      {/* First buzz spotlight */}
      {buzzWinner ? (
        <div className="glass-panel rounded-3xl p-6 border border-rose-500/50 bg-gradient-to-b from-rose-950/40 via-slate-900/90 to-slate-900/90 shadow-2xl shadow-rose-950/50 space-y-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-xs font-extrabold uppercase tracking-widest border border-rose-500/30 animate-pulse">
              <LightningIcon size={12} />
              <span>FIRST TO BUZZ</span>
            </span>
            <span className="text-xs text-slate-400 font-medium">
              Attempt <strong className="text-white font-bold">#{currentAttempt}</strong>
            </span>
          </div>

          <div>
            <p className="text-white text-3xl sm:text-4xl font-black tracking-tight flex items-center gap-2">
              <MicIcon size={26} className="text-rose-400 shrink-0" />
              <span>{buzzWinner.name.toUpperCase()}</span>
            </p>
            <p className="text-slate-400 text-xs mt-1">
              Skor saat ini: <span className="text-amber-400 font-bold">{buzzWinner.score} poin</span>
            </p>
          </div>

          <div className="bg-slate-900/90 border border-white/5 rounded-2xl p-3 text-xs flex justify-around text-slate-300 font-medium">
            <span>Benar: <strong className="text-emerald-400">+{pts.correct} poin</strong></span>
            <span className="text-slate-600">|</span>
            <span>Salah: <strong className="text-rose-400">{pts.wrong} poin</strong></span>
          </div>

          {/* Answer Judgement Buttons */}
          <div className="grid grid-cols-2 gap-3 pt-1">
            <button
              onClick={onCorrect}
              disabled={isLoading}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 py-4 px-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-emerald-500/20 flex flex-col items-center justify-center font-black"
            >
              <span className="text-base sm:text-lg flex items-center gap-1.5">
                <CheckIcon size={20} />
                <span>BENAR</span>
              </span>
              <span className="text-xs opacity-80 font-bold">+{pts.correct} POIN</span>
            </button>
            <button
              onClick={onWrong}
              disabled={isLoading}
              className="bg-gradient-to-r from-rose-600 to-red-700 hover:from-rose-500 hover:to-red-600 disabled:opacity-40 text-white py-4 px-4 rounded-2xl transition-all active:scale-95 shadow-lg shadow-rose-600/20 flex flex-col items-center justify-center font-black"
            >
              <span className="text-base sm:text-lg flex items-center gap-1.5">
                <CrossIcon size={20} />
                <span>SALAH</span>
              </span>
              <span className="text-xs opacity-80 font-bold">{pts.wrong} POIN</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="glass-panel rounded-3xl p-8 border border-white/5 text-center space-y-2">
          <div className="w-10 h-10 rounded-2xl bg-slate-800/80 border border-white/5 flex items-center justify-center mx-auto text-slate-400">
            {buzzState === 'READY' ? <LightningIcon size={20} className="text-emerald-400" /> : <LockIcon size={18} />}
          </div>
          <p className="text-slate-300 font-bold text-sm">
            {buzzState === 'READY' ? 'Buzzer Aktif: Menunggu pemain menekan!' : 'Buzzer belum dibuka oleh host.'}
          </p>
          <p className="text-slate-500 text-xs">
            {buzzState === 'READY' ? 'Siapa cepat dia dapat giliran menjawab.' : 'Klik "BUKA BUZZER" di atas jika lagu sudah siap ditebak.'}
          </p>
        </div>
      )}
    </div>
  )
}
