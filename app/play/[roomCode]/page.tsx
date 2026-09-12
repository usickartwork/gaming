'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import { PlayerGame } from '@/components/player/PlayerGame'
import { AlertIcon } from '@/components/shared/Icons'
import type { Game, Player, PlayerSession } from '@/lib/types'

export default function PlayPage() {
  const params = useParams()
  const router = useRouter()
  const rawCode = params?.roomCode
  const roomCode = (typeof rawCode === 'string' ? rawCode : Array.isArray(rawCode) ? rawCode[0] : '')?.toUpperCase()

  const [session, setSession] = useState<PlayerSession | null>(null)
  const [initialGame, setInitialGame] = useState<Game | null>(null)
  const [initialPlayers, setInitialPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!roomCode) return

    let stored: string | null = null
    try {
      stored = typeof window !== 'undefined' ? localStorage.getItem(`cg-session-${roomCode}`) : null
    } catch (e) {
      console.error('Failed to read localStorage:', e)
    }

    if (!stored) {
      // No session — redirect to join
      router.replace(`/?join=${roomCode}`)
      return
    }

    let s: PlayerSession
    try {
      s = JSON.parse(stored)
      if (!s || !s.gameId || !s.playerId) {
        throw new Error('Invalid session format')
      }
    } catch (e) {
      console.error('Corrupted session in localStorage:', e)
      try {
        localStorage.removeItem(`cg-session-${roomCode}`)
      } catch {}
      router.replace(`/?join=${roomCode}`)
      return
    }

    setSession(s)

    // Fetch initial data
    const supabase = getSupabaseBrowserClient()
    Promise.all([
      supabase.from('games').select('*').eq('room_code', roomCode).single(),
      supabase.from('players').select('*').eq('game_id', s.gameId).order('score', { ascending: false }),
    ])
      .then(([{ data: game, error: gErr }, { data: players }]) => {
        if (gErr || !game) {
          console.error('PlayPage fetch error:', gErr)
          setError(gErr?.message || 'Game tidak ditemukan')
        } else {
          setInitialGame(game as Game)
          setInitialPlayers((players ?? []) as Player[])
        }
        setLoading(false)
      })
      .catch((err) => {
        console.error('PlayPage fetch exception:', err)
        setError('Gagal memuat data game. Silakan refresh halaman.')
        setLoading(false)
      })
  }, [roomCode, router])

  if (!roomCode || loading) {
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
          <div className="w-12 h-12 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-md">
            <AlertIcon size={24} />
          </div>
          <div>
            <p className="text-rose-400 text-lg font-bold">{error || 'Sesi Kadaluarsa'}</p>
            <p className="text-slate-400 text-xs mt-1">Pastikan kode room benar atau silakan bergabung kembali.</p>
          </div>
          <button
            onClick={() => router.push(roomCode ? `/?join=${roomCode}` : '/')}
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
