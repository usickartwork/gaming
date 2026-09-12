'use client'

import { useState } from 'react'
import { ListIcon, SearchIcon, PlayIcon, MusicIcon, CheckIcon } from '@/components/shared/Icons'
import type { Song, RoundType } from '@/lib/types'

interface SongSelectorProps {
  songs: Song[]
  currentSongId: string | null
  currentRound: RoundType
  onSelectSong: (song: Song) => void
  onChangeRound: (round: RoundType) => void
  onOpenSpotifySearch?: () => void
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
  onOpenSpotifySearch,
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h3 className="text-white font-bold text-sm flex items-center gap-2">
          <ListIcon size={18} className="text-emerald-400" />
          <span>Pilih &amp; Ceklis Lagu</span>
        </h3>

        <div className="flex items-center gap-2">
          {onOpenSpotifySearch && (
            <button
              type="button"
              onClick={onOpenSpotifySearch}
              className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/40 text-emerald-300 font-extrabold text-xs flex items-center gap-2 transition-all active:scale-95 shadow-sm shadow-emerald-500/10"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.307c-.218.358-.68.472-1.038.254-2.846-1.74-6.428-2.133-10.648-1.168-.41.094-.82-.162-.914-.572-.093-.41.163-.82.573-.914 4.624-1.057 8.583-.615 11.773 1.362.358.218.472.68.254 1.038zm1.467-3.262c-.274.446-.86.588-1.306.314-3.258-2.003-8.224-2.585-12.077-1.415-.498.151-1.028-.135-1.18-.633-.15-.498.136-1.028.634-1.18 4.407-1.338 9.883-.69 13.615 1.608.446.274.588.86.314 1.306zm.126-3.41c-3.908-2.32-10.354-2.533-14.093-1.398-.6.182-1.238-.162-1.42-.762-.182-.6.162-1.238.762-1.42 4.303-1.306 11.417-1.055 15.918 1.617.538.319.713 1.018.394 1.556-.319.538-1.018.713-1.556.394z" />
              </svg>
              <span>Cari di Spotify</span>
            </button>
          )}
          <span className="text-slate-400 text-xs font-semibold">
            {filtered.length} Lagu Tersedia
          </span>
        </div>
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

      {/* Song list with Checklist items */}
      <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
        {filtered.map((song) => {
          const isSelected = currentSongId === song.id
          return (
            <button
              key={song.id}
              onClick={() => onSelectSong(song)}
              type="button"
              className={`w-full text-left p-3.5 rounded-2xl transition-all border flex items-center justify-between gap-3 group ${
                isSelected
                  ? 'bg-emerald-500/20 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                {/* Checklist Box */}
                <div
                  className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-emerald-400 border-emerald-400 text-slate-950 shadow-md shadow-emerald-400/40 scale-105'
                      : 'border-slate-600 bg-slate-800/80 group-hover:border-slate-400 text-transparent'
                  }`}
                >
                  <CheckIcon size={16} className={isSelected ? 'stroke-[3]' : 'opacity-0'} />
                </div>
                <div className="truncate">
                  <p className={`font-bold text-sm truncate ${isSelected ? 'text-emerald-300 font-extrabold' : 'text-white'}`}>
                    {song.title}
                  </p>
                  <p className="text-xs text-slate-400 truncate">{song.artist}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {isSelected && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                    Ceklis Dipilih
                  </span>
                )}
                <span className={`text-[10px] font-bold px-2.5 py-1 rounded-full border shrink-0 ${DIFFICULTY_COLORS[song.difficulty]}`}>
                  {song.difficulty}
                </span>
              </div>
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
