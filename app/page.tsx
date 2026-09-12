'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { PlayerSession } from '@/lib/types'

export default function LandingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'join' | 'create'>('join')
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [gameName, setGameName] = useState('')
  const [hostPassword, setHostPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!roomCode.trim() || !playerName.trim()) return

    setLoading(true)
    try {
      const res = await fetch(`/api/games/${roomCode.toUpperCase()}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: playerName.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to join')
        return
      }

      // Save session to localStorage
      const session: PlayerSession = {
        playerId: data.playerId,
        sessionToken: data.sessionToken,
        gameId: data.gameId,
        playerName: data.playerName,
        roomCode: roomCode.toUpperCase(),
      }
      localStorage.setItem(`cg-session-${roomCode.toUpperCase()}`, JSON.stringify(session))

      router.push(`/play/${roomCode.toUpperCase()}`)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!gameName.trim() || !hostPassword.trim()) return

    setLoading(true)
    try {
      const res = await fetch('/api/games', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: gameName.trim(), hostPassword: hostPassword.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Failed to create game')
        return
      }

      // Save host session
      sessionStorage.setItem(
        `cg-host-${data.roomCode}`,
        JSON.stringify({ gameId: data.gameId, roomCode: data.roomCode, hostPassword: hostPassword.trim() })
      )

      router.push(`/host/${data.roomCode}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-950 via-purple-950 to-black flex flex-col items-center justify-center p-6">
      {/* Logo */}
      <div className="text-center mb-10">
        <div className="text-6xl mb-4">🎵</div>
        <h1 className="text-white text-4xl font-black tracking-tight">CG GUESS THE SONG</h1>
        <p className="text-purple-400 mt-2">Real-time music quiz game</p>
      </div>

      {/* Tab switcher */}
      <div className="flex bg-white/10 rounded-2xl p-1 mb-6 w-full max-w-sm">
        <button
          onClick={() => { setTab('join'); setError('') }}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
            tab === 'join' ? 'bg-purple-600 text-white' : 'text-white/60'
          }`}
        >
          🎮 Join Game
        </button>
        <button
          onClick={() => { setTab('create'); setError('') }}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${
            tab === 'create' ? 'bg-purple-600 text-white' : 'text-white/60'
          }`}
        >
          🏠 Host Game
        </button>
      </div>

      {/* Forms */}
      <div className="w-full max-w-sm">
        {tab === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider block mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="e.g. A7K29"
                maxLength={5}
                className="w-full bg-white/10 text-white text-2xl font-black text-center tracking-[0.3em] placeholder-white/20 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-purple-500 uppercase"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider block mb-2">
                Your Name
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Enter your name"
                maxLength={20}
                className="w-full bg-white/10 text-white text-lg text-center placeholder-white/20 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !roomCode || !playerName}
              className="w-full bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xl font-black py-5 rounded-2xl transition-all active:scale-95"
            >
              {loading ? 'Joining...' : 'JOIN GAME'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider block mb-2">
                Game Name
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="e.g. CG September 2026"
                className="w-full bg-white/10 text-white placeholder-white/20 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div>
              <label className="text-white/60 text-xs uppercase tracking-wider block mb-2">
                Host Password
              </label>
              <input
                type="password"
                value={hostPassword}
                onChange={(e) => setHostPassword(e.target.value)}
                placeholder="Password for host controls"
                className="w-full bg-white/10 text-white placeholder-white/20 rounded-2xl px-4 py-4 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm text-center">{error}</p>}
            <button
              type="submit"
              disabled={loading || !gameName || !hostPassword}
              className="w-full bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-xl font-black py-5 rounded-2xl transition-all active:scale-95"
            >
              {loading ? 'Creating...' : 'CREATE GAME'}
            </button>
          </form>
        )}
      </div>
    </div>
  )
}
