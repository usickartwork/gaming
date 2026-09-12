'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import type { PlayerSession } from '@/lib/types'
import { PhoneIcon, LaptopIcon, ArrowRightIcon } from '@/components/shared/Icons'

export default function LandingPage() {
  const router = useRouter()
  const [tab, setTab] = useState<'join' | 'create'>('join')
  const [roomCode, setRoomCode] = useState('')
  const [playerName, setPlayerName] = useState('')
  const [gameName, setGameName] = useState('')
  const [hostPassword, setHostPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const joinCode = params.get('join')
      if (joinCode) {
        setRoomCode(joinCode.toUpperCase())
        setTab('join')
      }
    }
  }, [])

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
    <div className="min-h-screen flex flex-col items-center justify-center p-5 sm:p-8 relative overflow-hidden">
      {/* Background ambient lighting */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-emerald-500/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-72 h-72 bg-cyan-500/10 rounded-full blur-[100px] pointer-events-none" />

      {/* Header Badge & Title */}
      <div className="text-center mb-8 relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold uppercase tracking-widest mb-4">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
          Real-time Music Arena
        </div>
        <h1 className="text-white text-4xl sm:text-5xl font-black tracking-tight leading-tight">
          GUESS THE SONG
        </h1>
        <p className="text-slate-400 text-sm sm:text-base mt-2 font-medium">
          Mobile Controller · Live Host · Instant Buzzer
        </p>
      </div>

      {/* Main Glass Card */}
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 sm:p-8 shadow-2xl shadow-black/60 relative z-10 border border-white/10">
        {/* Tab switcher */}
        <div className="flex bg-slate-900/80 p-1.5 rounded-2xl mb-6 border border-white/5">
          <button
            type="button"
            onClick={() => { setTab('join'); setError('') }}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              tab === 'join'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <PhoneIcon size={16} /> Join Game
          </button>
          <button
            type="button"
            onClick={() => { setTab('create'); setError('') }}
            className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all duration-200 flex items-center justify-center gap-2 ${
              tab === 'create'
                ? 'bg-emerald-500 text-slate-950 shadow-md shadow-emerald-500/20 font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <LaptopIcon size={16} /> Host Room
          </button>
        </div>

        {/* Forms */}
        {tab === 'join' ? (
          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">
                Room Code
              </label>
              <input
                type="text"
                value={roomCode}
                onChange={(e) => setRoomCode(e.target.value.toUpperCase())}
                placeholder="Contoh: A7K29"
                maxLength={5}
                className="w-full bg-slate-900/90 text-white text-3xl font-black text-center tracking-[0.3em] placeholder-slate-600 rounded-2xl px-4 py-4 outline-none border border-slate-700/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 uppercase transition-all"
              />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">
                Nama Pemain
              </label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value)}
                placeholder="Masukkan nama kamu"
                maxLength={20}
                className="w-full bg-slate-900/90 text-white text-lg text-center placeholder-slate-600 rounded-2xl px-4 py-3.5 outline-none border border-slate-700/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition-all font-medium"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold py-2.5 px-4 rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !roomCode || !playerName}
              className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-lg font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? 'MENYAMBUNGKAN...' : (
                <>
                  <span>MASUK KE ARENA</span>
                  <ArrowRightIcon size={20} />
                </>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleCreate} className="space-y-5">
            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">
                Nama Game / Room
              </label>
              <input
                type="text"
                value={gameName}
                onChange={(e) => setGameName(e.target.value)}
                placeholder="Contoh: CG September 2026"
                className="w-full bg-slate-900/90 text-white placeholder-slate-600 rounded-2xl px-4 py-3.5 outline-none border border-slate-700/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition-all font-medium"
              />
            </div>
            <div>
              <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">
                Host Password
              </label>
              <input
                type="password"
                value={hostPassword}
                onChange={(e) => setHostPassword(e.target.value)}
                placeholder="Buat password untuk kendali host"
                className="w-full bg-slate-900/90 text-white placeholder-slate-600 rounded-2xl px-4 py-3.5 outline-none border border-slate-700/60 focus:border-emerald-500 focus:ring-4 focus:ring-emerald-500/15 transition-all font-medium"
              />
            </div>

            {error && (
              <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold py-2.5 px-4 rounded-xl text-center">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || !gameName || !hostPassword}
              className="w-full bg-gradient-to-r from-emerald-400 to-emerald-500 hover:from-emerald-300 hover:to-emerald-400 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-lg font-black py-4 rounded-2xl transition-all shadow-lg shadow-emerald-500/20 active:scale-[0.98] flex items-center justify-center gap-2"
            >
              {loading ? 'MEMBUAT ROOM...' : (
                <>
                  <span>BUAT GAME BARU</span>
                  <ArrowRightIcon size={20} />
                </>
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-slate-500 text-xs text-center mt-8 font-medium">
        Made for CG Multiplayer · Open in Mobile Browser
      </p>
    </div>
  )
}
