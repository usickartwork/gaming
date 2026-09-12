'use client'

import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { useGameState } from '@/lib/hooks/useGameState'
import { usePlayers } from '@/lib/hooks/usePlayers'
import { usePresence } from '@/lib/hooks/usePresence'
import { playDingSound, playCorrectFanfareSound, playWrongSound } from '@/lib/audio'
import { BuzzButton } from './BuzzButton'
import { Leaderboard } from '@/components/shared/Leaderboard'
import { WaitingRoom } from '@/components/shared/WaitingRoom'
import { MicIcon, LockIcon, TrophyIcon, MusicIcon, DiscIcon } from '@/components/shared/Icons'
import type { Game, Player, PlayerSession } from '@/lib/types'

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
  const [localWinner, setLocalWinner] = useState<boolean | null>(null)
  const [localWinnerName, setLocalWinnerName] = useState<string | null>(null)
  const [revealedSong, setRevealedSong] = useState<{ title: string; artist: string } | null>(null)
  const [loadingSong, setLoadingSong] = useState(false)
  const [feedbackAnim, setFeedbackAnim] = useState<'none' | 'correct' | 'wrong'>('none')

  const prevBuzzStateRef = useRef(game.buzz_state)
  const prevAttemptRef = useRef(game.current_attempt)

  // Real-time Sound & Visual Feedback for Correct vs Wrong answers
  useEffect(() => {
    // When game transitions to RESULT (Answer evaluated as CORRECT!)
    if (game.buzz_state === 'RESULT' && prevBuzzStateRef.current !== 'RESULT') {
      playCorrectFanfareSound()
      setFeedbackAnim('correct')
      const t = setTimeout(() => setFeedbackAnim('none'), 2000)
      return () => clearTimeout(t)
    }

    // When attempt increases after locked/answering state (Answer evaluated as WRONG!)
    if (
      game.buzz_state === 'READY' &&
      (prevBuzzStateRef.current === 'LOCKED' || prevBuzzStateRef.current === 'ANSWERING') &&
      game.current_attempt > prevAttemptRef.current
    ) {
      playWrongSound()
      setFeedbackAnim('wrong')
      const t = setTimeout(() => setFeedbackAnim('none'), 1200)
      return () => clearTimeout(t)
    }

    prevBuzzStateRef.current = game.buzz_state
    prevAttemptRef.current = game.current_attempt
  }, [game.buzz_state, game.current_attempt])

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

  // Reset local state when host enables buzz again
  useEffect(() => {
    if (game.buzz_state === 'READY' && game.buzz_winner_id === null) {
      setLocalWinner(null)
      setLocalWinnerName(null)
      setIsBuzzing(false)
    }
  }, [game.buzz_state, game.buzz_winner_id])

  // Track online presence
  usePresence(initialGame.id, session.playerId, session.playerName, session.sessionToken)

  const me = players.find((p) => p.id === session.playerId)
  const isWinner = localWinner === true || game.buzz_winner_id === session.playerId
  const isExcluded = me?.excluded_attempt === game.current_attempt
  const buzzWinnerPlayer = players.find((p) => p.id === game.buzz_winner_id)

  const handleBuzz = async () => {
    if (isBuzzing) return
    setIsBuzzing(true)

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
      if (data.winner) {
        setLocalWinner(true)
        playDingSound()
      } else if (data.winnerId) {
        setLocalWinner(false)
        setLocalWinnerName(data.winnerName || 'Someone')
      }
    } catch (err) {
      console.error('Buzz error:', err)
    } finally {
      setIsBuzzing(false)
    }
  }

  // ── Waiting Room ─────────────────────────────────────────────────
  if (game.status === 'LOBBY') {
    return (
      <WaitingRoom
        roomCode={game.room_code}
        gameName={game.name}
        players={players}
        isHost={false}
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
              KLASEMEN AKHIR
            </h1>
            <p className="text-slate-400 text-xs mt-1">
              Host telah menyelesaikan sesi permainan. Terima kasih sudah bermain!
            </p>
          </div>

          <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-2xl">
            <Leaderboard players={players} highlightId={session.playerId} />
          </div>

          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem(`cg-session-${game.room_code}`)
              }
              router.push('/')
            }}
            className="w-full py-4 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-500 hover:from-emerald-300 hover:to-teal-400 text-slate-950 font-black text-base shadow-lg shadow-emerald-500/25 transition-all active:scale-[0.98]"
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
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-gradient-to-b from-emerald-950/80 via-slate-950 to-black">
        <div className="absolute inset-0 bg-emerald-500/10 blur-[120px] pointer-events-none" />

        <div className="relative z-10 space-y-4 max-w-sm w-full">
          <div className="w-24 h-24 rounded-full bg-emerald-500/20 border-2 border-emerald-400/50 flex items-center justify-center mx-auto shadow-2xl shadow-emerald-500/40 animate-bounce">
            <MicIcon size={44} className="text-emerald-400" />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-400 text-slate-950 font-black text-xs uppercase tracking-widest mb-2 shadow-lg shadow-emerald-400/30">
              KAMU PALING CEPAT!
            </div>
            <h1 className="text-white text-4xl sm:text-5xl font-black tracking-tight leading-tight">
              GILIRAN KAMU!
            </h1>
            <p className="text-emerald-300 text-lg font-bold mt-1">
              Sebutkan jawabanmu secara lisan sekarang!
            </p>
          </div>

          <div className="glass-panel rounded-3xl p-5 border border-emerald-500/30 shadow-xl">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-wider">Skor Kamu Saat Ini</p>
            <p className="text-emerald-400 text-4xl font-black font-mono mt-1">{me?.score ?? 0} <span className="text-base text-slate-400 font-semibold">pts</span></p>
          </div>

          <p className="text-slate-500 text-xs animate-pulse">
            Host sedang mendengarkan jawabanmu...
          </p>
        </div>
      </div>
    )
  }

  // ── LOCKED: Someone else won ────────────────────────────────────
  if ((localWinner === false || game.buzz_state === 'LOCKED' || game.buzz_state === 'ANSWERING') && !isWinner) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center relative overflow-hidden bg-gradient-to-b from-slate-900 via-slate-950 to-black">
        <div className="relative z-10 space-y-4 max-w-sm w-full">
          <div className="w-20 h-20 rounded-3xl bg-slate-900 border border-white/10 flex items-center justify-center mx-auto shadow-2xl">
            <LockIcon size={36} className="text-slate-400" />
          </div>
          <div>
            <span className="px-3 py-1 rounded-full bg-rose-500/15 border border-rose-500/30 text-rose-400 text-xs font-bold uppercase tracking-widest">
              BUZZER TERKUNCI
            </span>
            <h1 className="text-white text-3xl font-black tracking-tight mt-3">
              {localWinnerName || buzzWinnerPlayer?.name || 'Pemain Lain'}
            </h1>
            <p className="text-slate-400 text-sm mt-1">
              Memencet buzzer lebih dulu!
            </p>
          </div>

          <div className="glass-panel rounded-3xl p-5 border border-white/5 shadow-xl">
            <p className="text-slate-500 text-xs font-bold uppercase tracking-wider">Skor Kamu</p>
            <p className="text-white text-3xl font-black font-mono mt-1">{me?.score ?? 0} <span className="text-sm text-slate-500 font-semibold">pts</span></p>
          </div>

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
      <div className="min-h-screen flex flex-col items-center justify-center p-5 sm:p-6 relative overflow-hidden">
        <div className="w-full max-w-sm space-y-4 relative z-10 py-4">
          {/* Revealed Song Title & Artist Card */}
          <div className="glass-panel rounded-3xl p-5 border border-emerald-500/40 bg-gradient-to-b from-emerald-950/60 via-slate-900 to-slate-950 shadow-2xl relative overflow-hidden text-center space-y-3">
            {/* Ambient emerald blur */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none" />

            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 border border-emerald-400/40 text-emerald-300 font-black text-[11px] uppercase tracking-wider">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
              <span>JAWABAN BENAR!</span>
            </div>

            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-teal-500/10 border border-emerald-400/30 flex items-center justify-center text-emerald-400 mx-auto shadow-lg shadow-emerald-500/20">
              <DiscIcon size={28} className="animate-spin" style={{ animationDuration: '4s' }} />
            </div>

            <div>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Judul Lagu</p>
              <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-0.5 leading-tight">
                {revealedSong?.title || (loadingSong ? 'Memuat Judul...' : 'Lagu Tertebak')}
              </h1>
              {revealedSong?.artist && (
                <p className="text-emerald-400 font-extrabold text-sm sm:text-base mt-1">
                  {revealedSong.artist}
                </p>
              )}
            </div>
          </div>

          <div className="text-center pt-2">
            <TrophyIcon size={28} className="text-amber-400 mx-auto mb-1" />
            <h2 className="text-white text-lg font-black tracking-tight">KLASEMEN SKOR SEMENTARA</h2>
            <p className="text-slate-400 text-xs">Ronde {game.current_round === 'GUESS' ? '1' : '2'}</p>
          </div>

          <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-2xl">
            <Leaderboard players={players} highlightId={session.playerId} />
          </div>

          <div className="text-center py-1">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-slate-900 border border-white/10 text-slate-400 text-xs animate-pulse">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              Menunggu Host Memutar Lagu Selanjutnya...
            </div>
          </div>
        </div>
      </div>
    )
  }

  // ── Active game: DISABLED or READY ─────────────────────────────
  return (
    <div
      className={`min-h-screen flex flex-col justify-between p-4 sm:p-6 select-none relative overflow-hidden transition-all ${
        feedbackAnim === 'wrong'
          ? 'animate-shake animate-flash-red'
          : feedbackAnim === 'correct'
          ? 'animate-flash-green'
          : ''
      }`}
    >
      {/* Wrong Answer temporary alert banner */}
      {feedbackAnim === 'wrong' && (
        <div className="fixed top-5 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-rose-600/90 border border-rose-400/50 text-white font-black text-xs uppercase tracking-wider shadow-2xl shadow-rose-600/40 animate-bounce">
          Jawaban Salah! Kesempatan Dibuka Kembali
        </div>
      )}

      {/* Top Header Panel */}
      <div className="glass-panel rounded-3xl p-4 border border-white/10 shadow-lg relative z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center text-lg font-black text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
              {session.playerName.charAt(0).toUpperCase()}
            </div>
            <div className="truncate">
              <p className="text-white font-extrabold text-sm truncate leading-tight">{session.playerName}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400" />
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Controller Aktif</span>
              </div>
            </div>
          </div>

          <div className="text-right pl-3">
            <p className="text-slate-400 text-[10px] font-bold uppercase tracking-wider">Skor Kamu</p>
            <p className="text-emerald-400 text-2xl font-black font-mono leading-none mt-0.5">{me?.score ?? 0}</p>
          </div>
        </div>

        {/* Round Pill indicator */}
        <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-xs">
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
          <span className="text-slate-400 font-semibold text-[11px]">
            Percobaan #{game.current_attempt}
          </span>
        </div>
      </div>

      {/* Center: The Iconic Buzz Dome Button */}
      <div className="my-auto py-8 flex items-center justify-center relative z-10">
        <BuzzButton
          buzzState={game.buzz_state}
          isWinner={isWinner}
          onBuzz={handleBuzz}
          isExcluded={isExcluded}
          isBuzzing={isBuzzing}
        />
      </div>

      {/* Bottom: Mini Podium Roster */}
      <div className="glass-panel rounded-3xl p-3.5 border border-white/10 relative z-10 space-y-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">Peringkat Sementara</span>
          <span className="text-emerald-400 text-[10px] font-bold">Top 3</span>
        </div>
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
      </div>
    </div>
  )
}
