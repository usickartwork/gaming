'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { PlayerGame } from '@/components/player/PlayerGame'
import type { Game, Player, PlayerSession } from '@/lib/types'

export default function PlayPage() {
  const params = useParams()
  const router = useRouter()
  const roomCode = (params.roomCode as string).toUpperCase()

  const [session, setSession] = useState<PlayerSession | null>(null)
  const [initialGame, setInitialGame] = useState<Game | null>(null)
  const [initialPlayers, setInitialPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const stored = localStorage.getItem(`cg-session-${roomCode}`)
    if (!stored) {
      // No session — redirect to join
      router.replace(`/?join=${roomCode}`)
      return
    }

    const s: PlayerSession = JSON.parse(stored)
    setSession(s)

    // Fetch initial data
    const supabase = getSupabaseBrowserClient()
    Promise.all([
      supabase.from('games').select('*').eq('room_code', roomCode).single(),
      supabase.from('players').select('*').eq('game_id', s.gameId).order('score', { ascending: false }),
    ]).then(([{ data: game, error: gErr }, { data: players }]) => {
      if (gErr || !game) {
        console.error('PlayPage fetch error:', gErr)
        setError(gErr?.message || 'Game not found')
      } else {
        setInitialGame(game as Game)
        setInitialPlayers((players ?? []) as Player[])
      }
      setLoading(false)
    })
  }, [roomCode, router])

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
        <div className="w-12 h-12 rounded-full border-4 border-emerald-400/20 border-t-emerald-400 animate-spin mb-4" />
        <p className="text-slate-300 font-bold text-sm tracking-wider uppercase animate-pulse">Menghubungkan ke Room...</p>
      </div>
    )
  }

  if (error || !session || !initialGame) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center max-w-sm w-full space-y-4">
          <span className="text-4xl block">⚠️</span>
          <div>
            <p className="text-rose-400 text-lg font-bold">{error || 'Sesi Kadaluarsa'}</p>
            <p className="text-slate-400 text-xs mt-1">Pastikan kode room benar atau silakan bergabung kembali.</p>
          </div>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl text-sm transition-all border border-white/5"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    )
  }

  return (
    <PlayerGame
      initialGame={initialGame}
      initialPlayers={initialPlayers}
      session={session}
    />
  )
}
