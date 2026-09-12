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
        setError('Game not found')
      } else {
        setInitialGame(game as Game)
        setInitialPlayers((players ?? []) as Player[])
      }
      setLoading(false)
    })
  }, [roomCode, router])

  if (loading) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center">
        <div className="text-white text-xl animate-pulse">Loading...</div>
      </div>
    )
  }

  if (error || !session || !initialGame) {
    return (
      <div className="min-h-screen bg-indigo-950 flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 text-xl mb-4">{error || 'Session expired'}</p>
          <button onClick={() => router.push('/')} className="text-purple-400 underline">
            Back to home
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
