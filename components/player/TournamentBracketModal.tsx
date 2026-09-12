'use client'

import React, { useState, useEffect } from 'react'
import {
  TrophyIcon,
  CrownIcon,
  SwordsIcon,
  CheckIcon,
  CrossIcon,
  UsersIcon,
} from '@/components/shared/Icons'
import type { Player, TournamentMatch, TournamentState } from '@/lib/types'

interface TournamentBracketModalProps {
  isOpen: boolean
  onClose: () => void
  tournamentState: TournamentState | null
  players: Player[]
  currentPlayerId: string
}

export function TournamentBracketModal({
  isOpen,
  onClose,
  tournamentState,
  players,
  currentPlayerId,
}: TournamentBracketModalProps) {
  const phase =
    tournamentState?.phase ??
    (tournamentState?.stage === 'GROUP_B'
      ? 'GROUP_B'
      : tournamentState?.stage === 'KNOCKOUT'
      ? 'KNOCKOUT'
      : 'GROUP_A')

  const [modalTab, setModalTab] = useState<'groups' | 'knockout'>(
    phase === 'KNOCKOUT' ? 'knockout' : 'groups'
  )

  // Sync tab automatically when phase changes to KNOCKOUT at runtime
  useEffect(() => {
    if (phase === 'KNOCKOUT') {
      setModalTab('knockout')
    }
  }, [phase])

  if (!isOpen || !tournamentState) return null

  const getPlayer = (id: string | null): Player | undefined => {
    if (!id) return undefined
    return players.find((p) => p.id === id)
  }

  const champion = getPlayer(tournamentState.championId)

  const groupAIds = tournamentState.groupAPlayerIds || tournamentState.groupA?.playerIds || []
  const groupBIds = tournamentState.groupBPlayerIds || tournamentState.groupB?.playerIds || []

  // Sorted Group A players by current player.score
  const groupAPlayers = groupAIds
    .map((id) => {
      const p = getPlayer(id)
      return {
        player: p,
        score: p?.score ?? 0,
        isMe: id === currentPlayerId,
      }
    })
    .filter((item): item is { player: Player; score: number; isMe: boolean } => Boolean(item.player))
    .sort((a, b) => b.score - a.score)

  // Sorted Group B players by current player.score
  const groupBPlayers = groupBIds
    .map((id) => {
      const p = getPlayer(id)
      return {
        player: p,
        score: p?.score ?? 0,
        isMe: id === currentPlayerId,
      }
    })
    .filter((item): item is { player: Player; score: number; isMe: boolean } => Boolean(item.player))
    .sort((a, b) => b.score - a.score)

  // Group matches by round for Knockout
  const matchesByRound: Record<number, TournamentMatch[]> = {}
  tournamentState.matches.forEach((m) => {
    if (!matchesByRound[m.roundIndex]) {
      matchesByRound[m.roundIndex] = []
    }
    matchesByRound[m.roundIndex].push(m)
  })

  const roundIndices = Object.keys(matchesByRound)
    .map(Number)
    .sort((a, b) => a - b)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
      <div className="glass-panel rounded-3xl border border-white/10 w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-pop-in">
        {/* Modal Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between bg-slate-900/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <SwordsIcon size={18} />
            </div>
            <div>
              <h3 className="text-white font-extrabold text-sm sm:text-base">
                Status Mode Turnamen
              </h3>
              <p className="text-slate-400 text-xs">
                {phase === 'KNOCKOUT'
                  ? 'Babak Gugur BO3 (First to 2 Poin)'
                  : 'Penyisihan Grup (Top 2 Lolos ke BO3)'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-all"
          >
            <CrossIcon size={14} />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="flex border-b border-white/10 bg-slate-900/60 p-1.5 gap-1">
          <button
            type="button"
            onClick={() => setModalTab('groups')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              modalTab === 'groups'
                ? 'bg-teal-500 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <UsersIcon size={13} />
            <span>Klasemen Grup A & B</span>
          </button>
          <button
            type="button"
            onClick={() => setModalTab('knockout')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
              modalTab === 'knockout'
                ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <SwordsIcon size={13} />
            <span>Bagan Babak Gugur BO3</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 space-y-5">
          {/* Champion Highlight if won */}
          {champion && (
            <div className="rounded-2xl bg-gradient-to-r from-amber-500/20 via-emerald-500/20 to-teal-500/20 border border-amber-400/40 p-5 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center mx-auto shadow-lg">
                <CrownIcon size={26} />
              </div>
              <p className="text-amber-400 text-[10px] font-black uppercase tracking-widest">
                JUARA TURNAMEN
              </p>
              <h4 className="text-2xl font-black text-white">{champion.name.toUpperCase()}</h4>
            </div>
          )}

          {/* TAB 1: GROUPS */}
          {modalTab === 'groups' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Grup A */}
              <div className="glass-panel rounded-2xl p-4 border border-white/10 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-400/20 text-teal-300 flex items-center justify-center font-black text-xs">
                      A
                    </span>
                    <h4 className="text-white font-bold text-sm">Grup A</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                    {phase === 'GROUP_A' ? 'Sedang Main' : phase === 'GROUP_B' || phase === 'KNOCKOUT' ? 'Selesai' : 'Menunggu'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {groupAPlayers.map((item, idx) => (
                    <div
                      key={item.player?.id ?? idx}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                        item.isMe
                          ? 'bg-teal-500/20 border border-teal-500/40 text-teal-200'
                          : idx < 2
                          ? 'bg-teal-500/10 text-slate-200'
                          : 'bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-[10px] text-slate-500">#{idx + 1}</span>
                        <span className="font-semibold truncate">
                          {item.player?.name ?? 'Pemain'} {item.isMe && '(KAMU)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold">{item.score} pts</span>
                        {idx < 2 && (
                          <span className="text-emerald-400 font-bold text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            Top 2
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {groupAPlayers.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-3">Belum ada anggota di Grup A</p>
                  )}
                </div>
              </div>

              {/* Grup B */}
              <div className="glass-panel rounded-2xl p-4 border border-white/10 bg-slate-900/60 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-6 h-6 rounded-lg bg-teal-400/20 text-teal-300 flex items-center justify-center font-black text-xs">
                      B
                    </span>
                    <h4 className="text-white font-bold text-sm">Grup B</h4>
                  </div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/5 text-slate-400">
                    {phase === 'GROUP_B' ? 'Sedang Main' : phase === 'KNOCKOUT' ? 'Selesai' : 'Menunggu'}
                  </span>
                </div>

                <div className="space-y-1.5">
                  {groupBPlayers.map((item, idx) => (
                    <div
                      key={item.player?.id ?? idx}
                      className={`flex items-center justify-between p-2.5 rounded-xl text-xs transition-all ${
                        item.isMe
                          ? 'bg-teal-500/20 border border-teal-500/40 text-teal-200'
                          : idx < 2
                          ? 'bg-teal-500/10 text-slate-200'
                          : 'bg-slate-950/50 text-slate-400'
                      }`}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span className="font-bold text-[10px] text-slate-500">#{idx + 1}</span>
                        <span className="font-semibold truncate">
                          {item.player?.name ?? 'Pemain'} {item.isMe && '(KAMU)'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <span className="font-mono font-bold">{item.score} pts</span>
                        {idx < 2 && (
                          <span className="text-emerald-400 font-bold text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20">
                            Top 2
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                  {groupBPlayers.length === 0 && (
                    <p className="text-xs text-slate-500 text-center py-3">Belum ada anggota di Grup B</p>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: KNOCKOUT */}
          {modalTab === 'knockout' && (
            <div className="space-y-4">
              {tournamentState.matches.length === 0 ? (
                <div className="text-center py-8 space-y-2">
                  <SwordsIcon size={32} className="text-slate-600 mx-auto" />
                  <p className="text-sm font-bold text-slate-300">Bagan BO3 Belum Tersedia</p>
                  <p className="text-xs text-slate-500">
                    Bagan akan otomatis terbentuk setelah Babak Penyisihan Grup A & B selesai.
                  </p>
                </div>
              ) : (
                <div className="flex gap-4 overflow-x-auto pb-4 items-start">
                  {roundIndices.map((roundIdx) => {
                    const roundMatches = matchesByRound[roundIdx]
                    const roundName = roundMatches[0]?.roundName ?? `Babak ${roundIdx + 1}`
                    const isFinal = roundIdx === roundIndices.length - 1

                    return (
                      <div key={roundIdx} className="w-64 sm:w-72 shrink-0 space-y-3">
                        <div className="text-xs font-black uppercase text-slate-300 flex items-center gap-1.5 px-1">
                          {isFinal ? <TrophyIcon size={13} className="text-amber-400" /> : <SwordsIcon size={13} className="text-teal-400" />}
                          <span>{roundName}</span>
                        </div>

                        <div className="space-y-3">
                          {roundMatches.map((m, mIdx) => {
                            const p1 = getPlayer(m.player1Id)
                            const p2 = getPlayer(m.player2Id)
                            const isP1You = m.player1Id === currentPlayerId
                            const isP2You = m.player2Id === currentPlayerId
                            const isP1Winner = m.winnerId === m.player1Id && m.winnerId !== null
                            const isP2Winner = m.winnerId === m.player2Id && m.winnerId !== null
                            const isActive = m.id === tournamentState.activeMatchId

                            return (
                              <div
                                key={m.id}
                                className={`rounded-2xl p-3 border transition-all ${
                                  isActive
                                    ? 'border-amber-400 bg-amber-950/30 ring-1 ring-amber-400 shadow-lg'
                                    : isP1You || isP2You
                                    ? 'border-teal-500/50 bg-teal-950/20'
                                    : 'border-white/5 bg-slate-900/90'
                                }`}
                              >
                                <div className="flex justify-between items-center text-[10px] mb-2 font-bold text-slate-400">
                                  <span>Match #{mIdx + 1}</span>
                                  {isActive ? (
                                    <span className="text-amber-400 font-black animate-pulse">LIVE DUEL</span>
                                  ) : m.status === 'FINISHED' ? (
                                    <span className="text-emerald-400 font-bold">SELESAI</span>
                                  ) : (
                                    <span className="text-slate-500 font-bold">MENUNGGU</span>
                                  )}
                                </div>

                                {/* P1 */}
                                <div
                                  className={`flex items-center justify-between p-2 rounded-xl text-xs mb-1.5 ${
                                    isP1Winner
                                      ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                      : isP1You
                                      ? 'bg-teal-500/20 text-teal-300 font-bold'
                                      : 'bg-slate-950/60 text-slate-300'
                                  }`}
                                >
                                  <span className="truncate">
                                    {p1 ? p1.name : m.player1Id ? 'Menunggu' : 'Menunggu Pemenang'}
                                    {isP1You && ' (KAMU)'}
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono font-bold">
                                    {isActive && <span>{m.player1Score}</span>}
                                    {isP1Winner && <CheckIcon size={12} className="text-emerald-400" />}
                                  </div>
                                </div>

                                {/* P2 */}
                                <div
                                  className={`flex items-center justify-between p-2 rounded-xl text-xs ${
                                    isP2Winner
                                      ? 'bg-emerald-500/20 text-emerald-300 font-bold'
                                      : isP2You
                                      ? 'bg-teal-500/20 text-teal-300 font-bold'
                                      : 'bg-slate-950/60 text-slate-300'
                                  }`}
                                >
                                  <span className="truncate">
                                    {p2 ? p2.name : m.player2Id ? 'Menunggu' : 'Menunggu Pemenang'}
                                    {isP2You && ' (KAMU)'}
                                  </span>
                                  <div className="flex items-center gap-1.5 font-mono font-bold">
                                    {isActive && <span>{m.player2Score}</span>}
                                    {isP2Winner && <CheckIcon size={12} className="text-emerald-400" />}
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-white/10 bg-slate-900/60 text-center">
          <button
            onClick={onClose}
            className="w-full sm:w-auto bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs py-2.5 px-6 rounded-xl transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

