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
  ShuffleIcon,
} from '@/components/shared/Icons'
import type { Player, TournamentMatch, TournamentState, TournamentPhase } from '@/lib/types'

interface TournamentBracketProps {
  tournamentState: TournamentState | null
  players: Player[]
  onSetTournamentPhase?: (phase: TournamentPhase) => void
  onSetActiveMatch: (matchId: string) => void
  onAdvanceWinner: (matchId: string, winnerId: string) => void
  onGenerateBracket?: (targetPoints: number) => void
  onShuffleGroups?: () => void
  onStartGroupA?: () => void
  onFinishGroupA?: () => void
  onStartGroupB?: () => void
  onFinishGroupB?: () => void
  onResetTournament: () => void
  onSetQualifyCount?: (count: 2 | 3) => void
  isLoading?: boolean
}

export function TournamentBracket({
  tournamentState,
  players,
  onSetTournamentPhase,
  onSetActiveMatch,
  onAdvanceWinner,
  onShuffleGroups,
  onStartGroupA,
  onStartGroupB,
  onResetTournament,
  onSetQualifyCount,
  isLoading = false,
}: TournamentBracketProps) {
  const [confirmReset, setConfirmReset] = useState(false)
  const qualifyCount = tournamentState?.qualifyCount === 3 ? 3 : 2

  const getPlayer = (id: string | null | undefined): Player | undefined => {
    if (!id) return undefined
    return players.find((p) => p.id === id)
  }

  const phase: TournamentPhase =
    tournamentState?.phase ??
    (tournamentState?.stage === 'GROUP_B'
      ? 'GROUP_B'
      : tournamentState?.stage === 'KNOCKOUT'
      ? 'KNOCKOUT'
      : 'GROUP_A')

  const groupAIds = tournamentState?.groupAPlayerIds || tournamentState?.groupA?.playerIds || []
  const groupBIds = tournamentState?.groupBPlayerIds || tournamentState?.groupB?.playerIds || []

  // Group A players sorted by current player.score
  const groupAPlayers = groupAIds
    .map((id) => getPlayer(id))
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))

  // Group B players sorted by current player.score
  const groupBPlayers = groupBIds
    .map((id) => getPlayer(id))
    .filter((p): p is Player => Boolean(p))
    .sort((a, b) => (b?.score ?? 0) - (a?.score ?? 0))

  const handlePhaseChange = (newPhase: TournamentPhase) => {
    if (onSetTournamentPhase) {
      onSetTournamentPhase(newPhase)
    } else if (newPhase === 'GROUP_A' && onStartGroupA) {
      onStartGroupA()
    } else if (newPhase === 'GROUP_B' && onStartGroupB) {
      onStartGroupB()
    }
  }

  const champion = getPlayer(tournamentState?.championId ?? null)
  const matches = tournamentState?.matches || []

  return (
    <div className="space-y-6">
      {/* ── Top Header & Actions ──────────────────────── */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <SwordsIcon size={22} />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-base sm:text-lg">
                Klasemen & Babak Gugur (BO3)
              </h3>
              <p className="text-slate-400 text-xs sm:text-sm">
                Mainkan 5–7 lagu per grup untuk klasemen (Top 2 lolos), lalu lanjut duel BO3.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-auto flex-wrap">
            {/* Qualify Count Option (2 or 3) */}
            <div className="flex bg-slate-900/90 p-1 rounded-xl border border-white/10 shrink-0">
              <button
                type="button"
                onClick={() => onSetQualifyCount?.(2)}
                disabled={isLoading || phase === 'KNOCKOUT'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  qualifyCount === 2
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Top 2 dari masing-masing grup lolos ke babak gugur"
              >
                Top 2 Lolos
              </button>
              <button
                type="button"
                onClick={() => onSetQualifyCount?.(3)}
                disabled={isLoading || phase === 'KNOCKOUT'}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  qualifyCount === 3
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Top 3 dari masing-masing grup lolos ke babak gugur"
              >
                Top 3 Lolos
              </button>
            </div>

            {onShuffleGroups && (
              <button
                type="button"
                onClick={onShuffleGroups}
                disabled={isLoading}
                className="px-3.5 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
                title="Acak ulang pembagian pemain Grup A dan Grup B"
              >
                <ShuffleIcon size={14} />
                <span>Acak Ulang Grup</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => setConfirmReset(true)}
              disabled={isLoading}
              className="px-3.5 py-2 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 active:scale-95"
            >
              <RefreshIcon size={14} />
              <span>Reset Turnamen</span>
            </button>
          </div>
        </div>

        {/* ── Phase Switcher Tabs ──────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2">
          {/* Phase 1: Group A */}
          <button
            type="button"
            onClick={() => handlePhaseChange('GROUP_A')}
            disabled={isLoading}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
              phase === 'GROUP_A'
                ? 'bg-emerald-500/15 border-emerald-500/60 shadow-lg shadow-emerald-500/10 ring-1 ring-emerald-500/50'
                : 'bg-slate-900/60 border-white/5 hover:border-white/20 hover:bg-slate-900/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  phase === 'GROUP_A' ? 'text-emerald-400' : 'text-slate-400'
                }`}
              >
                1. Giliran Grup A
              </span>
              {phase === 'GROUP_A' && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500" />
                </span>
              )}
            </div>
            <p className="text-white font-bold text-sm mt-1">Grup A Bermain</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Hanya Grup A yang dapat menekan buzzer
            </p>
          </button>

          {/* Phase 2: Group B */}
          <button
            type="button"
            onClick={() => handlePhaseChange('GROUP_B')}
            disabled={isLoading}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
              phase === 'GROUP_B'
                ? 'bg-teal-500/15 border-teal-500/60 shadow-lg shadow-teal-500/10 ring-1 ring-teal-500/50'
                : 'bg-slate-900/60 border-white/5 hover:border-white/20 hover:bg-slate-900/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  phase === 'GROUP_B' ? 'text-teal-400' : 'text-slate-400'
                }`}
              >
                2. Giliran Grup B
              </span>
              {phase === 'GROUP_B' && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-teal-500" />
                </span>
              )}
            </div>
            <p className="text-white font-bold text-sm mt-1">Grup B Bermain</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Hanya Grup B yang dapat menekan buzzer
            </p>
          </button>

          {/* Phase 3: Knockout BO3 */}
          <button
            type="button"
            onClick={() => handlePhaseChange('KNOCKOUT')}
            disabled={isLoading}
            className={`p-3.5 rounded-2xl border text-left transition-all relative overflow-hidden ${
              phase === 'KNOCKOUT'
                ? 'bg-amber-500/15 border-amber-500/60 shadow-lg shadow-amber-500/10 ring-1 ring-amber-500/50'
                : 'bg-slate-900/60 border-white/5 hover:border-white/20 hover:bg-slate-900/90'
            }`}
          >
            <div className="flex items-center justify-between">
              <span
                className={`text-xs font-black uppercase tracking-wider ${
                  phase === 'KNOCKOUT' ? 'text-amber-400' : 'text-slate-400'
                }`}
              >
                3. Babak Gugur BO3
              </span>
              {phase === 'KNOCKOUT' && (
                <span className="flex h-2.5 w-2.5 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500" />
                </span>
              )}
            </div>
            <p className="text-white font-bold text-sm mt-1">Top 2 A vs Top 2 B</p>
            <p className="text-slate-400 text-[11px] mt-0.5">
              Duel 1v1 BO3 (First to 2 Poin)
            </p>
          </button>
        </div>
      </div>

      {/* ── Confirm Reset Modal ──────────────────────── */}
      {confirmReset && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 max-w-sm w-full border border-rose-500/40 bg-slate-950 shadow-2xl space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto">
              <AlertIcon size={24} />
            </div>
            <div className="text-center space-y-1">
              <h4 className="text-white font-black text-lg">Reset Turnamen?</h4>
              <p className="text-slate-400 text-xs">
                Mengembalikan turnamen ke awal pembagian grup. Poin pemain tidak akan hilang.
              </p>
            </div>
            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmReset(false)}
                className="flex-1 py-2.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-xs border border-white/10"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={() => {
                  onResetTournament()
                  setConfirmReset(false)
                }}
                className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-xs"
              >
                Ya, Reset
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Section 1: Group Standings (Grup A & Grup B) ──────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Grup A Card */}
        <div
          className={`glass-panel rounded-3xl p-5 border transition-all ${
            phase === 'GROUP_A'
              ? 'border-emerald-500/50 bg-emerald-950/20 shadow-xl'
              : 'border-white/10 bg-slate-900/50'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black text-sm">
                A
              </div>
              <div>
                <h4 className="text-white font-black text-base">Klasemen Grup A</h4>
                <p className="text-slate-400 text-xs">{groupAPlayers.length} Pemain</p>
              </div>
            </div>
            {phase === 'GROUP_A' ? (
              <span className="px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                Sedang Bermain
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-bold">
                {phase === 'GROUP_B' ? 'Selesai Bermain' : 'Menunggu'}
              </span>
            )}
          </div>

          {/* Group A Player Table */}
          <div className="mt-3 space-y-2">
            {groupAPlayers.length === 0 ? (
              <p className="text-center py-6 text-slate-500 text-xs">Belum ada pemain di Grup A</p>
            ) : (
              groupAPlayers.map((player, idx) => {
                const isQualified = idx < qualifyCount
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isQualified
                        ? 'bg-emerald-500/10 border-emerald-500/30'
                        : 'bg-slate-900/40 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 text-center font-black text-sm ${
                          idx === 0
                            ? 'text-amber-400'
                            : idx === 1
                            ? 'text-slate-300'
                            : idx === 2 && qualifyCount === 3
                            ? 'text-emerald-300'
                            : 'text-slate-600'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{player.name}</span>
                          {isQualified && (
                            <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase tracking-wider border border-emerald-500/30">
                              Lolos Top {qualifyCount}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          {isQualified ? 'Zona Lolos ke Babak Gugur' : 'Zona Gugur'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-emerald-400 font-mono font-black text-base">
                        {player.score ?? 0}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">pts</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {phase === 'GROUP_A' && (
            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => handlePhaseChange('GROUP_B')}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs shadow-lg shadow-emerald-500/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <span>Grup A Selesai, Lanjut Grup B</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          )}
        </div>

        {/* Grup B Card */}
        <div
          className={`glass-panel rounded-3xl p-5 border transition-all ${
            phase === 'GROUP_B'
              ? 'border-teal-500/50 bg-teal-950/20 shadow-xl'
              : 'border-white/10 bg-slate-900/50'
          }`}
        >
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center font-black text-sm">
                B
              </div>
              <div>
                <h4 className="text-white font-black text-base">Klasemen Grup B</h4>
                <p className="text-slate-400 text-xs">{groupBPlayers.length} Pemain</p>
              </div>
            </div>
            {phase === 'GROUP_B' ? (
              <span className="px-3 py-1 rounded-full bg-teal-500/20 border border-teal-500/40 text-teal-400 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-teal-400 animate-pulse" />
                Sedang Bermain
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-slate-400 text-xs font-bold">
                {phase === 'KNOCKOUT' ? 'Selesai Bermain' : 'Menunggu'}
              </span>
            )}
          </div>

          {/* Group B Player Table */}
          <div className="mt-3 space-y-2">
            {groupBPlayers.length === 0 ? (
              <p className="text-center py-6 text-slate-500 text-xs">Belum ada pemain di Grup B</p>
            ) : (
              groupBPlayers.map((player, idx) => {
                const isQualified = idx < qualifyCount
                return (
                  <div
                    key={player.id}
                    className={`flex items-center justify-between p-3 rounded-2xl border transition-all ${
                      isQualified
                        ? 'bg-teal-500/10 border-teal-500/30'
                        : 'bg-slate-900/40 border-white/5'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-6 text-center font-black text-sm ${
                          idx === 0
                            ? 'text-amber-400'
                            : idx === 1
                            ? 'text-slate-300'
                            : idx === 2 && qualifyCount === 3
                            ? 'text-teal-300'
                            : 'text-slate-600'
                        }`}
                      >
                        #{idx + 1}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-white font-bold text-sm">{player.name}</span>
                          {isQualified && (
                            <span className="px-2 py-0.5 rounded-md bg-teal-500/20 text-teal-300 text-[10px] font-black uppercase tracking-wider border border-teal-500/30">
                              Lolos Top {qualifyCount}
                            </span>
                          )}
                        </div>
                        <span className="text-slate-500 text-[11px]">
                          {isQualified ? 'Zona Lolos ke Babak Gugur' : 'Zona Gugur'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-teal-400 font-mono font-black text-base">
                        {player.score ?? 0}
                      </span>
                      <span className="text-slate-500 text-xs ml-1">pts</span>
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {phase === 'GROUP_B' && (
            <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
              <button
                type="button"
                onClick={() => handlePhaseChange('KNOCKOUT')}
                disabled={isLoading}
                className="px-4 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs shadow-lg shadow-amber-400/20 transition-all flex items-center gap-2 active:scale-95"
              >
                <span>Grup B Selesai, Mulai Babak Gugur BO3</span>
                <ArrowRightIcon size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Section 2: Knockout BO3 Bracket ──────────────────────── */}
      {phase === 'KNOCKOUT' && (
        <div className="glass-panel rounded-3xl p-5 border border-amber-500/40 bg-gradient-to-b from-amber-950/10 to-slate-950/60 shadow-2xl space-y-5">
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-white/10">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/20">
                <TrophyIcon size={20} />
              </div>
              <div>
                <h4 className="text-white font-black text-lg">Bagan Babak Gugur (BO3)</h4>
                <p className="text-slate-400 text-xs">
                  Sistem Best of 3 (Pemain pertama yang mencapai 2 poin memenangkan duel).
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-xs font-black uppercase">
              Target: 2 Poin
            </span>
          </div>

          {/* Champion Banner if finished */}
          {champion && (
            <div className="p-5 rounded-3xl bg-gradient-to-r from-amber-500/20 via-yellow-500/20 to-amber-500/20 border border-amber-400/50 text-center space-y-2 shadow-xl shadow-amber-500/10 animate-bounce-slow">
              <div className="w-14 h-14 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-lg shadow-amber-400/30">
                <CrownIcon size={30} />
              </div>
              <h3 className="text-amber-300 font-black text-xs uppercase tracking-widest">
                JUARA TURNAMEN GUESS THE SONG
              </h3>
              <p className="text-white font-black text-2xl sm:text-3xl tracking-tight">
                {champion.name}
              </p>
              <p className="text-slate-400 text-xs">
                Selamat! Telah menjuarai seluruh rangkaian babak penyisihan hingga grand final.
              </p>
            </div>
          )}

          {/* Matches Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {matches.map((match) => {
              const p1 = getPlayer(match.player1Id)
              const p2 = getPlayer(match.player2Id)
              const isActive = match.id === tournamentState?.activeMatchId
              const isFinished = match.status === 'FINISHED'
              const winner = getPlayer(match.winnerId)
              const isPlayable = Boolean(p1 && p2 && !isFinished)

              return (
                <div
                  key={match.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between ${
                    isActive
                      ? 'bg-amber-500/10 border-amber-400/60 shadow-lg shadow-amber-500/20 ring-1 ring-amber-400/50'
                      : isFinished
                      ? 'bg-slate-900/30 border-white/5 opacity-80'
                      : 'bg-slate-900/60 border-white/10'
                  }`}
                >
                  <div>
                    {/* Match Title & Status */}
                    <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5">
                      <span className="text-white font-black text-xs tracking-wider">
                        {match.roundName}
                      </span>
                      {isActive ? (
                        <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase flex items-center gap-1">
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                          Duel Aktif
                        </span>
                      ) : isFinished ? (
                        <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-black uppercase">
                          Selesai
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded-full bg-white/5 text-slate-400 text-[10px] font-bold">
                          Menunggu
                        </span>
                      )}
                    </div>

                    {/* Duelists */}
                    <div className="space-y-2">
                      {/* Player 1 */}
                      <div
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          match.winnerId === match.player1Id && match.player1Id
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950/40 border-white/5 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {match.winnerId === match.player1Id && match.player1Id && (
                            <CheckIcon size={14} className="text-emerald-400 shrink-0" />
                          )}
                          <span className="font-bold text-xs truncate">
                            {p1?.name ?? (match.roundIndex === 0 ? 'Menunggu Top 2' : 'Pemenang SF')}
                          </span>
                        </div>
                        <span className="font-mono font-black text-sm ml-2">
                          {match.player1Score}
                        </span>
                      </div>

                      {/* VS Divider */}
                      <div className="text-center text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        VS
                      </div>

                      {/* Player 2 */}
                      <div
                        className={`flex items-center justify-between p-2.5 rounded-xl border ${
                          match.winnerId === match.player2Id && match.player2Id
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                            : 'bg-slate-950/40 border-white/5 text-white'
                        }`}
                      >
                        <div className="flex items-center gap-2 truncate">
                          {match.winnerId === match.player2Id && match.player2Id && (
                            <CheckIcon size={14} className="text-emerald-400 shrink-0" />
                          )}
                          <span className="font-bold text-xs truncate">
                            {p2?.name ?? (match.roundIndex === 0 ? 'Menunggu Top 2' : 'Pemenang SF')}
                          </span>
                        </div>
                        <span className="font-mono font-black text-sm ml-2">
                          {match.player2Score}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Match Controls for Host */}
                  <div className="mt-4 pt-3 border-t border-white/5">
                    {isActive ? (
                      <div className="space-y-1.5">
                        <p className="text-[10px] text-amber-300/80 text-center font-medium">
                          Buzzer hanya untuk 2 pemain ini (First to 2 Poin)
                        </p>
                        <div className="flex gap-1.5 pt-1">
                          {p1 && (
                            <button
                              type="button"
                              onClick={() => onAdvanceWinner(match.id, p1.id)}
                              disabled={isLoading}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 text-[10px] font-bold transition-all truncate"
                              title={`Menangkan ${p1.name} secara manual`}
                            >
                              Menangkan {p1.name}
                            </button>
                          )}
                          {p2 && (
                            <button
                              type="button"
                              onClick={() => onAdvanceWinner(match.id, p2.id)}
                              disabled={isLoading}
                              className="flex-1 py-1.5 px-2 rounded-lg bg-white/5 hover:bg-emerald-500/20 text-slate-300 hover:text-emerald-300 border border-white/10 text-[10px] font-bold transition-all truncate"
                              title={`Menangkan ${p2.name} secara manual`}
                            >
                              Menangkan {p2.name}
                            </button>
                          )}
                        </div>
                      </div>
                    ) : isPlayable ? (
                      <button
                        type="button"
                        onClick={() => onSetActiveMatch(match.id)}
                        disabled={isLoading}
                        className="w-full py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition-all flex items-center justify-center gap-1.5 shadow-md active:scale-95"
                      >
                        <PlayIcon size={12} />
                        <span>Mulai Duel Ini</span>
                      </button>
                    ) : isFinished ? (
                      <div className="text-center text-[11px] text-slate-500 font-medium">
                        Pemenang: <span className="text-emerald-400 font-bold">{winner?.name}</span>
                      </div>
                    ) : (
                      <div className="text-center text-[10px] text-slate-600 font-medium py-1">
                        Menunggu hasil pertandingan sebelumnya
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
