'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { useGameState, broadcastFastBuzz } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { usePresence } from '@/lib/hooks/usePresence'
import { playDingSound, playCorrectFanfareSound, playWrongSound } from '@/lib/audio'
import { BuzzButton } from './BuzzButton'
import { CountdownOverlay } from '@/components/shared/CountdownOverlay'
import { Leaderboard } from '@/components/shared/Leaderboard'
import { WaitingRoom } from '@/components/shared/WaitingRoom'
import { TournamentBracketModal } from './TournamentBracketModal'
import {
  MicIcon,
  LockIcon,
  TrophyIcon,
  MusicIcon,
  DiscIcon,
  CheckIcon,
  CrossIcon,
  SwordsIcon,
  CrownIcon,
  UsersIcon,
} from '@/components/shared/Icons'
import {
  getGameDisplayName,
  getGameMode,
  getTournamentState,
} from '@/lib/tournament-utils'
import type { Game, Player, PlayerSession, TournamentPhase } from '@/lib/types'

interface PlayerGameProps {
  initialGame: Game
  initialPlayers: Player[]
  session: PlayerSession
}

export function PlayerGame({ initialGame, initialPlayers, session }: PlayerGameProps) {
  const router = useRouter()
  const game = useGameState(initialGame.id, initialGame)
  const players = usePlayers(initialGame.id, initialPlayers)

  const [isBuzzing, setIsBuzzing] = useState(false)
  const isBuzzingRef = useRef(false) // mirrors isBuzzing so effects can read it without re-subscribing
  const [localWinner, setLocalWinner] = useState<boolean | null>(null)
  const [localWinnerName, setLocalWinnerName] = useState<string | null>(null)
  const [revealedSong, setRevealedSong] = useState<{ title: string; artist: string } | null>(null)
  const [loadingSong, setLoadingSong] = useState(false)
  const [feedbackData, setFeedbackData] = useState<{
    type: 'none' | 'correct' | 'wrong'
    isMe: boolean
    winnerName: string
    isAllWrong?: boolean
  }>({ type: 'none', isMe: false, winnerName: '' })
  const feedbackTimerRef = useRef<NodeJS.Timeout | null>(null)

  const closeFeedback = useCallback(() => {
    if (feedbackTimerRef.current) {
      clearTimeout(feedbackTimerRef.current)
      feedbackTimerRef.current = null
    }
    setFeedbackData((prev) => ({ ...prev, type: 'none' }))
  }, [])

  const triggerFeedback = useCallback(
    (type: 'correct' | 'wrong', isMe: boolean, winnerName: string, isAllWrong?: boolean) => {
      if (feedbackTimerRef.current) {
        clearTimeout(feedbackTimerRef.current)
        feedbackTimerRef.current = null
      }

      setFeedbackData({ type, isMe, winnerName, isAllWrong })

      if (type === 'correct') {
        playCorrectFanfareSound()
      } else {
        playWrongSound()
      }

      const duration = type === 'correct' ? 1200 : 900
      feedbackTimerRef.current = setTimeout(() => {
        setFeedbackData((prev) => ({ ...prev, type: 'none' }))
        feedbackTimerRef.current = null
      }, duration)
    },
    []
  )
  const [showBracketModal, setShowBracketModal] = useState(false)

  const gameMode = getGameMode(game)
  const tournamentState = getTournamentState(game)

  const prevBuzzStateRef = useRef(game.buzz_state)
  const prevAttemptRef = useRef(game.current_attempt)
  const lastWinnerPlayerRef = useRef<string | null>(null)

  const countdownEndTime = tournamentState?.countdownEndTime ?? null
  const isCountingDown = typeof countdownEndTime === 'number' && countdownEndTime > Date.now()

  // Track who was the active buzzing player before evaluate
  useEffect(() => {
    if (game.buzz_winner_id) {
      const winner = players.find((p) => p.id === game.buzz_winner_id)
      if (winner) lastWinnerPlayerRef.current = winner.name
    }
  }, [game.buzz_winner_id, players])

  const isAllWrong = tournamentState?.lastSongOutcome === 'ALL_WRONG'

  const lastResultFeedbackTimeRef = useRef(0)
  const lastWrongFeedbackTimeRef = useRef(0)
  // Deduplicate result feedback so it NEVER plays twice for the same song outcome
  const lastHandledResultKeyRef = useRef<string | null>(null)

  // Sound & Visual Feedback fallback for reconnecting clients or delayed updates
  useEffect(() => {
    // RESULT state: fallback if not already handled via instant WebSocket broadcast
    if (game.buzz_state === 'RESULT') {
      const outcome = tournamentState?.lastSongOutcome
      if (!outcome) return

      const resultKey = `${game.current_song_id || 'song'}_${outcome}`
      if (lastHandledResultKeyRef.current === resultKey) return

      const now = Date.now()
      if (now - lastResultFeedbackTimeRef.current > 2000) {
        lastResultFeedbackTimeRef.current = now
        lastHandledResultKeyRef.current = resultKey
        prevBuzzStateRef.current = game.buzz_state
        prevAttemptRef.current = game.current_attempt

        const isMe = localWinner === true || game.buzz_winner_id === session.playerId
        const wp = players.find((p) => p.id === game.buzz_winner_id)
        const winnerName = lastWinnerPlayerRef.current || wp?.name || localWinnerName || 'Pemain Lain'

        if (outcome === 'ALL_WRONG') {
          triggerFeedback('wrong', false, winnerName, true)
        } else {
          triggerFeedback('correct', isMe, winnerName, false)
        }
      }
    }

    // When attempt increases after locked/answering state (Answer evaluated as WRONG — buzzer re-opened)
    if (
      game.buzz_state === 'READY' &&
      (prevBuzzStateRef.current === 'LOCKED' || prevBuzzStateRef.current === 'ANSWERING') &&
      game.current_attempt > prevAttemptRef.current
    ) {
      const now = Date.now()
      if (now - lastWrongFeedbackTimeRef.current > 2000) {
        lastWrongFeedbackTimeRef.current = now
        prevBuzzStateRef.current = game.buzz_state
        prevAttemptRef.current = game.current_attempt

        const isMe = localWinner === true || game.buzz_winner_id === session.playerId
        const wp = players.find((p) => p.id === game.buzz_winner_id)
        const winnerName = lastWinnerPlayerRef.current || wp?.name || localWinnerName || 'Pemain Lain'
        triggerFeedback('wrong', isMe, winnerName, false)
      }
    }

    // Auto-close popup immediately whenever buzz_state transitions away from RESULT
    if (prevBuzzStateRef.current === 'RESULT' && game.buzz_state !== 'RESULT') {
      closeFeedback()
    }

    prevBuzzStateRef.current = game.buzz_state
    prevAttemptRef.current = game.current_attempt
  }, [game.buzz_state, game.current_attempt, game.current_song_id, tournamentState?.lastSongOutcome, triggerFeedback, closeFeedback, localWinner, game.buzz_winner_id, session.playerId, players, localWinnerName])

  // Fetch revealed song details when game enters RESULT state
  useEffect(() => {
    if (game.buzz_state === 'RESULT' && game.room_code) {
      setLoadingSong(true)
      fetch(`/api/games/${game.room_code}/song`)
        .then((res) => res.json())
        .then((data) => {
          if (data.revealed && data.song) {
            setRevealedSong(data.song)
          }
        })
        .catch((err) => console.error('Error fetching song reveal:', err))
        .finally(() => setLoadingSong(false))
    } else if (game.buzz_state !== 'RESULT') {
      setRevealedSong(null)
    }
  }, [game.buzz_state, game.room_code, game.current_song_id])

  // Reset local state whenever the buzz winner is cleared (NEXT_SONG, RESET, etc.)
  useEffect(() => {
    if (game.buzz_winner_id === null) {
      setLocalWinner(null)
      setLocalWinnerName(null)
      isBuzzingRef.current = false
      setIsBuzzing(false)
    }
  }, [game.buzz_winner_id])

  // Also reset local state when buzz_state goes back to READY or DISABLED
  // This prevents the "buzzer terkunci" screen from being stuck after a WRONG evaluation
  useEffect(() => {
    if (game.buzz_state === 'READY' || game.buzz_state === 'DISABLED') {
      setLocalWinner(null)
      setLocalWinnerName(null)
      isBuzzingRef.current = false
      setIsBuzzing(false)
    }
  }, [game.buzz_state])

  // Reset local state when the song changes so state from previous song doesn't bleed through
  useEffect(() => {
    setLocalWinner(null)
    setLocalWinnerName(null)
    isBuzzingRef.current = false
    setIsBuzzing(false)
    setLocalExcluded(false)
    iWasWinnerRef.current = false
    lastHandledResultKeyRef.current = null
  }, [game.current_song_id])

  // Sync local winner state immediately when buzz_winner_id arrives from DB / broadcast
  useEffect(() => {
    if (game.buzz_winner_id) {
      if (game.buzz_winner_id === session.playerId) {
        if (!isBuzzingRef.current) {
          setLocalWinner(true)
        }
      } else {
        setLocalWinner(false)
        const wp = players.find((p) => p.id === game.buzz_winner_id)
        if (wp) setLocalWinnerName(wp.name)
      }
    }
  }, [game.buzz_winner_id, session.playerId, players])

  // ── Instant Exclusion & Reset: 0ms real-time event listener ──────────
  const iWasWinnerRef = useRef(false)
  const [localExcluded, setLocalExcluded] = useState(false)

  // Mark ref when DB confirms or local optimistic confirms us as winner
  useEffect(() => {
    if (localWinner === true || (game.buzz_winner_id === session.playerId && !isBuzzingRef.current)) {
      iWasWinnerRef.current = true
    }
  }, [game.buzz_winner_id, localWinner, session.playerId])

  // When buzzer is completely reset (READY with attempt 1 and no winner), unlock all local exclusions
  useEffect(() => {
    if (game.buzz_state === 'READY' && game.buzz_winner_id === null && game.current_attempt === 1) {
      setLocalExcluded(false)
      iWasWinnerRef.current = false
    }
  }, [game.buzz_state, game.buzz_winner_id, game.current_attempt])

  // Listen directly to ultra-fast broadcast signals dispatched by useGameState
  useEffect(() => {
    const handleBroadcast = (e: Event) => {
      const msg = (e as CustomEvent).detail
      if (!msg) return

      if (msg.type === 'HOST_ACTION') {
        if (msg.action === 'ANSWER_RESULT') {
          const isCorrect = msg.payload?.result === 'CORRECT'
          const wrongPlayerId = msg.payload?.wrongPlayerId

          if (isCorrect) {
            const isMe = msg.payload?.winnerId === session.playerId || localWinner === true
            const winnerName = msg.payload?.winnerName || (isMe ? session.playerName : 'Pemain Lain')
            lastHandledResultKeyRef.current = `${game.current_song_id || 'song'}_CORRECT`
            lastResultFeedbackTimeRef.current = Date.now()

            triggerFeedback('correct', isMe, winnerName, false)

            if (msg.payload?.revealedSong) {
              setRevealedSong(msg.payload.revealedSong)
            }
          } else {
            const isMe = wrongPlayerId === session.playerId
            const winnerName = msg.payload?.winnerName || (isMe ? session.playerName : 'Pemain Lain')
            const allWrong = !!msg.payload?.allWrong

            if (isMe) {
              // We answered wrong! Instantly exclude buzzer with 0ms delay!
              setLocalExcluded(true)
              iWasWinnerRef.current = false
            }

            if (allWrong) {
              setLocalExcluded(false)
              iWasWinnerRef.current = false
              lastHandledResultKeyRef.current = `${game.current_song_id || 'song'}_ALL_WRONG`
            }

            lastWrongFeedbackTimeRef.current = Date.now()
            triggerFeedback('wrong', isMe, winnerName, allWrong)

            if (msg.payload?.revealedSong) {
              setRevealedSong(msg.payload.revealedSong)
            }
          }
        } else if (msg.action === 'ALL_WRONG') {
          setLocalExcluded(false)
          iWasWinnerRef.current = false
          lastHandledResultKeyRef.current = `${game.current_song_id || 'song'}_ALL_WRONG`
          if (msg.payload?.revealedSong) {
            setRevealedSong(msg.payload.revealedSong)
          }
        } else if (msg.action === 'RESET_BUZZ') {
          // Full reset from host — unlock everything instantly
          setLocalExcluded(false)
          setLocalWinner(null)
          setLocalWinnerName(null)
          isBuzzingRef.current = false
          setIsBuzzing(false)
          iWasWinnerRef.current = false
          closeFeedback()
        } else if (msg.action === 'NEXT_SONG') {
          closeFeedback()
          setRevealedSong(null)
        }
      }
    }

    window.addEventListener(`game-broadcast:${initialGame.id}`, handleBroadcast)
    return () => {
      window.removeEventListener(`game-broadcast:${initialGame.id}`, handleBroadcast)
    }
  }, [initialGame.id, session.playerId, session.playerName, game.current_song_id, localWinner, triggerFeedback, closeFeedback])

  // Track online presence
  usePresence(initialGame.id, session.playerId, session.playerName, session.sessionToken)

  const me = players.find((p) => p.id === session.playerId)
  // isWinner is true when DB confirms it, or immediately when local confirmation arrives
  const isWinner =
    localWinner === true ||
    (!isBuzzing && game.buzz_winner_id === session.playerId && localWinner !== false)
  // isExcluded includes instant local state so button disables immediately without waiting for DB
  const isExcluded = Boolean((me && me.excluded_attempt !== null) || localExcluded)
  const buzzWinnerPlayer = players.find((p) => p.id === game.buzz_winner_id)

  // Tournament state helpers
  const phase: TournamentPhase =
    tournamentState?.phase ??
    (tournamentState?.stage === 'GROUP_B'
      ? 'GROUP_B'
      : tournamentState?.stage === 'KNOCKOUT'
      ? 'KNOCKOUT'
      : 'GROUP_A')

  const groupAIds = tournamentState?.groupAPlayerIds || tournamentState?.groupA?.playerIds || []
  const groupBIds = tournamentState?.groupBPlayerIds || tournamentState?.groupB?.playerIds || []
  const inGroupA = Boolean(groupAIds.includes(session.playerId))
  const inGroupB = Boolean(groupBIds.includes(session.playerId))
  const myGroup = inGroupA ? 'A' : inGroupB ? 'B' : null

  const activeMatch = tournamentState?.matches.find((m) => m.id === tournamentState.activeMatchId)
  const isDuelist = Boolean(
    gameMode === 'KNOCKOUT' &&
    phase === 'KNOCKOUT' &&
    activeMatch &&
    (activeMatch.player1Id === session.playerId || activeMatch.player2Id === session.playerId)
  )
  const isP1 = activeMatch?.player1Id === session.playerId
  const myDuelScore = isP1 ? activeMatch?.player1Score ?? 0 : activeMatch?.player2Score ?? 0
  const oppDuelScore = isP1 ? activeMatch?.player2Score ?? 0 : activeMatch?.player1Score ?? 0
  const opponentId = isP1 ? activeMatch?.player2Id : activeMatch?.player1Id
  const opponentPlayer = players.find((p) => p.id === opponentId)

  // Can this player play/buzz right now?
  const canPlayInTournament = Boolean(
    gameMode !== 'KNOCKOUT' ||
    (phase === 'GROUP_A' && inGroupA) ||
    (phase === 'GROUP_B' && inGroupB) ||
    (phase === 'KNOCKOUT' && isDuelist)
  )

  const isEliminated = Boolean(
    gameMode === 'KNOCKOUT' &&
    phase === 'KNOCKOUT' &&
    (!tournamentState?.matches.some(
      (m) => m.player1Id === session.playerId || m.player2Id === session.playerId
    ) ||
      tournamentState?.matches.some(
        (m) =>
          m.status === 'FINISHED' &&
          (m.player1Id === session.playerId || m.player2Id === session.playerId) &&
          m.winnerId !== session.playerId
      ))
  )

  const isQualifiedToKnockout = Boolean(
    gameMode === 'KNOCKOUT' &&
    tournamentState?.matches.some(
      (m) => m.player1Id === session.playerId || m.player2Id === session.playerId
    )
  )

  const upcomingMatch = tournamentState?.matches.find(
    (m) =>
      m.status === 'UPCOMING' &&
      (m.player1Id === session.playerId || m.player2Id === session.playerId)
  )

  const handleBuzz = async (): Promise<boolean> => {
    if (isBuzzing || game.buzz_state !== 'READY' || isExcluded) return false
    setIsBuzzing(true)
    isBuzzingRef.current = true

    // 0ms ultra-fast broadcast to Host and all players via WebSocket
    broadcastFastBuzz(game.id, {
      type: 'BUZZ_WINNER',
      winnerId: session.playerId,
      winnerName: session.playerName,
    })

    try {
      const res = await fetch(`/api/admin/${game.room_code}/buzz`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-session-token': session.sessionToken,
        },
        body: JSON.stringify({ playerId: session.playerId }),
      })
      const data = await res.json()
      if (!res.ok) {
        console.error('Buzz rejected:', data?.error || res.status)
        setLocalWinner(false)
        iWasWinnerRef.current = false
        return false
      }
      if (data.winner === true) {
        // Authoritative lock confirmed by database row lock
        setLocalWinner(true)
        iWasWinnerRef.current = true
        playDingSound()
        return true
      }
      // Another player won the lock
      setLocalWinner(false)
      iWasWinnerRef.current = false
      const matched = players.find((p) => p.id === data.winnerId)
      setLocalWinnerName(data.winnerName || matched?.name || 'Pemain Lain')
      // Correct the broadcast with actual DB winner
      broadcastFastBuzz(game.id, {
        type: 'BUZZ_WINNER',
        winnerId: data.winnerId,
        winnerName: data.winnerName || matched?.name || 'Pemain Lain',
      })
      return false
    } catch (err) {
      console.error('Buzz error:', err)
      setLocalWinner(false)
      iWasWinnerRef.current = false
      return false
    } finally {
      isBuzzingRef.current = false
      setIsBuzzing(false)
    }
  }

  // ── Dedicated High-Energy Feedback Overlay (Correct / Wrong) ───
  const renderFeedbackOverlay = () => {
    if (feedbackData.type === 'none') return null

    const { isMe, winnerName, isAllWrong } = feedbackData

    if (feedbackData.type === 'correct') {
      return (
        <div
          onClick={closeFeedback}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
        >
          <div className="flex flex-col items-center text-center space-y-4 max-w-xs animate-pop-in">
            {/* Glowing Emerald Dome & Sparkles */}
            <div className="relative">
              <div className="absolute -inset-6 bg-emerald-500/30 rounded-full blur-2xl animate-pulse" />
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-emerald-500 via-teal-400 to-emerald-300 p-1 flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.7)] animate-bounce">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-emerald-400">
                  <CheckIcon size={56} />
                </div>
              </div>
              {/* Sparkle ping accents */}
              <div className="absolute -top-2 -left-2 w-3.5 h-3.5 bg-amber-300 rounded-full animate-ping" />
              <div className="absolute -bottom-1 -right-2 w-4 h-4 bg-emerald-400 rounded-full animate-ping" style={{ animationDelay: '200ms' }} />
              <div className="absolute top-1/2 -left-5 w-3 h-3 bg-cyan-300 rounded-full animate-ping" style={{ animationDelay: '400ms' }} />
              <div className="absolute top-1/2 -right-5 w-3 h-3 bg-teal-300 rounded-full animate-ping" style={{ animationDelay: '600ms' }} />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-3 py-1 rounded-full bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-400/40">
                JAWABAN BENAR!
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                {isMe ? 'KAMU BENAR!' : 'TEBAKAN TEPAT!'}
              </h2>
              <p className="text-emerald-300 font-bold text-sm">
                {isMe
                  ? (gameMode === 'KNOCKOUT' ? '+1 Poin Duel masuk ke skormu!' : 'Hebat! Poin bertambah ke skormu!')
                  : `${winnerName} berhasil menebak lagu ini!`}
              </p>
              <span className="text-[11px] text-slate-400/80 font-medium block pt-1">
                (Ketuk layar untuk menutup)
              </span>
            </div>
          </div>
        </div>
      )
    }

    if (feedbackData.type === 'wrong') {
      return (
        <div
          onClick={closeFeedback}
          className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/85 backdrop-blur-md animate-in fade-in duration-150 select-none cursor-pointer"
        >
          <div className="flex flex-col items-center text-center space-y-4 max-w-xs animate-shake">
            {/* Glowing Red Rose Dome */}
            <div className="relative">
              <div className="absolute -inset-6 bg-rose-600/40 rounded-full blur-2xl animate-pulse" />
              <div className="w-28 h-28 rounded-full bg-gradient-to-tr from-rose-600 via-red-500 to-rose-400 p-1 flex items-center justify-center shadow-[0_0_50px_rgba(244,63,94,0.8)]">
                <div className="w-full h-full rounded-full bg-slate-950 flex items-center justify-center text-rose-500">
                  <CrossIcon size={56} />
                </div>
              </div>
              <div className="absolute -top-1 -right-2 w-4 h-4 bg-rose-400 rounded-full animate-ping" />
              <div className="absolute -bottom-2 -left-2 w-3.5 h-3.5 bg-red-400 rounded-full animate-ping" style={{ animationDelay: '300ms' }} />
            </div>

            <div className="space-y-1.5">
              <span className="inline-block px-3 py-1 rounded-full bg-rose-500 text-slate-950 font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-500/40">
                JAWABAN SALAH!
              </span>
              <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight drop-shadow-md">
                {isAllWrong
                  ? 'TIDAK TERTEBAK!'
                  : isMe
                  ? 'KAMU SALAH!'
                  : 'KURANG TEPAT!'}
              </h2>
              <p className="text-rose-300 font-bold text-sm">
                {isAllWrong
                  ? 'Tidak ada yang berhasil menebak lagu ini.'
                  : isMe
                  ? 'Poin dikurangi & kesempatanmu hangus untuk lagu ini.'
                  : `${winnerName} salah jawab! Buzzer dibuka kembali, siap-siap!`}
              </p>
              <span className="text-[11px] text-slate-400/80 font-medium block pt-1">
                (Ketuk layar untuk menutup)
              </span>
            </div>
          </div>
        </div>
      )
    }

    return null
  }

  // ── Waiting Room ─────────────────────────────────────────────────
  if (game.status === 'LOBBY') {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        gameName={game.name}
        players={players}
        isHost={false}
        gameMode={gameMode}
      />
    )
  }

  // ── FINAL_RESULT state (Game ended / room deleted) ─────────────
  if (game.status === 'FINAL_RESULT') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-5 sm:p-6 text-center relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
        <div className="absolute inset-0 bg-amber-500/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-sm space-y-6 relative z-10 py-6">
          <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-amber-400/20 to-amber-600/10 border-2 border-amber-400/40 flex items-center justify-center text-amber-400 mx-auto shadow-2xl shadow-amber-500/30 animate-bounce">
            <TrophyIcon size={40} />
          </div>

          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-widest mb-2 shadow-lg shadow-amber-400/30">
              PERMAINAN SELESAI
            </div>
            <h1 className="text-white text-3xl sm:text-4xl font-black tracking-tight">
              Terima Kasih Telah Bermain!
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Host telah menyelesaikan sesi permainan ini.
            </p>
          </div>

          {/* Final Standings */}
          <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-2xl text-left">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-2 text-center">
              Klasemen Akhir
            </p>
            <Leaderboard players={players} highlightId={session.playerId} />
          </div>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem(`cg-session-${game.room_code}`)
              }
              router.push('/')
            }}
            className="w-full py-3.5 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-bold text-sm border border-white/10 transition-all active:scale-95 shadow-lg"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    )
  }

  // ── LOCKED: This player won ─────────────────────────────────────
  if ((game.buzz_state === 'LOCKED' || game.buzz_state === 'ANSWERING') && isWinner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-gradient-to-b from-emerald-950/60 via-slate-900 to-black">
        {renderFeedbackOverlay()}
        <TournamentBracketModal
          isOpen={showBracketModal}
          onClose={() => setShowBracketModal(false)}
          tournamentState={tournamentState}
          players={players}
          currentPlayerId={session.playerId}
        />
        <div className="relative z-10 space-y-6 max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-emerald-400 text-slate-950 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-400/40 animate-pulse">
            <MicIcon size={44} />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest mb-2 shadow-lg shadow-emerald-400/30">
              {gameMode === 'KNOCKOUT' && game.current_attempt > 1
                ? 'GILIRAN BONUS (LAWAN SALAH)!'
                : 'KAMU PALING CEPAT!'}
            </div>
            <h1 className="text-white text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              GILIRAN KAMU!
            </h1>
            <p className="text-emerald-300 text-lg font-bold mt-1">
              {gameMode === 'KNOCKOUT' && game.current_attempt > 1
                ? 'Lawan salah menjawab, langsung sebutkan jawabanmu sekarang!'
                : 'Sebutkan jawabanmu secara lisan sekarang!'}
            </p>
          </div>

          <div className="glass-panel rounded-3xl p-5 border border-emerald-500/30 shadow-xl">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">
              {gameMode === 'KNOCKOUT' ? 'Skor Duel 1v1 Kamu' : 'Skor Kamu Saat Ini'}
            </p>
            <p className="text-emerald-400 text-4xl font-black font-mono mt-1">
              {gameMode === 'KNOCKOUT' ? myDuelScore : me?.score ?? 0}{' '}
              <span className="text-base text-slate-400 font-semibold">pts</span>
            </p>
          </div>

          {gameMode !== 'KNOCKOUT' && (
            <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-2xl text-left">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 text-center">
                Peringkat Sementara
              </p>
              <Leaderboard players={players} highlightId={session.playerId} />
            </div>
          )}

          <p className="text-slate-500 text-xs animate-pulse">
            Host sedang mendengarkan jawabanmu...
          </p>
        </div>
      </div>
    )
  }

  // ── LOCKED: Someone else won ────────────────────────────────────
  if ((game.buzz_state === 'LOCKED' || game.buzz_state === 'ANSWERING') && !isWinner && !isBuzzing) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
        {renderFeedbackOverlay()}
        <TournamentBracketModal
          isOpen={showBracketModal}
          onClose={() => setShowBracketModal(false)}
          tournamentState={tournamentState}
          players={players}
          currentPlayerId={session.playerId}
        />
        <div className="relative z-10 space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center mx-auto shadow-2xl">
            <LockIcon size={36} className="text-slate-400" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-widest">
              BUZZER TERKUNCI
            </span>
            <h1 className="text-white text-3xl font-black tracking-tight mt-3">
              {buzzWinnerPlayer?.name || localWinnerName || 'Pemain Lain'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              {gameMode === 'KNOCKOUT' && game.current_attempt > 1
                ? 'Mendapat giliran menjawab langsung setelah percobaan pertama!'
                : 'Memencet buzzer lebih dulu!'}
            </p>
          </div>

          <div className="glass-panel rounded-3xl p-5 border border-white/5 shadow-xl">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">
              {gameMode === 'KNOCKOUT' ? 'Skor Duel Kamu' : 'Skor Kamu'}
            </p>
            <p className="text-white text-3xl font-black font-mono mt-1">
              {gameMode === 'KNOCKOUT' ? myDuelScore : me?.score ?? 0}{' '}
              <span className="text-sm text-slate-500 font-semibold">pts</span>
            </p>
          </div>

          {gameMode !== 'KNOCKOUT' && (
            <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-2xl text-left max-h-56 overflow-y-auto">
              <p className="text-slate-400 text-xs font-bold uppercase tracking-wider mb-3 text-center">
                Peringkat Sementara
              </p>
              <Leaderboard players={players} highlightId={session.playerId} />
            </div>
          )}

          <p className="text-slate-500 text-xs">
            Tunggu evaluasi host (Benar / Salah)...
          </p>
        </div>
      </div>
    )
  }

  // ── RESULT state ────────────────────────────────────────────────
  if (game.buzz_state === 'RESULT') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-start p-4 sm:p-6 relative overflow-y-auto">
        {renderFeedbackOverlay()}
        <TournamentBracketModal
          isOpen={showBracketModal}
          onClose={() => setShowBracketModal(false)}
          tournamentState={tournamentState}
          players={players}
          currentPlayerId={session.playerId}
        />
        <div className="w-full max-w-sm space-y-3 relative z-10 py-2">
          {/* Revealed Song Title & Artist Header (Compact & Clean) */}
          <div
            className={`glass-panel rounded-2xl p-3 border shadow-xl flex items-center gap-3 relative overflow-hidden ${
              isAllWrong
                ? 'border-rose-500/40 bg-gradient-to-r from-rose-950/70 via-slate-900 to-slate-950'
                : 'border-emerald-500/40 bg-gradient-to-r from-emerald-950/70 via-slate-900 to-slate-950'
            }`}
          >
            <div
              className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-2xl pointer-events-none ${
                isAllWrong ? 'bg-rose-500/15' : 'bg-emerald-500/15'
              }`}
            />

            <div
              className={`w-11 h-11 rounded-xl border flex items-center justify-center shrink-0 shadow-md ${
                isAllWrong
                  ? 'bg-rose-500/20 border-rose-400/30 text-rose-400'
                  : 'bg-emerald-500/20 border-emerald-400/30 text-emerald-400'
              }`}
            >
              <DiscIcon size={22} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 mb-0.5">
                <span
                  className={`inline-block px-2 py-0.5 rounded-full font-black text-[9px] uppercase tracking-wider ${
                    isAllWrong
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                  }`}
                >
                  {isAllWrong ? 'TIDAK TERTEBAK' : 'LAGU TERTEBAK'}
                </span>
              </div>
              <h2 className="text-white font-black text-sm sm:text-base truncate leading-tight">
                {revealedSong?.title || (loadingSong ? 'Memuat Judul...' : isAllWrong ? 'Lagu Tidak Tertebak' : 'Lagu Tertebak')}
              </h2>
              {revealedSong?.artist && (
                <p className="text-slate-400 font-semibold text-xs truncate">
                  {revealedSong.artist}
                </p>
              )}
            </div>
          </div>

          {/* Tournament Knockout duel summary (if Knockout mode) */}
          {gameMode === 'KNOCKOUT' && activeMatch && (
            <div className="glass-panel rounded-2xl p-2.5 border border-amber-500/30 bg-amber-950/20 shadow-lg flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-slate-400 text-[9px] uppercase font-bold">{activeMatch.roundName}</p>
                <p className="text-xs font-black text-white truncate mt-0.5">
                  {players.find((p) => p.id === activeMatch.player1Id)?.name ?? 'P1'} ({activeMatch.player1Score})
                  {' VS '}
                  {players.find((p) => p.id === activeMatch.player2Id)?.name ?? 'P2'} ({activeMatch.player2Score})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowBracketModal(true)}
                className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-[10px] shrink-0 flex items-center gap-1 transition-all active:scale-95 shadow-md shadow-amber-400/20"
              >
                <SwordsIcon size={12} />
                <span>Bagan Turnamen</span>
              </button>
            </div>
          )}

          {/* Klasemen Sementara (Langsung Tampil Paling Depan!) */}
          <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-2xl space-y-2.5">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <TrophyIcon size={16} className="text-amber-400" />
                <h3 className="text-white text-xs font-black tracking-wider uppercase">
                  Klasemen Skor Sementara
                </h3>
              </div>
              <span className="text-[10px] font-bold text-slate-400 bg-white/5 px-2 py-0.5 rounded-full border border-white/10">
                Ronde {game.current_round === 'GUESS' ? '1' : '2'}
              </span>
            </div>

            <div className="max-h-64 sm:max-h-72 overflow-y-auto pr-0.5">
              <Leaderboard players={players} highlightId={session.playerId} />
            </div>
          </div>

          {/* Menunggu Host Banner */}
          <div className="text-center pt-1 pb-2">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-slate-900 border border-white/10 text-slate-400 text-[11px] animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Menunggu Host Memutar Lagu Selanjutnya...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Tournament Spectator / Waiting View (if player cannot buzz in the current stage) ─────
  if (gameMode === 'KNOCKOUT' && !canPlayInTournament) {
    const activeP1 = players.find((p) => p.id === activeMatch?.player1Id)
    const activeP2 = players.find((p) => p.id === activeMatch?.player2Id)

    return (
      <div className="min-h-screen flex flex-col justify-between p-4 sm:p-6 select-none relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
        {renderFeedbackOverlay()}
        <TournamentBracketModal
          isOpen={showBracketModal}
          onClose={() => setShowBracketModal(false)}
          tournamentState={tournamentState}
          players={players}
          currentPlayerId={session.playerId}
        />

        {/* Top Header Panel */}
        <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-lg relative z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-amber-400 to-amber-600 flex items-center justify-center text-lg font-black text-slate-950 shadow-md shadow-amber-500/20 shrink-0">
                {session.playerName.charAt(0).toUpperCase()}
              </div>
              <div className="truncate">
                <p className="text-white font-extrabold text-sm truncate leading-tight">{session.playerName}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shadow-sm" />
                  <span className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">
                    {phase === 'GROUP_A'
                      ? 'Grup B • Menonton Grup A'
                      : phase === 'GROUP_B'
                      ? 'Grup A • Menonton Grup B'
                      : isEliminated
                      ? 'Gugur • Penonton'
                      : upcomingMatch
                      ? 'Menunggu Duelmu'
                      : 'Penonton Turnamen'}
                  </span>
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowBracketModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
            >
              <SwordsIcon size={13} />
              <span>Bagan & Grup</span>
            </button>
          </div>
        </div>

        {/* Center Content based on Stage */}
        <div className="my-auto py-6 relative z-10 text-center space-y-5 max-w-sm mx-auto w-full">
          {phase === 'GROUP_A' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-teal-500/20 border border-teal-500/30 flex items-center justify-center text-teal-400 mx-auto shadow-xl animate-pulse">
                <MusicIcon size={32} />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-teal-400/20 border border-teal-400/40 text-teal-300 text-[10px] font-black uppercase tracking-widest">
                  PENYISIHAN GRUP A
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Grup A Sedang Bermain
                </h2>
                <p className="text-slate-300 text-xs font-semibold">
                  Kamu berada di <strong className="text-teal-300">Grup B</strong>.
                </p>
                <p className="text-slate-400 text-xs max-w-xs mx-auto">
                  Hanya anggota Grup A yang dapat menekan buzzer. Bersiaplah, giliran Grup B akan tiba berikutnya!
                </p>
              </div>
            </>
          )}

          {phase === 'GROUP_B' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-xl">
                <UsersIcon size={32} />
              </div>
              <div className="space-y-2">
                <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest">
                  PENYISIHAN GRUP B
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  Grup B Sedang Bermain
                </h2>
                <p className="text-slate-300 text-xs">
                  Kamu berada di <strong className="text-amber-300">Grup A</strong>. Menonton pertandingan penyisihan Grup B...
                </p>
              </div>
            </>
          )}

          {phase === 'KNOCKOUT' && (
            <>
              <div className="w-16 h-16 rounded-3xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto shadow-xl">
                <SwordsIcon size={32} />
              </div>

              <div>
                <span className="px-3 py-1 rounded-full bg-amber-400/20 border border-amber-400/40 text-amber-300 text-[10px] font-black uppercase tracking-widest animate-pulse">
                  BABAK GUGUR BO3
                </span>
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-2">
                  {activeMatch?.roundName ?? 'Pertandingan Turnamen'}
                </h2>
                <p className="text-slate-400 text-xs mt-0.5">
                  Hanya 2 pemain yang sedang bertanding yang dapat menekan buzzer.
                </p>
              </div>

              {/* Head to head live duel display */}
              <div className="glass-panel rounded-3xl p-5 border border-white/10 bg-slate-900/90 shadow-2xl space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex-1 text-center truncate">
                    <p className="text-white font-extrabold text-sm sm:text-base truncate">
                      {activeP1?.name ?? 'Pemain 1'}
                    </p>
                    <p className="text-3xl sm:text-4xl font-black text-amber-400 font-mono mt-1">
                      {activeMatch?.player1Score ?? 0}
                    </p>
                  </div>

                  <div className="text-slate-500 font-black text-xs uppercase tracking-widest px-2 py-1 rounded-lg bg-white/5">
                    VS
                  </div>

                  <div className="flex-1 text-center truncate">
                    <p className="text-white font-extrabold text-sm sm:text-base truncate">
                      {activeP2?.name ?? 'Pemain 2'}
                    </p>
                    <p className="text-3xl sm:text-4xl font-black text-amber-400 font-mono mt-1">
                      {activeMatch?.player2Score ?? 0}
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/5 flex items-center justify-between text-[11px] text-slate-400">
                  <span>Target Menang: <strong className="text-white">{tournamentState?.targetPoints ?? 2} Poin (BO3)</strong></span>
                  <span>{activeMatch?.status === 'ACTIVE' ? 'Sedang Duel' : 'Menunggu'}</span>
                </div>
              </div>

              {/* Status message */}
              <div className="glass-panel rounded-2xl p-4 border border-white/5 bg-slate-900/60 text-xs">
                {isEliminated ? (
                  <p className="text-slate-400">
                    Kamu telah gugur di babak sebelumnya. Saksikan siapa yang akan menjadi Juara!
                  </p>
                ) : upcomingMatch ? (
                  <p className="text-teal-300 font-bold">
                    Bersiaplah! Pertandingan duelmu akan tiba di <strong className="text-white">{upcomingMatch.roundName}</strong>.
                  </p>
                ) : (
                  <p className="text-slate-400">
                    Menonton pertandingan duel babak gugur BO3...
                  </p>
                )}
              </div>
            </>
          )}

          <button
            type="button"
            onClick={() => setShowBracketModal(true)}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-amber-400 to-amber-500 hover:from-amber-300 hover:to-amber-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 transition-all active:scale-95 shadow-lg shadow-amber-400/20"
          >
            <SwordsIcon size={14} />
            <span>Lihat Bagan & Klasemen Turnamen</span>
          </button>
        </div>

        {/* Bottom indicator */}
        <div className="text-center py-2 text-slate-500 text-xs">
          Buzzer Anda terkunci selama duel ini
        </div>
      </div>
    )
  }

  // ── Active game: DISABLED or READY (Free for All or Active Duelist) ───
  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 select-none relative overflow-hidden transition-all ${
        feedbackData.type === 'wrong'
          ? 'animate-shake animate-flash-red'
          : feedbackData.type === 'correct'
          ? 'animate-flash-green'
          : ''
      }`}
    >
      {renderFeedbackOverlay()}
      <TournamentBracketModal
        isOpen={showBracketModal}
        onClose={() => setShowBracketModal(false)}
        tournamentState={tournamentState}
        players={players}
        currentPlayerId={session.playerId}
      />

      {/* Wrong Answer temporary alert banner */}
      {feedbackData.type === 'wrong' && !feedbackData.isAllWrong && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-rose-600/90 border border-rose-400/50 text-white font-black text-xs uppercase tracking-wider shadow-2xl shadow-rose-600/40 animate-bounce">
          Jawaban Salah! Kesempatan Dibuka Kembali
        </div>
      )}

      {/* Top Header Panel */}
      <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-lg relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center text-lg font-black text-slate-950 shadow-md shrink-0 ${
              isDuelist ? 'bg-amber-400 shadow-amber-400/30' : 'bg-gradient-to-br from-emerald-400 to-teal-600 shadow-emerald-500/20'
            }`}>
              {session.playerName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-white font-extrabold text-sm truncate leading-tight">{session.playerName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className={`w-1.5 h-1.5 rounded-full ${isDuelist ? 'bg-amber-400 animate-ping' : 'bg-emerald-400 shadow-sm shadow-emerald-400'}`} />
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">
                  {isDuelist
                    ? 'DUEL 1v1 BO3'
                    : phase === 'GROUP_A' || phase === 'GROUP_B'
                    ? `Penyisihan Grup ${myGroup}`
                    : 'Controller Aktif'}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {gameMode === 'KNOCKOUT' && (
              <button
                type="button"
                onClick={() => setShowBracketModal(true)}
                className="px-3 py-1.5 rounded-xl bg-amber-400/15 border border-amber-400/30 text-amber-300 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95"
              >
                <SwordsIcon size={13} />
                <span>Bagan & Grup</span>
              </button>
            )}

            <div className="text-right pl-1">
              <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                {isDuelist
                  ? 'Skor Duel'
                  : 'Skor Kamu'}
              </p>
              <p className="text-emerald-400 text-2xl font-black font-mono leading-none mt-0.5">
                {isDuelist
                  ? myDuelScore
                  : me?.score ?? 0}
              </p>
            </div>
          </div>
        </div>

        {/* Round Pill indicator or Duel status */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
          {isDuelist ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-400/20 border border-amber-400/30 text-amber-300 font-bold text-[11px]">
              <SwordsIcon size={13} className="text-amber-400" />
              <span>Lawan: {opponentPlayer?.name ?? 'Lawan'} ({oppDuelScore} Poin)</span>
            </span>
          ) : phase === 'GROUP_A' || phase === 'GROUP_B' ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-400/20 border border-teal-400/30 text-teal-300 font-bold text-[11px]">
              <UsersIcon size={13} className="text-teal-400" />
              <span>Babak Grup {myGroup} (Top 2 Lolos)</span>
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-900 border border-white/5 text-slate-300 font-bold text-[11px]">
              {game.current_round === 'GUESS' ? (
                <>
                  <MusicIcon size={13} className="text-emerald-400" />
                  <span>Tebak Judul Lagu</span>
                </>
              ) : (
                <>
                  <MicIcon size={13} className="text-amber-400" />
                  <span>Sambung Lirik</span>
                </>
              )}
            </span>
          )}
          <span className="text-slate-400 font-semibold text-[11px]">
            {isDuelist
              ? `Target: ${tournamentState?.targetPoints ?? 2} Poin`
              : `Percobaan #${game.current_attempt}`}
          </span>
        </div>
      </div>

      {/* Center: Buzz Dome Button */}
      <div className="my-auto py-8 flex items-center justify-center relative z-10">
        <BuzzButton
          buzzState={isCountingDown ? 'DISABLED' : game.buzz_state}
          isWinner={isWinner}
          onBuzz={handleBuzz}
          isExcluded={isExcluded}
          isBuzzing={isBuzzing}
        />
      </div>

      {/* Bottom: Mini Podium Roster or Duel Opponent summary */}
      <div className="glass-panel rounded-3xl p-3.5 border border-white/10 relative z-10 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">
            {isDuelist ? 'Arena Duel 1v1' : 'Peringkat Sementara'}
          </span>
          <span className="text-emerald-400 text-[10px] font-bold">
            {isDuelist ? activeMatch?.roundName ?? 'Duel' : 'Top 3'}
          </span>
        </div>
        {isDuelist ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-xl text-center bg-emerald-500/15 border border-emerald-500/40 text-emerald-300">
              <p className="text-[10px] uppercase font-bold text-slate-400">Kamu</p>
              <p className="text-xl font-mono font-black mt-0.5">{myDuelScore} Poin</p>
            </div>
            <div className="p-2 rounded-xl text-center bg-slate-900/80 border border-white/5 text-slate-300">
              <p className="text-[10px] uppercase font-bold text-slate-400">{opponentPlayer?.name ?? 'Lawan'}</p>
              <p className="text-xl font-mono font-black mt-0.5">{oppDuelScore} Poin</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {[...players]
              .sort((a, b) => b.score - a.score)
              .slice(0, 3)
              .map((p, i) => {
                const isMe = p.id === session.playerId
                return (
                  <div
                    key={p.id}
                    className={`p-2 rounded-xl text-center border transition-all truncate ${
                      isMe
                        ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                        : 'bg-slate-900/80 border-white/5 text-slate-300'
                    }`}
                  >
                    <p className="text-xs truncate font-bold flex items-center justify-center gap-1">
                      <span className={`text-[10px] font-mono px-1 rounded font-black ${
                        i === 0 ? 'bg-amber-400/20 text-amber-300 border border-amber-400/30' :
                        i === 1 ? 'bg-slate-300/20 text-slate-200 border border-slate-300/30' :
                        'bg-amber-700/20 text-amber-500 border border-amber-700/30'
                      }`}>#{i + 1}</span>
                      <span className="truncate">{p.name}</span>
                    </p>
                    <p className="text-sm font-black font-mono mt-0.5">{p.score}</p>
                  </div>
                )
              })}
          </div>
        )}
      </div>

      {/* Synchronized 3-2-1 Countdown Overlay */}
      {isCountingDown && (
        <CountdownOverlay
          countdownEndTime={countdownEndTime}
          isHost={false}
        />
      )}
    </div>
  )
}
