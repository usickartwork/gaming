'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { HostDashboard } from '@/components/host/HostDashboard'
import type { Game, Player, Song, HostSession } from '@/lib/types'

interface Props {
  game: Game
  players: Player[]
  songs: Song[]
  roomCode: string
}

/**
 * Client component that loads the HostSession from sessionStorage.
 * If no session found, prompts for host password.
 */
export function HostSessionLoader({ game, players, songs, roomCode }: Props) {
  const router = useRouter()
  const [hostSession, setHostSession] = useState<HostSession | null>(null)
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [verifying, setVerifying] = useState(false)

  useEffect(() => {
    const stored = sessionStorage.getItem(`cg-host-${roomCode}`)
    if (stored) {
      try {
        setHostSession(JSON.parse(stored))
      } catch {
        // invalid storage
      }
    }
  }, [roomCode])

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setVerifying(true)

    try {
      // Verify by attempting a no-op host action
      const res = await fetch(`/api/admin/${roomCode}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'x-host-password': password,
        },
        body: JSON.stringify({ action: 'RESET_ALL_EXCLUSIONS' }),
      })

      if (res.ok) {
        const session: HostSession = { gameId: game.id, roomCode, hostPassword: password }
        sessionStorage.setItem(`cg-host-${roomCode}`, JSON.stringify(session))
        setHostSession(session)
      } else {
        setError('Wrong password')
      }
    } finally {
      setVerifying(false)
    }
  }

  if (!hostSession) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h1 className="text-white text-2xl font-black mb-2 text-center">Host Login</h1>
          <p className="text-purple-400 text-center mb-8">Room: {roomCode}</p>
          <form onSubmit={handleVerify} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Host password"
              className="w-full bg-white/10 text-white placeholder-white/30 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-purple-500"
              autoFocus
            />
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={!password || verifying}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 text-white font-black py-4 rounded-2xl transition-all"
            >
              {verifying ? 'Verifying...' : 'ENTER DASHBOARD'}
            </button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <HostDashboard
      initialGame={game}
      initialPlayers={players}
      songs={songs}
      hostSession={hostSession}
    />
  )
}
