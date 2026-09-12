'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useGameState } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { playDingSound, playCorrectFanfareSound, playWrongSound } from '@/lib/audio'
import {
  MicIcon,
  MusicIcon,
  UsersIcon,
  TrophyIcon,
  ArrowRightIcon,
  TrashIcon,
  SwordsIcon,
  CrownIcon,
  CheckIcon,
  RefreshIcon,
} from '@/components/shared/Icons'
import { AudioPlayer } from './AudioPlayer'
import { BuzzControlPanel } from './BuzzControlPanel'
import { SongSelector } from './SongSelector'
import { PlayerListPanel } from './PlayerListPanel'
import { TournamentBracket } from './TournamentBracket'
import { Leaderboard } from '@/components/shared/Leaderboard'
import { WaitingRoom } from '@/components/shared/WaitingRoom'
import {
  getGameDisplayName,
  getGameMode,
  getTournamentState,
} from '@/lib/tournament-utils'
import type { Game, Player, Song, RoundType, HostSession, GameMode, TournamentPhase } from '@/lib/types'

interface HostDashboardProps {
  initialGame: Game
  initialPlayers: Player[]
  songs: Song[]
  hostSession: HostSession
}

export function HostDashboard({
  initialGame,
  initialPlayers,
  songs,
  hostSession,
}: HostDashboardProps) {
  const router = useRouter()
  const game = useGameState(initialGame.id, initialGame)
  const players = usePlayers(initialGame.id, initialPlayers)
  const [isLoading, setIsLoading] = useState(false)
  const [tab, setTab] = useState<'bracket' | 'players' | 'leaderboard'>('players')
  const [confirmEndGame, setConfirmEndGame] = useState(false)
  const [feedbackAnim, setFeedbackAnim] = useState<'none' | 'correct' | 'wrong'>('none')

  const gameMode = getGameMode(game)
  const tournamentState = getTournamentState(game)

  const readyPlayerIds = tournamentState?.readyPlayerIds || []
  const readyCount = readyPlayerIds.length
  const totalPlayers = players.length
  const allReady = totalPlayers > 0 && readyCount >= totalPlayers

  // Switch tab to bracket automatically when tournament mode is selected
  useEffect(() => {
    if (gameMode === 'KNOCKOUT') {
      setTab('bracket')
    }
  }, [gameMode])

  const currentSong = songs.find((s) => s.id === game.current_song_id) ?? null
  const buzzWinner = players.find((p) => p.id === game.buzz_winner_id) ?? null

  // Play sound when someone buzzes in
  const lastWinnerRef = useRef<string | null>(null)
  useEffect(() => {
    if (game.buzz_winner_id && game.buzz_winner_id !== lastWinnerRef.current) {
      playDingSound()
    }
    lastWinnerRef.current = game.buzz_winner_id
  }, [game.buzz_winner_id])

  // ── Host API helper ──────────────────────────────────────────────
  const hostAction = useCallback(
    async (action: string, payload?: object) => {
      setIsLoading(true)
      try {
        await fetch(`/api/admin/${game.room_code}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'x-host-password': hostSession.hostPassword,
          },
          body: JSON.stringify({ action, payload }),
        })
      } finally {
        setIsLoading(false)
      }
    },
    [game.room_code, hostSession.hostPassword]
  )

  const handleUpdateScore = useCallback(
    async (playerId: string, score: number) => {
      await hostAction('UPDATE_PLAYER_SCORE', { playerId, score })
    },
    [hostAction]
  )

  const handleResetAllScores = useCallback(async () => {
    await hostAction('RESET_ALL_SCORES')
  }, [hostAction])

  const handleSetGameMode = useCallback(
    async (mode: GameMode) => {
      await hostAction('SET_GAME_MODE', { mode })
    },
    [hostAction]
  )

  const handleGenerateBracket = useCallback(
    async (targetPoints: number) => {
      await hostAction('GENERATE_BRACKET', { targetPoints })
    },
    [hostAction]
  )

  const handleSetActiveMatch = useCallback(
    async (matchId: string) => {
      await hostAction('SET_ACTIVE_MATCH', { matchId })
    },
    [hostAction]
  )

  const handleAdvanceWinner = useCallback(
    async (matchId: string, winnerId: string) => {
      await hostAction('ADVANCE_MATCH_WINNER', { matchId, winnerId })
    },
    [hostAction]
  )

  const handleSetTournamentPhase = useCallback(
    async (phase: TournamentPhase) => {
      await hostAction('SET_TOURNAMENT_PHASE', { phase })
    },
    [hostAction]
  )

  const handleShuffleGroups = useCallback(async () => {
    await hostAction('SHUFFLE_GROUPS')
  }, [hostAction])

  const handleStartGroupA = useCallback(async () => {
    await hostAction('SET_TOURNAMENT_PHASE', { phase: 'GROUP_A' })
  }, [hostAction])

  const handleStartGroupB = useCallback(async () => {
    await hostAction('SET_TOURNAMENT_PHASE', { phase: 'GROUP_B' })
  }, [hostAction])

  const handleResetTournament = useCallback(async () => {
    await hostAction('RESET_TOURNAMENT')
  }, [hostAction])

  const handleEndGame = async () => {
    setIsLoading(true)
    try {
      await fetch(`/api/admin/${game.room_code}`, {
        method: 'DELETE',
        headers: {
          'x-host-password': hostSession.hostPassword,
        },
      })
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(`cg-host-${game.room_code}`)
      }
      router.push('/')
    } catch (err) {
      console.error('Error ending game:', err)
    } finally {
      setIsLoading(false)
      setConfirmEndGame(false)
    }
  }

  // Track previous buzz state and attempt to detect answer evaluations in real-time
  const prevBuzzStateRef = useRef(game.buzz_state)
  const prevAttemptRef = useRef(game.current_attempt)

  // Synchronized sound & visual feedback on Host
  // Triggers ONLY after real-time update arrives from server and gives player screen a slight head-start (350ms)
  // so the player's phone animation has already appeared, completely eliminating audio spoilers.
  useEffect(() => {
    // When answer is evaluated as CORRECT (game transitions to RESULT)
    if (game.buzz_state === 'RESULT' && prevBuzzStateRef.current !== 'RESULT') {
      const t = setTimeout(() => {
        playCorrectFanfareSound()
        setFeedbackAnim('correct')
        setTimeout(() => setFeedbackAnim('none'), 2000)
      }, 350)
      prevBuzzStateRef.current = game.buzz_state
      prevAttemptRef.current = game.current_attempt
      return () => clearTimeout(t)
    }

    // When answer is evaluated as WRONG (attempt increments and state returns to READY)
    if (
      game.buzz_state === 'READY' &&
      (prevBuzzStateRef.current === 'LOCKED' || prevBuzzStateRef.current === 'ANSWERING') &&
      game.current_attempt > prevAttemptRef.current
    ) {
      const t = setTimeout(() => {
        playWrongSound()
        setFeedbackAnim('wrong')
        setTimeout(() => setFeedbackAnim('none'), 1200)
      }, 350)
      prevBuzzStateRef.current = game.buzz_state
      prevAttemptRef.current = game.current_attempt
      return () => clearTimeout(t)
    }

    prevBuzzStateRef.current = game.buzz_state
    prevAttemptRef.current = game.current_attempt
  }, [game.buzz_state, game.current_attempt])

  const answerAction = useCallback(
    async (result: 'CORRECT' | 'WRONG') => {
      setIsLoading(true)
      try {
        await fetch(`/api/admin/${game.room_code}/answer`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-host-password': hostSession.hostPassword,
          },
          body: JSON.stringify({ result }),
        })
      } finally {
        setIsLoading(false)
      }
    },
    [game.room_code, hostSession.hostPassword]
  )

  // ── Waiting Room ──────────────────────────────────────────────────
  if (game.status === 'LOBBY') {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        gameName={game.name}
        players={players}
        isHost={true}
        gameMode={gameMode}
        onSetGameMode={handleSetGameMode}
        onStartGame={() => hostAction('SET_GAME_STATUS', { status: 'ROUND_ACTIVE' })}
        isStarting={isLoading}
      />
    )
  }

  // ── Active Game Dashboard ─────────────────────────────────────────
  return (
    <div
      className={`min-h-screen p-4 sm:p-6 max-w-7xl mx-auto space-y-5 transition-all ${
        feedbackAnim === 'wrong'
          ? 'animate-shake animate-flash-red'
          : feedbackAnim === 'correct'
          ? 'animate-flash-green'
          : ''
      }`}
    >
      {/* Top Command Bar */}
      <div className="glass-panel rounded-3xl p-5 border border-white/10 flex flex-wrap items-center justify-between gap-4 shadow-xl">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-slate-950 shadow-lg shadow-emerald-500/20 shrink-0">
            <MicIcon size={22} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-white font-black text-xl tracking-tight">CG GUESS THE SONG</h1>
              <span className="px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-500/40 text-emerald-400 text-xs font-bold uppercase tracking-wider">
                HOST CONSOLE
              </span>
            </div>
            <p className="text-slate-400 text-xs mt-0.5">
              Room Code: <span className="text-white font-mono font-bold tracking-widest text-sm bg-white/10 px-2 py-0.5 rounded-md ml-1">{game.room_code}</span>
            </p>
          </div>
        </div>

        {/* Right side controls: Mode Switcher + Round switch pills + Selesaikan Game */}
        <div className="flex items-center gap-3 flex-wrap">
          {/* Game Mode Switcher */}
          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shrink-0">
            <button
              type="button"
              onClick={() => handleSetGameMode('CLASSIC')}
              disabled={isLoading}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'CLASSIC'
                  ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <TrophyIcon size={14} />
              <span>Klasik (FFA)</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetGameMode('KNOCKOUT')}
              disabled={isLoading}
              className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-1.5 ${
                gameMode === 'KNOCKOUT'
                  ? 'bg-amber-400 text-slate-950 font-black shadow-md shadow-amber-400/25'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <SwordsIcon size={14} />
              <span>Babak Gugur (1v1)</span>
            </button>
          </div>

          <div className="flex bg-slate-900/90 p-1.5 rounded-2xl border border-white/10 shrink-0">
            {(['GUESS', 'LYRICS'] as RoundType[]).map((r) => (
              <button
                key={r}
                onClick={() => hostAction('SET_ROUND', { round: r })}
                disabled={isLoading}
                className={`px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center gap-2 ${
                  game.current_round === r
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/25'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {r === 'GUESS' ? <MusicIcon size={14} /> : <MicIcon size={14} />}
                <span>{r === 'GUESS' ? 'Tebak Lagu' : 'Sambung Lirik'}</span>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => setConfirmEndGame(true)}
            disabled={isLoading}
            className="px-4 py-2.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 text-xs sm:text-sm font-bold transition-all active:scale-95 flex items-center gap-2"
          >
            <TrashIcon size={14} />
            <span>Selesaikan Permainan</span>
          </button>
        </div>
      </div>

      {/* Confirmation Modal: End Game & Delete Room */}
      {confirmEndGame && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="glass-panel rounded-3xl p-6 sm:p-8 max-w-md w-full border border-rose-500/40 bg-slate-950 shadow-2xl space-y-5 animate-in fade-in zoom-in-95">
            <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-lg shadow-rose-500/20">
              <TrashIcon size={26} />
            </div>

            <div className="text-center space-y-2">
              <h2 className="text-white text-xl sm:text-2xl font-black tracking-tight">
                Selesaikan Permainan?
              </h2>
              <p className="text-slate-400 text-xs sm:text-sm leading-relaxed">
                Tindakan ini akan mengakhiri sesi untuk seluruh pemain dan menghapus seluruh data room, riwayat attempt, serta pemain dari Supabase secara permanen.
              </p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={() => setConfirmEndGame(false)}
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-bold text-sm border border-white/10 transition-colors"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleEndGame}
                disabled={isLoading}
                className="flex-1 py-3 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-black text-sm shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                {isLoading ? 'Menghapus...' : 'Ya, Selesaikan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Active Stage & Duel Header Banner if Knockout Mode is on */}
      {gameMode === 'KNOCKOUT' && (
        <div className="glass-panel rounded-3xl p-5 border border-amber-400/40 bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900/90 shadow-xl flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-amber-400 text-slate-950 flex items-center justify-center font-black shadow-lg shadow-amber-400/20 shrink-0">
              <SwordsIcon size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-amber-400 text-xs font-black uppercase tracking-wider">
                  {(() => {
                    const phase = tournamentState?.phase ?? (tournamentState?.stage === 'GROUP_B' ? 'GROUP_B' : tournamentState?.stage === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP_A')
                    if (phase === 'GROUP_A') return 'BABAK PENYISIHAN • GRUP A'
                    if (phase === 'GROUP_B') return 'BABAK PENYISIHAN • GRUP B'
                    if (phase === 'KNOCKOUT') {
                      return `${tournamentState?.matches.find((m) => m.id === tournamentState.activeMatchId)?.roundName ?? 'Babak Gugur'} • LIVE DUEL`
                    }
                    return 'MODE TURNAMEN'
                  })()}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 text-[10px] font-black uppercase border border-amber-400/30">
                  {(tournamentState?.phase ?? tournamentState?.stage) === 'KNOCKOUT' ? `TARGET: ${tournamentState?.targetPoints ?? 2} POIN (BO3)` : 'TOP 2 LOLOS'}
                </span>
              </div>
              <p className="text-white text-base sm:text-lg font-black mt-0.5">
                {(() => {
                  const phase = tournamentState?.phase ?? (tournamentState?.stage === 'GROUP_B' ? 'GROUP_B' : tournamentState?.stage === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP_A')
                  if (phase === 'GROUP_A') {
                    return `Hanya Grup A yang dapat menekan buzzer. Selesaikan 5–7 lagu untuk klasemen.`
                  }
                  if (phase === 'GROUP_B') {
                    return `Hanya Grup B yang dapat menekan buzzer. Selesaikan 5–7 lagu untuk klasemen.`
                  }
                  if (phase === 'KNOCKOUT') {
                    const am = tournamentState?.matches.find((m) => m.id === tournamentState.activeMatchId)
                    if (!am || !am.player1Id || !am.player2Id) return 'Babak gugur BO3 aktif. Buka tab Bagan Turnamen untuk memilih duel.'
                    const p1 = players.find((p) => p.id === am.player1Id)
                    const p2 = players.find((p) => p.id === am.player2Id)
                    return `${p1?.name ?? 'P1'} (${am.player1Score}) VS ${p2?.name ?? 'P2'} (${am.player2Score})`
                  }
                  return 'Pemain dibagi ke Grup A & B. Mulai babak penyisihan untuk bertanding.'
                })()}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setTab('bracket')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              tab === 'bracket' ? 'bg-amber-400 text-slate-950 font-black' : 'bg-white/10 text-white hover:bg-white/15'
            }`}
          >
            <SwordsIcon size={14} />
            <span>Kelola Turnamen</span>
          </button>
        </div>
      )}

      {/* Main Command Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left column: Music & Tracklist (7 cols) */}
        <div className="lg:col-span-7 space-y-5">
          {/* Live Player Readiness Deck */}
          <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-3.5 shadow-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    allReady ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}
                >
                  <CheckIcon size={16} />
                </div>
                <div>
                  <h4 className="text-white font-black text-sm tracking-tight">Kesiapan Pemain</h4>
                  <p className="text-slate-400 text-xs">
                    {allReady
                      ? 'Semua pemain sudah menekan tombol siap!'
                      : 'Pastikan pemain siap sebelum musik dimulai.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span
                  className={`px-2.5 py-1 rounded-xl text-xs font-mono font-black border ${
                    allReady
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
                  }`}
                >
                  {readyCount} / {totalPlayers} SIAP
                </span>
                <button
                  type="button"
                  onClick={() => hostAction('RESET_READY')}
                  disabled={isLoading || readyCount === 0}
                  title="Minta semua pemain untuk konfirmasi siap kembali"
                  className="px-2.5 py-1 rounded-xl text-xs font-bold bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white border border-white/10 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <RefreshIcon size={12} />
                  <span className="hidden sm:inline">Minta Ready Ulang</span>
                </button>
              </div>
            </div>

            {/* Players readiness chips */}
            <div className="flex flex-wrap gap-2 pt-1">
              {players.map((p) => {
                const isReady = readyPlayerIds.includes(p.id)
                return (
                  <div
                    key={p.id}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isReady
                        ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900/60 border-white/5 text-slate-400 opacity-75'
                    }`}
                  >
                    <span
                      className={`w-2 h-2 rounded-full ${
                        isReady ? 'bg-emerald-400' : 'bg-slate-600'
                      }`}
                    />
                    <span className="truncate max-w-[120px]">{p.name}</span>
                    {isReady && <CheckIcon size={12} className="text-emerald-400 ml-0.5" />}
                  </div>
                )
              })}
              {players.length === 0 && (
                <p className="text-xs text-slate-500 italic">Belum ada pemain bergabung di room.</p>
              )}
            </div>
          </div>

          {/* Audio Player Deck */}
          <AudioPlayer
            audioUrl={currentSong?.audio_url ?? null}
            songTitle={currentSong?.title ?? null}
            songArtist={currentSong?.artist ?? null}
            buzzState={game.buzz_state}
            songId={game.current_song_id}
            readyCount={readyCount}
            totalPlayers={totalPlayers}
            allReady={allReady}
          />

          {/* Next Song Action Banner */}
          {game.buzz_state === 'RESULT' && (
            <div className="glass-panel rounded-3xl p-5 border border-emerald-500/40 bg-emerald-500/10 shadow-lg shadow-emerald-950/40 flex items-center justify-between gap-4 animate-pulse">
              <div>
                <p className="text-emerald-300 font-bold text-sm">Soal telah terjawab!</p>
                <p className="text-slate-300 text-xs">
                  {gameMode === 'KNOCKOUT' ? 'Poin duel telah diperbarui di bagan turnamen.' : 'Poin sudah masuk ke leaderboard.'}
                </p>
              </div>
              <button
                onClick={() => hostAction('NEXT_SONG')}
                disabled={isLoading}
                className="bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-black px-6 py-3 rounded-2xl text-sm transition-all active:scale-95 shadow-lg shadow-emerald-400/20 shrink-0 flex items-center gap-2"
              >
                <span>LANJUT LAGU BERIKUTNYA</span>
                <ArrowRightIcon size={16} />
              </button>
            </div>
          )}

          {/* Tracklist Selector */}
          <SongSelector
            songs={songs}
            currentSongId={game.current_song_id}
            currentRound={game.current_round}
            onSelectSong={(song) => hostAction('SET_CURRENT_SONG', { songId: song.id })}
            onChangeRound={(round) => hostAction('SET_ROUND', { round })}
          />
        </div>

        {/* Right column: Buzzer Controller & Tabs (5 cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Buzzer Console */}
          <BuzzControlPanel
            buzzState={game.buzz_state}
            buzzWinner={buzzWinner}
            currentAttempt={game.current_attempt}
            onEnableBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'READY' })}
            onDisableBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'DISABLED' })}
            onResetBuzz={() => hostAction('SET_BUZZ_STATE', { buzzState: 'READY' })}
            onCorrect={() => answerAction('CORRECT')}
            onWrong={() => answerAction('WRONG')}
            isLoading={isLoading}
          />

          {/* Players & Leaderboard & Tournament Tabs */}
          <div className="glass-panel rounded-3xl overflow-hidden border border-white/10 shadow-xl">
            <div className="flex border-b border-white/5 bg-slate-900/60 p-1.5 gap-1">
              {gameMode === 'KNOCKOUT' && (
                <button
                  key="bracket"
                  onClick={() => setTab('bracket')}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === 'bracket'
                      ? 'bg-amber-400 text-slate-950 font-black shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <SwordsIcon size={14} />
                  <span>Bagan (1v1)</span>
                </button>
              )}
              {(['players', 'leaderboard'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all flex items-center justify-center gap-1.5 ${
                    tab === t
                      ? 'bg-white/10 text-white shadow-sm'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {t === 'players' ? <UsersIcon size={14} /> : <TrophyIcon size={14} />}
                  <span>{t === 'players' ? `Pemain (${players.length})` : 'Klasemen'}</span>
                </button>
              ))}
            </div>
            <div className="p-4">
              {tab === 'bracket' && gameMode === 'KNOCKOUT' && (
                <TournamentBracket
                  tournamentState={tournamentState}
                  players={players}
                  onSetTournamentPhase={handleSetTournamentPhase}
                  onSetActiveMatch={handleSetActiveMatch}
                  onAdvanceWinner={handleAdvanceWinner}
                  onGenerateBracket={handleGenerateBracket}
                  onShuffleGroups={handleShuffleGroups}
                  onStartGroupA={handleStartGroupA}
                  onStartGroupB={handleStartGroupB}
                  onResetTournament={handleResetTournament}
                  isLoading={isLoading}
                />
              )}
              {tab === 'players' && (
                <PlayerListPanel
                  players={players}
                  onUpdateScore={handleUpdateScore}
                  onResetAllScores={handleResetAllScores}
                  isLoading={isLoading}
                />
              )}
              {tab === 'leaderboard' && (
                <Leaderboard players={players} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
