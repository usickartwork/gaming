'use client'

import { useState } from 'react'
import type { Song, RoundType } from '@/lib/types'

interface SongSelectorProps {
  songs: Song[]
  currentSongId: string | null
  currentRound: RoundType
  onSelectSong: (song: Song) => void
  onChangeRound: (round: RoundType) => void
}

const DIFFICULTY_COLORS = {
  EASY: 'text-green-400',
  MEDIUM: 'text-yellow-400',
  HARD: 'text-red-400',
}

export function SongSelector({
  songs,
  currentSongId,
  currentRound,
  onSelectSong,
  onChangeRound,
}: SongSelectorProps) {
  const [search, setSearch] = useState('')

  const filtered = songs.filter(
    (s) =>
      s.round_type === currentRound &&
      (s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.artist.toLowerCase().includes(search.toLowerCase()))
  )

  return (
    <div className="bg-white/5 rounded-2xl p-4 space-y-3">
      {/* Round selector */}
      <div className="flex gap-2">
        {(['GUESS', 'LYRICS'] as RoundType[]).map((r) => (
          <button
            key={r}
            onClick={() => onChangeRound(r)}
            className={`flex-1 py-2 rounded-xl text-sm font-bold transition-all ${
              currentRound === r
                ? 'bg-purple-600 text-white'
                : 'bg-white/10 text-white/60 hover:bg-white/20'
            }`}
          >
            {r === 'GUESS' ? '🎵 Guess The Song' : '🎤 Sambung Lirik'}
          </button>
        ))}
      </div>

      {/* Search */}
      <input
        type="text"
        placeholder="Search song or artist..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full bg-white/10 text-white placeholder-white/30 rounded-xl px-4 py-2 text-sm outline-none focus:ring-2 focus:ring-purple-500"
      />

      {/* Song list */}
      <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
        {filtered.map((song) => (
          <button
            key={song.id}
            onClick={() => onSelectSong(song)}
            className={`w-full text-left px-4 py-3 rounded-xl transition-all ${
              currentSongId === song.id
                ? 'bg-purple-700 border border-purple-400 text-white'
                : 'bg-white/5 hover:bg-white/10 text-white'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="font-semibold truncate">{song.title}</p>
                <p className="text-xs text-white/60 truncate">{song.artist}</p>
              </div>
              <span className={`text-xs font-bold shrink-0 ${DIFFICULTY_COLORS[song.difficulty]}`}>
                {song.difficulty}
              </span>
            </div>
          </button>
        ))}
        {filtered.length === 0 && (
          <p className="text-white/40 text-center py-4 text-sm">No songs found</p>
        )}
      </div>
    </div>
  )
}
