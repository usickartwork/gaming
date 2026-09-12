'use client'

import { useState } from 'react'
import { ListIcon, SearchIcon, PlayIcon, MusicIcon } from '@/components/shared/Icons'
import type { Song, RoundType } from '@/lib/types'

interface SongSelectorProps {
  songs: Song[]
  currentSongId: string | null
  currentRound: RoundType
  onSelectSong: (song: Song) => void
  onChangeRound: (round: RoundType) => void
}

const DIFFICULTY_COLORS = {
  EASY: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  MEDIUM: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  HARD: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
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
    <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-4 shadow-xl">
      <div className="flex items-center justify-between">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <ListIcon size={18} className="text-emerald-400" />
          <span>Daftar Lagu</span>
        </h3>
        <span className="text-slate-400 text-xs font-semibold">
          {filtered.length} Lagu Tersedia
        </span>
      </div>

      {/* Search Input */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          placeholder="Cari judul lagu atau nama penyanyi..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-slate-900/90 text-white placeholder-slate-500 rounded-2xl pl-10 pr-4 py-2.5 text-xs sm:text-sm outline-none border border-slate-700/60 focus:border-emerald-500 transition-all"
        />
      </div>

      {/* Song list */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {filtered.map((song) => {
          const isSelected = currentSongId === song.id
          return (
            <button
              key={song.id}
              onClick={() => onSelectSong(song)}
              className={`w-full text-left p-3.5 rounded-2xl transition-all border flex items-center justify-between gap-3 ${
                isSelected
                  ? 'bg-emerald-500/15 border-emerald-500/50 shadow-md shadow-emerald-950/40'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center text-sm shrink-0 ${isSelected ? 'bg-emerald-500 text-slate-950 font-bold' : 'bg-slate-800 text-slate-400'}`}>
                  {isSelected ? <PlayIcon size={12} /> : <MusicIcon size={14} />}
                </div>
                <div className="truncate">
                  <p className={`font-bold text-sm truncate ${isSelected ? 'text-emerald-300' : 'text-white'}`}>
                    {song.title}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                </div>
              </div>
              <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${DIFFICULTY_COLORS[song.difficulty]}`}>
                {song.difficulty}
              </span>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <div className="text-center py-8 text-slate-500 text-xs">
            Tidak ada lagu ditemukan. Coba cari kata kunci lain.
          </div>
        )}
      </div>
    </div>
  )
}
