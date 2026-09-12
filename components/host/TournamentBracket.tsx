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
} from '@/components/shared/Icons'
import type { Player, TournamentMatch, TournamentState } from '@/lib/types'

interface TournamentBracketProps {
  tournamentState: TournamentState | null
  players: Player[]
  onSetActiveMatch: (matchId: string) => void
  onAdvanceWinner: (matchId: string, winnerId: string) => void
  onGenerateBracket: (targetPoints: number) => void
  onResetTournament: () => void
  isLoading?: boolean
}

export function TournamentBracket({
  tournamentState,
  players,
  onSetActiveMatch,
  onAdvanceWinner,
  onGenerateBracket,
  onResetTournament,
  isLoading = false,
}: TournamentBracketProps) {
  const [targetPts, setTargetPts] = useState<number>(tournamentState?.targetPoints ?? 2)
  const [confirmReset, setConfirmReset] = useState(false)

  const getPlayer = (id: string | null): Player | undefined => {
    if (!id) return undefined
    return players.find((p) => p.id === id)
  }

  const champion = getPlayer(tournamentState?.championId ?? null)

  // Group matches by round
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
      {/* Tournament Controls Bar */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 shadow-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400">
            <SwordsIcon size={20} />
          </div>
          <div>
            <h3 className="text-white font-extrabold text-base">Bagan Babak Gugur 1v1</h3>
            <p className="text-slate-400 text-xs">
              Sistem turnamen eliminasi tunggal. Pemenang melaju ke babak selanjutnya.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <div className="flex items-center gap-1.5 bg-slate-900/90 border border-white/10 rounded-2xl p-1 text-xs">
            <span className="px-2 font-bold text-slate-400">Target Skor:</span>
            {[1, 2, 3].map((pts) => (
              <button
                key={pts}
                type="button"
                onClick={() => {
                  setTargetPts(pts)
                  if (!tournamentState || tournamentState.matches.length === 0) {
                    onGenerateBracket(pts)
                  }
                }}
                disabled={isLoading}
                className={`px-3 py-1 rounded-xl font-black transition-all ${
                  targetPts === pts
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {pts} {pts === 1 ? 'Poin (Sudden Death)' : pts === 2 ? 'Poin (Best of 3)' : 'Poin'}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setConfirmReset(true)}
            disabled={isLoading || players.length < 2}
            className="inline-flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-bold py-2.5 px-4 rounded-2xl border border-white/10 transition-all active:scale-95 disabled:opacity-40"
          >
            <RefreshIcon size={13} />
            <span>Acak Ulang Bagan</span>
          </button>
        </div>
      </div>

      {/* Confirmation modal for reset bracket */}
      {confirmReset && (
        <div className="glass-panel p-5 rounded-3xl border border-amber-500/40 bg-amber-950/20 space-y-3">
          <p className="text-white text-sm font-bold">
            Acak ulang bagan turnamen untuk {players.length} pemain dengan target {targetPts} poin?
          </p>
          <p className="text-slate-400 text-xs">
            Pertandingan dan riwayat duel yang ada saat ini akan diatur ulang dari babak pertama.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => {
                onGenerateBracket(targetPts)
                setConfirmReset(false)
              }}
              disabled={isLoading}
              className="bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs py-2 px-4 rounded-xl transition-all"
            >
              Ya, Buat Bagan Baru
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
            Selamat! Berhasil menjuarai Turnamen Babak Gugur 1v1 Tebak Lagu!
          </p>
        </div>
      )}

      {/* Empty state: No bracket yet */}
      {(!tournamentState || tournamentState.matches.length === 0) && (
        <div className="glass-panel rounded-3xl p-10 border border-white/10 text-center space-y-4">
          <div className="w-16 h-16 rounded-3xl bg-slate-800/80 border border-white/10 flex items-center justify-center mx-auto text-amber-400">
            <SwordsIcon size={30} />
          </div>
          <div>
            <h4 className="text-white font-extrabold text-lg">Bagan Belum Dibuat</h4>
            <p className="text-slate-400 text-xs max-w-md mx-auto mt-1">
              Saat ini terdapat {players.length} pemain yang terhubung. Klik tombol di bawah untuk memasangkan pemain secara otomatis ke dalam sistem turnamen 1v1.
            </p>
          </div>
          <button
            onClick={() => onGenerateBracket(targetPts)}
            disabled={isLoading || players.length < 2}
            className="bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black py-3.5 px-6 rounded-2xl shadow-lg shadow-amber-500/20 text-sm transition-all active:scale-95 disabled:opacity-40"
          >
            Buat Bagan ({players.length} Pemain)
          </button>
        </div>
      )}

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
                            <span className="font-bold text-slate-400">Match #{mIdx + 1}</span>
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
                                {p1 ? p1.name : m.player1Id ? 'Menunggu' : 'BYE'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isActive && (
                                <span className="font-mono font-black text-sm text-amber-400">
                                  {m.player1Score}
                                </span>
                              )}
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
                                  className="text-[10px] text-slate-500 hover:text-emerald-300 px-1 py-0.5 rounded bg-white/5 hover:bg-white/10"
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
                                {p2 ? p2.name : m.player2Id ? 'Menunggu' : 'BYE'}
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              {isActive && (
                                <span className="font-mono font-black text-sm text-amber-400">
                                  {m.player2Score}
                                </span>
                              )}
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
                                  className="text-[10px] text-slate-500 hover:text-emerald-300 px-1 py-0.5 rounded bg-white/5 hover:bg-white/10"
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
  )
}
