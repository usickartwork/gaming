'use client'

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

const BUZZ_STATE_LABELS: Record<BuzzState, { label: string; color: string }> = {
  DISABLED: { label: '⚫ DISABLED', color: 'text-white/40' },
  READY:    { label: '🟢 READY', color: 'text-green-400' },
  LOCKED:   { label: '🔴 LOCKED', color: 'text-red-400' },
  ANSWERING:{ label: '🎤 ANSWERING', color: 'text-yellow-400' },
  RESULT:   { label: '✅ RESULT', color: 'text-blue-400' },
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
      {/* State display */}
      <div className="bg-white/5 rounded-2xl p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="text-white/60 text-sm uppercase tracking-wider">Buzz State</span>
          <span className={`font-bold text-lg ${stateInfo.color}`}>{stateInfo.label}</span>
        </div>

        <div className="flex gap-2">
          <button
            onClick={onEnableBuzz}
            disabled={buzzState === 'READY' || isLoading}
            className="flex-1 bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm"
          >
            ENABLE BUZZ
          </button>
          <button
            onClick={onDisableBuzz}
            disabled={buzzState === 'DISABLED' || isLoading}
            className="flex-1 bg-gray-600 hover:bg-gray-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm"
          >
            DISABLE
          </button>
          <button
            onClick={onResetBuzz}
            disabled={isLoading}
            className="bg-white/10 hover:bg-white/20 text-white font-bold py-3 px-4 rounded-xl transition-all active:scale-95 text-sm"
          >
            RESET
          </button>
        </div>
      </div>

      {/* First buzz winner */}
      {buzzWinner ? (
        <div className="bg-red-950 border border-red-500 rounded-2xl p-4">
          <p className="text-red-300 text-xs uppercase tracking-wider mb-1">First Buzz</p>
          <p className="text-white text-3xl font-black">🔴 {buzzWinner.name.toUpperCase()}</p>
          <p className="text-white/40 text-xs mt-1">Score: {buzzWinner.score}</p>

          <div className="mt-3 text-xs text-white/50">
            Attempt #{currentAttempt} — Correct: +{pts.correct} | Wrong: {pts.wrong === 0 ? '0' : pts.wrong}
          </div>

          {/* Answer buttons */}
          <div className="flex gap-3 mt-4">
            <button
              onClick={onCorrect}
              disabled={isLoading}
              className="flex-1 bg-green-500 hover:bg-green-400 disabled:opacity-40 text-white text-xl font-black py-4 rounded-xl transition-all active:scale-95"
            >
              ✅ CORRECT
              <div className="text-sm font-normal">+{pts.correct} pts</div>
            </button>
            <button
              onClick={onWrong}
              disabled={isLoading}
              className="flex-1 bg-red-600 hover:bg-red-500 disabled:opacity-40 text-white text-xl font-black py-4 rounded-xl transition-all active:scale-95"
            >
              ❌ WRONG
              <div className="text-sm font-normal">{pts.wrong === 0 ? '0' : pts.wrong} pts</div>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white/5 rounded-2xl p-4 text-center text-white/40">
          {buzzState === 'READY' ? 'Waiting for a buzz...' : 'Enable buzz to start'}
        </div>
      )}
    </div>
  )
}
