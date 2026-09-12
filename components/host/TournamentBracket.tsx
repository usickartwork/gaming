'use client'

import React, { useState } from 'react'
import {
  TrophyIcon,
  CrownIcon,
  SwordsIcon,
  CheckIcon,
  RefreshIcon,
  PlayIcon,
  UsersIcon,
  ArrowRightIcon,
  AlertIcon,
} from '@/components/shared/Icons'
import type { Player, TournamentMatch, TournamentState, TournamentStage } from '@/lib/types'

interface TournamentBracketProps {
  tournamentState: TournamentState | null
  players: Player[]
  onSetActiveMatch: (matchId: string) => void
  onAdvanceWinner: (matchId: string, winnerId: string) => void
  onGenerateBracket: (targetPoints: number) => void
  onShuffleGroups?: () => void
  onStartGroupA?: () => void
  onFinishGroupA?: () => void
  onStartGroupB?: () => void
  onFinishGroupB?: () => void
  onResetTournament: () => void
  isLoading?: boolean
}

export function TournamentBracket({
  tournamentState,
  players,
  onSetActiveMatch,
  onAdvanceWinner,
  onGenerateBracket,
  onShuffleGroups,
  onStartGroupA,
  onFinishGroupA,
  onStartGroupB,
  onFinishGroupB,
  onResetTournament,
  isLoading = false,
}: TournamentBracketProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const [confirmFinishA, setConfirmFinishA] = useState(false)
  const [confirmFinishB, setConfirmFinishB] = useState(false)

  const getPlayer = (id: string | null): Player | undefined => {
    if (!id) return undefined
    return players.find((p) => p.id === id)
  }

  const champion = getPlayer(tournamentState?.championId ?? null)
  const stage: TournamentStage = tournamentState?.stage ?? 'GROUPS_SETUP'

  const groupA = tournamentState?.groupA ?? {
    name: 'Grup A',
    playerIds: [],
    scores: {},
    qualifiedPlayerIds: [],
    status: 'UPCOMING',
  }

  const groupB = tournamentState?.groupB ?? {
    name: 'Grup B',
    playerIds: [],
    scores: {},
    qualifiedPlayerIds: [],
    status: 'UPCOMING',
  }

  // Sorted Group A players by live score
  const groupAPlayers = [...groupA.playerIds]
    .map((id) => ({
      player: getPlayer(id),
      score: groupA.scores[id] ?? 0,
      isQualified: groupA.qualifiedPlayerIds.includes(id),
    }))
    .sort((a, b) => b.score - a.score)

  // Sorted Group B players by live score
  const groupBPlayers = [...groupB.playerIds]
    .map((id) => ({
      player: getPlayer(id),
      score: groupB.scores[id] ?? 0,
      isQualified: groupB.qualifiedPlayerIds.includes(id),
    }))
    .sort((a, b) => b.score - a.score)

  // Group matches by round for Knockout
  const matchesByRound: Record<number, TournamentMatch[]> = {}
  if (tournamentState?.matches) {
    tournamentState.matches.forEach((m) => {
      if (!matchesByRound[m.roundIndex]) {
        matchesByRound[m.roundIndex] = []
      }
      matchesByRound[m.roundIndex].push(m)
    })
  }

  const roundIndices = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="space-y-6">
      {/* ── Stage Progress Indicator ──────────────────────── */}
      <div className="glass-panel rounded-3xl p-4 sm:p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <SwordsIcon size={20} />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base">Mode Turnamen Komplit</h3>
              <p className="text-slate-400 text-xs">
                Penyisihan Grup A & B (Top 2 Lolos) - Babak Gugur BO3 (First to 2 Poin)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => onShuffleGroups?.()}
              disabled={isLoading || players.length < 2 || stage === 'KNOCKOUT'}
              className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2 px-3.5 rounded-xl border border-white/10 transition-all active:scale-95 disabled:opacity-40"
            >
              <RefreshIcon size={12} />
              <span>Acak Grup</span>
            </button>
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={isLoading}
              className="inline-flex items-center gap-1.5 bg-red-950/40 hover:bg-red-900/60 text-red-300 text-xs font-bold py-2 px-3 rounded-xl border border-red-500/30 transition-all active:scale-95 disabled:opacity-40"
            >
              <span>Reset Turnamen</span>
            </button>
          </div>
        </div>

        {/* Horizontal Step Indicator */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-white/5 text-xs">
          <div
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
              stage === 'GROUPS_SETUP'
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 font-black ring-1 ring-amber-400/40'
                : 'bg-slate-900/60 border-white/5 text-slate-400 font-medium'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">1</span>
            <span className="truncate">Pembagian Grup</span>
          </div>

          <div
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
              stage === 'GROUP_A'
                ? 'bg-teal-500/20 border-teal-400/50 text-teal-300 font-black ring-1 ring-teal-400/40 animate-pulse'
                : groupA.status === 'FINISHED'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                : 'bg-slate-900/60 border-white/5 text-slate-400 font-medium'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">2</span>
            <span className="truncate">Babak Grup A</span>
          </div>

          <div
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
              stage === 'GROUP_B'
                ? 'bg-teal-500/20 border-teal-400/50 text-teal-300 font-black ring-1 ring-teal-400/40 animate-pulse'
                : groupB.status === 'FINISHED'
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 font-bold'
                : 'bg-slate-900/60 border-white/5 text-slate-400 font-medium'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">3</span>
            <span className="truncate">Babak Grup B</span>
          </div>

          <div
            className={`p-2.5 rounded-2xl border flex items-center gap-2 transition-all ${
              stage === 'KNOCKOUT'
                ? 'bg-amber-400/20 border-amber-400/50 text-amber-300 font-black ring-1 ring-amber-400/40'
                : 'bg-slate-900/60 border-white/5 text-slate-400 font-medium'
            }`}
          >
            <span className="w-5 h-5 rounded-full bg-white/10 flex items-center justify-center text-[10px] font-bold">4</span>
            <span className="truncate">Babak Gugur BO3</span>
          </div>
        </div>
      </div>

      {/* Confirmation modal for reset tournament */}
      {confirmReset && (
        <div className="glass-panel p-5 rounded-3xl border border-red-500/40 bg-red-950/20 space-y-3">
          <p className="text-white text-sm font-bold">
            Atur ulang seluruh tahapan turnamen untuk {players.length} pemain?
          </p>
          <p className="text-slate-400 text-xs">
            Pemain akan diacak ulang ke Grup A & B, skor grup dan riwayat bagan akan direset.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onResetTournament()
                setConfirmReset(false)
              }}
              disabled={isLoading}
              className="bg-red-500 hover:bg-red-400 text-white font-black text-xs py-2 px-4 rounded-xl transition-all"
            >
              Ya, Reset Turnamen
            </button>
            <button
              onClick={() => setConfirmReset(false)}
              className="bg-slate-800 text-slate-300 font-bold text-xs py-2 px-4 rounded-xl"
            >
              Batal
            </button>
          </div>
        </div>
      )}

      {/* Champion Banner */}
      {champion && (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border-2 border-amber-400/50 p-6 sm:p-8 text-center shadow-2xl space-y-3">
          <div className="w-16 h-16 rounded-3xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-xl shadow-amber-400/30 animate-bounce">
            <CrownIcon size={36} />
          </div>
          <p className="text-amber-400 text-xs font-black uppercase tracking-widest">
            SANG JUARA TURNAMEN
          </p>
          <h2 className="text-3xl sm:text-5xl font-black text-white tracking-tight">
            {champion.name.toUpperCase()}
          </h2>
          <p className="text-slate-300 text-sm max-w-md mx-auto">
            Selamat! Berhasil menjuarai Turnamen Babak Gugur BO3 Tebak Lagu!
          </p>
        </div>
      )}

      {/* ── STAGE 1, 2, 3: GROUPS SECTION ──────────────────────── */}
      {stage !== 'KNOCKOUT' && (
        <div className="space-y-6">
          {/* Stage Action Prompt */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-lg bg-slate-900/60 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-400">
                {stage === 'GROUPS_SETUP'
                  ? 'TAHAP PERSIAPAN GRUP'
                  : stage === 'GROUP_A'
                  ? 'SEDANG BERLANGSUNG: GRUP A'
                  : 'SEDANG BERLANGSUNG: GRUP B'}
              </span>
              <h4 className="text-white font-extrabold text-base mt-0.5">
                {stage === 'GROUPS_SETUP' && 'Bagi pemain ke Grup A & B, lalu mulai babak penyisihan!'}
                {stage === 'GROUP_A' && 'Putar 5–7 lagu untuk Grup A. Top 2 pemain teratas akan lolos!'}
                {stage === 'GROUP_B' && 'Putar 5–7 lagu untuk Grup B. Top 2 pemain teratas akan lolos!'}
              </h4>
            </div>

            <div className="flex items-center gap-2">
              {stage === 'GROUPS_SETUP' && (
                <button
                  type="button"
                  onClick={() => onStartGroupA?.()}
                  disabled={isLoading || groupA.playerIds.length === 0}
                  className="bg-gradient-to-r from-teal-400 to-emerald-400 hover:from-teal-300 hover:to-emerald-300 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-teal-500/20 transition-all active:scale-95 disabled:opacity-40"
                >
                  <PlayIcon size={14} />
                  <span>Mulai Babak Grup A</span>
                </button>
              )}

              {stage === 'GROUP_A' && (
                <button
                  type="button"
                  onClick={() => setConfirmFinishA(true)}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-40"
                >
                  <span>Selesaikan Grup A -&gt; Lanjut Grup B</span>
                  <ArrowRightIcon size={14} />
                </button>
              )}

              {stage === 'GROUP_B' && (
                <button
                  type="button"
                  onClick={() => setConfirmFinishB(true)}
                  disabled={isLoading}
                  className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black px-5 py-3 rounded-2xl text-xs flex items-center gap-2 shadow-lg shadow-amber-500/20 transition-all active:scale-95 disabled:opacity-40"
                >
                  <SwordsIcon size={14} />
                  <span>Kunci Hasil & Mulai Babak Gugur BO3</span>
                </button>
              )}
            </div>
          </div>

          {/* Confirm Finish A */}
          {confirmFinishA && (
            <div className="glass-panel p-5 rounded-3xl border border-amber-400/40 bg-amber-950/20 space-y-3">
              <p className="text-white text-sm font-bold">
                Kunci hasil klasemen Grup A dan lanjutkan ke Grup B?
              </p>
              <p className="text-slate-400 text-xs">
                2 pemain teratas Grup A ({groupAPlayers.slice(0, 2).map((x) => x.player?.name).filter(Boolean).join(', ') || 'Top 2'}) akan melaju ke Semifinal BO3.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onFinishGroupA?.()
                    onStartGroupB?.()
                    setConfirmFinishA(false)
                  }}
                  disabled={isLoading}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 px-4 rounded-xl transition-all"
                >
                  Ya, Kunci & Mulai Grup B
                </button>
                <button
                  onClick={() => setConfirmFinishA(false)}
                  className="bg-slate-800 text-slate-300 font-bold text-xs py-2 px-4 rounded-xl"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Confirm Finish B */}
          {confirmFinishB && (
            <div className="glass-panel p-5 rounded-3xl border border-amber-400/40 bg-amber-950/20 space-y-3">
              <p className="text-white text-sm font-bold">
                Kunci hasil klasemen Grup B dan mulai Babak Gugur BO3?
              </p>
              <p className="text-slate-400 text-xs">
                2 pemain teratas Grup B ({groupBPlayers.slice(0, 2).map((x) => x.player?.name).filter(Boolean).join(', ') || 'Top 2'}) akan bertanding di Semifinal 1 & 2 format Best-of-3!
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    onFinishGroupB?.()
                    setConfirmFinishB(false)
                  }}
                  disabled={isLoading}
                  className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 px-4 rounded-xl transition-all"
                >
                  Ya, Masuk ke Babak Gugur BO3!
                </button>
                <button
                  onClick={() => setConfirmFinishB(false)}
                  className="bg-slate-800 text-slate-300 font-bold text-xs py-2 px-4 rounded-xl"
                >
                  Batal
                </button>
              </div>
            </div>
          )}

          {/* Groups Side-by-Side Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* GRUP A CARD */}
            <div
              className={`glass-panel rounded-3xl p-5 border transition-all ${
                stage === 'GROUP_A'
                  ? 'border-teal-400/70 bg-teal-950/20 ring-2 ring-teal-400/30'
                  : 'border-white/10 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-teal-400/20 text-teal-300 flex items-center justify-center font-black text-sm">
                    A
                  </span>
                  <div>
                    <h4 className="text-white font-black text-base">GRUP A</h4>
                    <p className="text-slate-400 text-xs">{groupAPlayers.length} Pemain</p>
                  </div>
                </div>

                {stage === 'GROUP_A' ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/40 animate-pulse">
                    SEDANG MAIN (BUZZER AKTIF)
                  </span>
                ) : groupA.status === 'FINISHED' ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    SELESAI (TOP 2 LOLOS)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
                    MENUNGGU
                  </span>
                )}
              </div>

              {/* Group A Players List */}
              <div className="space-y-2">
                {groupAPlayers.map((item, idx) => {
                  const isTop2 = idx < 2
                  return (
                    <div
                      key={item.player?.id ?? idx}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isTop2
                          ? 'bg-teal-500/10 border-teal-500/30 text-teal-200'
                          : 'bg-slate-950/50 border-white/5 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                            isTop2
                              ? 'bg-teal-400 text-slate-950 font-black'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {item.player?.name ?? 'Pemain'}
                          </p>
                          <span className="text-[10px] font-semibold">
                            {isTop2 ? (
                              <span className="text-teal-300 font-bold">Zona Lolos Semifinal</span>
                            ) : (
                              <span className="text-slate-500">Zona Gugur</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-teal-400">
                          {item.score} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                        </span>
                        {groupA.status === 'FINISHED' && item.isQualified && (
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <CheckIcon size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* GRUP B CARD */}
            <div
              className={`glass-panel rounded-3xl p-5 border transition-all ${
                stage === 'GROUP_B'
                  ? 'border-teal-400/70 bg-teal-950/20 ring-2 ring-teal-400/30'
                  : 'border-white/10 bg-slate-900/60'
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                  <span className="w-8 h-8 rounded-xl bg-teal-400/20 text-teal-300 flex items-center justify-center font-black text-sm">
                    B
                  </span>
                  <div>
                    <h4 className="text-white font-black text-base">GRUP B</h4>
                    <p className="text-slate-400 text-xs">{groupBPlayers.length} Pemain</p>
                  </div>
                </div>

                {stage === 'GROUP_B' ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider bg-teal-400/20 text-teal-300 border border-teal-400/40 animate-pulse">
                    SEDANG MAIN (BUZZER AKTIF)
                  </span>
                ) : groupB.status === 'FINISHED' ? (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                    SELESAI (TOP 2 LOLOS)
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider bg-slate-800 text-slate-400">
                    MENUNGGU GILIRAN
                  </span>
                )}
              </div>

              {/* Group B Players List */}
              <div className="space-y-2">
                {groupBPlayers.map((item, idx) => {
                  const isTop2 = idx < 2
                  return (
                    <div
                      key={item.player?.id ?? idx}
                      className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                        isTop2
                          ? 'bg-teal-500/10 border-teal-500/30 text-teal-200'
                          : 'bg-slate-950/50 border-white/5 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                            isTop2
                              ? 'bg-teal-400 text-slate-950 font-black'
                              : 'bg-white/10 text-slate-400'
                          }`}
                        >
                          #{idx + 1}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-white truncate">
                            {item.player?.name ?? 'Pemain'}
                          </p>
                          <span className="text-[10px] font-semibold">
                            {isTop2 ? (
                              <span className="text-teal-300 font-bold">Zona Lolos Semifinal</span>
                            ) : (
                              <span className="text-slate-500">Zona Gugur</span>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="font-mono font-black text-sm text-teal-400">
                          {item.score} <span className="text-[10px] text-slate-400 font-normal">pts</span>
                        </span>
                        {groupB.status === 'FINISHED' && item.isQualified && (
                          <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
                            <CheckIcon size={12} />
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── STAGE 4: KNOCKOUT BO3 STAGE ──────────────────────── */}
      {stage === 'KNOCKOUT' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <SwordsIcon size={20} />
              </div>
              <div>
                <h3 className="text-white font-extrabold text-base">Babak Gugur BO3 (Best of 3)</h3>
                <p className="text-slate-400 text-xs">
                  4 Pemain Lolos (Top 2 Grup A & B). Target duel: First to 2 Poin!
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="px-3 py-1.5 rounded-xl bg-amber-400/20 border border-amber-400/40 text-amber-300 font-black text-xs">
                FORMAT: BEST OF 3 (2 POIN)
              </span>
            </div>
          </div>

          {/* Interactive Visual Knockout Tree */}
          {tournamentState && tournamentState.matches.length > 0 && (
            <div className="overflow-x-auto pb-4">
              <div className="flex gap-6 min-w-max items-start">
                {roundIndices.map((roundIdx) => {
                  const roundMatches = matchesByRound[roundIdx]
                  const roundName = roundMatches[0]?.roundName ?? `Babak ${roundIdx + 1}`
                  const isFinal = roundIdx === roundIndices.length - 1

                  return (
                    <div key={roundIdx} className="w-72 sm:w-80 space-y-4 shrink-0">
                      {/* Round Header */}
                      <div className="flex items-center justify-between px-2">
                        <span className="text-xs font-black uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                          {isFinal ? <TrophyIcon size={14} className="text-amber-400" /> : <SwordsIcon size={14} className="text-teal-400" />}
                          <span>{roundName}</span>
                        </span>
                        <span className="text-[11px] font-bold text-slate-500 bg-white/5 px-2 py-0.5 rounded-full">
                          {roundMatches.length} Match
                        </span>
                      </div>

                      {/* Matches List */}
                      <div className="space-y-4">
                        {roundMatches.map((m, mIdx) => {
                          const p1 = getPlayer(m.player1Id)
                          const p2 = getPlayer(m.player2Id)
                          const isP1Winner = m.winnerId === m.player1Id && m.winnerId !== null
                          const isP2Winner = m.winnerId === m.player2Id && m.winnerId !== null
                          const isActive = m.id === tournamentState.activeMatchId
                          const canStart = m.status === 'UPCOMING' && m.player1Id && m.player2Id

                          return (
                            <div
                              key={m.id}
                              className={`glass-panel rounded-2xl p-4 border transition-all ${
                                isActive
                                  ? 'border-amber-400/80 bg-amber-950/20 shadow-xl shadow-amber-500/10 ring-2 ring-amber-400/30'
                                  : m.status === 'FINISHED'
                                  ? 'border-white/10 bg-slate-900/60 opacity-90'
                                  : 'border-white/5 bg-slate-900/80'
                              }`}
                            >
                              {/* Match Card Header */}
                              <div className="flex items-center justify-between text-[11px] mb-3">
                                <span className="font-bold text-slate-400">
                                  {m.roundName || `Match #${mIdx + 1}`}
                                </span>
                                {isActive ? (
                                  <span className="px-2 py-0.5 rounded-full font-black uppercase tracking-widest text-[10px] bg-amber-400/20 text-amber-300 border border-amber-400/40 animate-pulse">
                                    SEDANG DUEL
                                  </span>
                                ) : m.status === 'FINISHED' ? (
                                  <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-widest text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                                    SELESAI
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full font-bold uppercase tracking-widest text-[10px] bg-slate-800 text-slate-400">
                                    MENUNGGU
                                  </span>
                                )}
                              </div>

                              {/* Player 1 Row */}
                              <div
                                className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                                  isP1Winner
                                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200'
                                    : 'bg-slate-950/60 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="w-5 h-5 rounded-full bg-white/5 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    1
                                  </span>
                                  <span className="text-xs font-bold truncate">
                                    {p1 ? p1.name : m.player1Id ? 'Menunggu' : 'Menunggu Pemenang'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-sm text-amber-400">
                                    {m.player1Score}
                                  </span>
                                  {isP1Winner && (
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 flex items-center justify-center">
                                      <CheckIcon size={12} />
                                    </span>
                                  )}
                                  {m.status !== 'FINISHED' && p1 && (
                                    <button
                                      type="button"
                                      onClick={() => onAdvanceWinner(m.id, p1.id)}
                                      title="Menangkan Pemain 1 secara manual"
                                      disabled={isLoading}
                                      className="text-[10px] text-slate-500 hover:text-emerald-300 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
                                    >
                                      Loloskan
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* VS Divider */}
                              <div className="flex items-center justify-center my-1.5">
                                <span className="text-[10px] font-black tracking-widest text-slate-500 uppercase">
                                  VS
                                </span>
                              </div>

                              {/* Player 2 Row */}
                              <div
                                className={`flex items-center justify-between p-2.5 rounded-xl transition-all ${
                                  isP2Winner
                                    ? 'bg-emerald-500/15 border border-emerald-500/40 text-emerald-200'
                                    : 'bg-slate-950/60 text-slate-300'
                                }`}
                              >
                                <div className="flex items-center gap-2 min-w-0 flex-1">
                                  <span className="w-5 h-5 rounded-full bg-white/5 text-[10px] font-bold flex items-center justify-center shrink-0">
                                    2
                                  </span>
                                  <span className="text-xs font-bold truncate">
                                    {p2 ? p2.name : m.player2Id ? 'Menunggu' : 'Menunggu Pemenang'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="font-mono font-black text-sm text-amber-400">
                                    {m.player2Score}
                                  </span>
                                  {isP2Winner && (
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/30 text-emerald-400 flex items-center justify-center">
                                      <CheckIcon size={12} />
                                    </span>
                                  )}
                                  {m.status !== 'FINISHED' && p2 && (
                                    <button
                                      type="button"
                                      onClick={() => onAdvanceWinner(m.id, p2.id)}
                                      title="Menangkan Pemain 2 secara manual"
                                      disabled={isLoading}
                                      className="text-[10px] text-slate-500 hover:text-emerald-300 px-1.5 py-0.5 rounded bg-white/5 hover:bg-white/10"
                                    >
                                      Loloskan
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* Action Button */}
                              {canStart && (
                                <button
                                  type="button"
                                  onClick={() => onSetActiveMatch(m.id)}
                                  disabled={isLoading}
                                  className="mt-3 w-full bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-2 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-all active:scale-95 shadow-md shadow-amber-400/20"
                                >
                                  <PlayIcon size={13} />
                                  <span>Mulai Duel Ini</span>
                                </button>
                              )}
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
