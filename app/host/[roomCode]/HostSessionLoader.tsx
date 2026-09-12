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
      <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />

        <div className="w-full max-w-sm glass-panel rounded-3xl p-8 border border-white/10 shadow-2xl relative z-10 text-center space-y-5">
          <div className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 flex items-center justify-center text-2xl mx-auto shadow-md">
            🔐
          </div>
          <div>
            <h1 className="text-white text-2xl font-black tracking-tight">Login Host</h1>
            <p className="text-slate-400 text-xs mt-1">
              Room Code: <span className="text-emerald-400 font-mono font-bold tracking-widest">{roomCode}</span>
            </p>
          </div>

          <form onSubmit={handleVerify} className="space-y-4 text-left">
            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-1.5">
                Password Host
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Masukkan password host"
                className="w-full bg-slate-900/90 text-white placeholder-slate-600 rounded-2xl px-4 py-3.5 outline-none border border-slate-700/60 focus:border-emerald-500 transition-all text-sm font-medium"
                autoFocus
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold py-2 px-3 rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={!password || verifying}
              className="w-full bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 disabled:opacity-40 text-slate-950 font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-95 text-sm"
            >
              {verifying ? 'MEMERIKSA...' : 'MASUK KE KONSOL HOST ➔'}
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
