'use client'

import { useState } from 'react'
import {
  ListIcon,
  SearchIcon,
  MusicIcon,
  CheckIcon,
  TrashIcon,
  PlusIcon,
  EditIcon,
  CrossIcon,
} from '@/components/shared/Icons'
import type { Song, RoundType, PlaylistSection } from '@/lib/types'

interface SongSelectorProps {
  songs: Song[]
  currentSongId: string | null
  currentRound: RoundType
  playlists?: PlaylistSection[]
  activePlaylistId?: string | null
  onSelectPlaylist?: (playlistId: string | null) => void
  onCreatePlaylist?: (name: string) => void
  onDeletePlaylist?: (playlistId: string) => void
  onRenamePlaylist?: (playlistId: string, newName: string) => void
  onSelectSong: (song: Song) => void
  onChangeRound: (round: RoundType) => void
  onOpenSpotifySearch?: (query?: string) => void
  onDeleteSong?: (songId: string) => Promise<void>
  onRemoveSongFromPlaylist?: (playlistId: string, songId: string) => void
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
  playlists = [],
  activePlaylistId = null,
  onSelectPlaylist,
  onCreatePlaylist,
  onDeletePlaylist,
  onRenamePlaylist,
  onSelectSong,
  onChangeRound,
  onOpenSpotifySearch,
  onDeleteSong,
  onRemoveSongFromPlaylist,
}: SongSelectorProps) {
  const [search, setSearch] = useState('')
  const [deletingId, setDeletingId] = useState<string | null>(null)

  // Creating playlist inline UI
  const [isCreatingPlaylist, setIsCreatingPlaylist] = useState(false)
  const [newPlaylistName, setNewPlaylistName] = useState('')

  // Renaming playlist inline UI
  const [editingPlaylistId, setEditingPlaylistId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')

  // Active playlist section object
  const activePlaylist = playlists.find((p) => p.id === activePlaylistId) ?? null

  // Songs filtered by playlist section:
  // If activePlaylistId is set, only show songs in activePlaylist.songIds
  // If activePlaylistId is null, show all songs
  const sectionSongs = activePlaylist
    ? songs.filter((s) => activePlaylist.songIds.includes(s.id))
    : songs

  // Filtered further by search query
  const filtered = sectionSongs.filter(
    (s) =>
      s.round_type === currentRound &&
      (s.title.toLowerCase().includes(search.toLowerCase()) ||
        s.artist.toLowerCase().includes(search.toLowerCase()))
  )

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && search.trim() && onOpenSpotifySearch) {
      onOpenSpotifySearch(search.trim())
    }
  }

  const handleDeleteSong = async (e: React.MouseEvent, songId: string) => {
    e.stopPropagation()
    if (activePlaylist && onRemoveSongFromPlaylist) {
      onRemoveSongFromPlaylist(activePlaylist.id, songId)
      return
    }
    if (onDeleteSong) {
      setDeletingId(songId)
      try {
        await onDeleteSong(songId)
      } finally {
        setDeletingId(null)
      }
    }
  }

  const handleSaveNewPlaylist = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newPlaylistName.trim() || !onCreatePlaylist) return
    onCreatePlaylist(newPlaylistName.trim())
    setNewPlaylistName('')
    setIsCreatingPlaylist(false)
  }

  const handleSaveRename = (e: React.FormEvent, playlistId: string) => {
    e.preventDefault()
    if (!editingName.trim() || !onRenamePlaylist) return
    onRenamePlaylist(playlistId, editingName.trim())
    setEditingPlaylistId(null)
    setEditingName('')
  }

  return (
    <div className="glass-panel rounded-3xl p-5 border border-white/10 space-y-4 shadow-xl">
      {/* Header with Title and Add from Spotify button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-white font-black text-base flex items-center gap-2">
            <ListIcon size={19} className="text-emerald-400" />
            <span>Playlist &amp; Kategori Lagu</span>
          </h3>
          <p className="text-slate-400 text-xs mt-0.5">
            Buat beberapa section / playlist untuk babak permainan
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onOpenSpotifySearch && (
            <button
              type="button"
              onClick={() => onOpenSpotifySearch(search.trim())}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center gap-2 transition-all active:scale-95 shadow-md shadow-emerald-500/25 shrink-0"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.307c-.218.358-.68.472-1.038.254-2.846-1.74-6.428-2.133-10.648-1.168-.41.094-.82-.162-.914-.572-.093-.41.163-.82.573-.914 4.624-1.057 8.583-.615 11.773 1.362.358.218.472.68.254 1.038zm1.467-3.262c-.274.446-.86.588-1.306.314-3.258-2.003-8.224-2.585-12.077-1.415-.498.151-1.028-.135-1.18-.633-.15-.498.136-1.028.634-1.18 4.407-1.338 9.883-.69 13.615 1.608.446.274.588.86.314 1.306zm.126-3.41c-3.908-2.32-10.354-2.533-14.093-1.398-.6.182-1.238-.162-1.42-.762-.182-.6.162-1.238.762-1.42 4.303-1.306 11.417-1.055 15.918 1.617.538.319.713 1.018.394 1.556-.319.538-1.018.713-1.556.394z" />
              </svg>
              <span>+ Tambah dari Spotify</span>
            </button>
          )}
        </div>
      </div>

      {/* Playlist Section Tabs (Pill Bar) */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 scrollbar-none text-xs">
          {/* All songs tab */}
          <button
            type="button"
            onClick={() => onSelectPlaylist?.(null)}
            className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
              activePlaylistId === null
                ? 'bg-white/20 text-white font-extrabold border border-white/20 shadow-sm'
                : 'bg-slate-900/80 text-slate-400 hover:text-white border border-white/5'
            }`}
          >
            <span>Semua Lagu</span>
            <span className="text-[10px] opacity-70 bg-white/10 px-1.5 py-0.2 rounded-full">
              {songs.length}
            </span>
          </button>

          {/* User Custom Playlist Section Tabs */}
          {playlists.map((pl) => {
            const isPlActive = activePlaylistId === pl.id
            const count = pl.songIds.length
            return (
              <button
                key={pl.id}
                type="button"
                onClick={() => onSelectPlaylist?.(pl.id)}
                className={`px-3 py-1.5 rounded-xl font-bold transition-all shrink-0 flex items-center gap-1.5 ${
                  isPlActive
                    ? 'bg-emerald-500 text-slate-950 font-black shadow-md shadow-emerald-500/20'
                    : 'bg-slate-900/80 text-slate-400 hover:text-emerald-300 border border-white/5'
                }`}
              >
                <span>🎵 {pl.name}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    isPlActive ? 'bg-slate-950/20 text-slate-950' : 'bg-white/10 text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}

          {/* Button: + Buat Playlist Baru */}
          {!isCreatingPlaylist && (
            <button
              type="button"
              onClick={() => setIsCreatingPlaylist(true)}
              className="px-3 py-1.5 rounded-xl font-bold text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 transition-all shrink-0 flex items-center gap-1 active:scale-95"
            >
              <PlusIcon size={14} />
              <span>+ Section Playlist</span>
            </button>
          )}
        </div>

        {/* Inline form to create new playlist */}
        {isCreatingPlaylist && (
          <form
            onSubmit={handleSaveNewPlaylist}
            className="flex items-center gap-2 p-2.5 rounded-2xl bg-slate-900 border border-emerald-500/40 animate-in fade-in"
          >
            <span className="text-emerald-400 font-bold text-xs pl-1">Nama Playlist:</span>
            <input
              type="text"
              value={newPlaylistName}
              onChange={(e) => setNewPlaylistName(e.target.value)}
              placeholder="Contoh: Babak 1 (Pop Indo), Final, Rock 90s..."
              autoFocus
              className="flex-1 bg-slate-800 text-white placeholder-slate-500 px-3 py-1.5 rounded-xl text-xs outline-none border border-white/10 focus:border-emerald-400"
            />
            <button
              type="submit"
              className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-sm"
            >
              Simpan
            </button>
            <button
              type="button"
              onClick={() => {
                setIsCreatingPlaylist(false)
                setNewPlaylistName('')
              }}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white"
            >
              <CrossIcon size={14} />
            </button>
          </form>
        )}
      </div>

      {/* Active Section Header Bar (if a specific playlist is selected) */}
      {activePlaylist && (
        <div className="flex items-center justify-between p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-xs">
          <div className="flex items-center gap-2">
            <span className="font-mono text-[11px] uppercase tracking-wider text-emerald-400 bg-emerald-500/20 px-2 py-0.5 rounded-md font-black">
              SECTION
            </span>
            {editingPlaylistId === activePlaylist.id ? (
              <form
                onSubmit={(e) => handleSaveRename(e, activePlaylist.id)}
                className="flex items-center gap-1.5"
              >
                <input
                  type="text"
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  className="bg-slate-900 text-white px-2 py-1 rounded-lg text-xs border border-emerald-400 outline-none"
                />
                <button
                  type="submit"
                  className="px-2 py-1 bg-emerald-400 text-slate-950 font-bold rounded-lg text-[10px]"
                >
                  OK
                </button>
                <button
                  type="button"
                  onClick={() => setEditingPlaylistId(null)}
                  className="p-1 text-slate-400 hover:text-white"
                >
                  ✕
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-1.5">
                <span className="text-white font-extrabold text-sm">{activePlaylist.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setEditingPlaylistId(activePlaylist.id)
                    setEditingName(activePlaylist.name)
                  }}
                  title="Ganti nama playlist"
                  className="text-slate-400 hover:text-emerald-300 p-0.5"
                >
                  <EditIcon size={13} />
                </button>
              </div>
            )}
            <span className="text-slate-400 text-[11px]">
              • {activePlaylist.songIds.length} Lagu
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            {onDeletePlaylist && (
              <button
                type="button"
                onClick={() => {
                  if (confirm(`Hapus section playlist "${activePlaylist.name}"?`)) {
                    onDeletePlaylist(activePlaylist.id)
                  }
                }}
                className="text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 px-2 py-1 rounded-lg transition-colors flex items-center gap-1 text-[11px]"
              >
                <TrashIcon size={12} />
                <span>Hapus Section</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Search Input in Playlist */}
      <div className="relative">
        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500">
          <SearchIcon size={16} />
        </span>
        <input
          type="text"
          placeholder={
            activePlaylist
              ? `Cari lagu di "${activePlaylist.name}" atau tekan Enter untuk cari Spotify...`
              : 'Filter lagu atau tekan Enter untuk cari di Spotify...'
          }
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={handleKeyDown}
          className="w-full bg-slate-900/90 text-white placeholder-slate-500 rounded-2xl pl-10 pr-24 py-2.5 text-xs sm:text-sm outline-none border border-slate-700/60 focus:border-emerald-500 transition-all"
        />
        {search.trim() && onOpenSpotifySearch && (
          <button
            type="button"
            onClick={() => onOpenSpotifySearch(search.trim())}
            className="absolute right-2 top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30 text-[11px] font-bold transition-all flex items-center gap-1"
          >
            <span>Spotify</span>
            <span>↵</span>
          </button>
        )}
      </div>

      {/* Song list with Playlist queue number & checklist items */}
      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        {filtered.map((song, index) => {
          const isSelected = currentSongId === song.id
          const isSpotify = song.audio_url?.startsWith('spotify:track:')
          const isDeleting = deletingId === song.id

          return (
            <div
              key={song.id}
              onClick={() => onSelectSong(song)}
              className={`w-full text-left p-3.5 rounded-2xl transition-all border flex items-center justify-between gap-3 group cursor-pointer ${
                isSelected
                  ? 'bg-emerald-500/20 border-emerald-500/60 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-400/40'
                  : 'bg-slate-900/60 hover:bg-slate-800/80 border-white/5'
              }`}
            >
              <div className="min-w-0 flex items-center gap-3">
                {/* Playlist Number or Checklist Box */}
                <div
                  className={`w-7 h-7 rounded-xl border-2 flex items-center justify-center shrink-0 transition-all ${
                    isSelected
                      ? 'bg-emerald-400 border-emerald-400 text-slate-950 shadow-md shadow-emerald-400/40 scale-105 font-black text-xs'
                      : 'border-slate-700 bg-slate-800/80 group-hover:border-slate-500 text-slate-400 text-xs font-bold'
                  }`}
                >
                  {isSelected ? (
                    <CheckIcon size={16} className="stroke-[3]" />
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </div>

                <div className="truncate">
                  <div className="flex items-center gap-2">
                    <p className={`font-bold text-sm truncate ${isSelected ? 'text-emerald-300 font-extrabold' : 'text-white'}`}>
                      {song.title}
                    </p>
                    {isSpotify && (
                      <span className="text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/20 px-1.5 py-0.5 rounded border border-emerald-500/30 shrink-0">
                        Spotify
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-slate-400 truncate mt-0.5">{song.artist}</p>
                </div>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                {isSelected && (
                  <span className="text-[10px] font-black uppercase tracking-wider bg-emerald-400/20 text-emerald-300 px-2.5 py-0.5 rounded-full border border-emerald-400/40">
                    Aktif
                  </span>
                )}

                {/* Remove from section or delete button */}
                <button
                  type="button"
                  onClick={(e) => handleDeleteSong(e, song.id)}
                  disabled={isDeleting}
                  title={activePlaylist ? 'Keluarkan dari playlist ini' : 'Hapus lagu'}
                  className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition-colors"
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            </div>
          )
        })}

        {/* Empty state */}
        {filtered.length === 0 && (
          <div className="text-center py-8 px-4 space-y-3 bg-slate-900/50 rounded-2xl border border-white/5">
            <p className="text-slate-400 text-xs">
              {search.trim()
                ? `Lagu "${search}" tidak ditemukan ${activePlaylist ? `di playlist ${activePlaylist.name}` : ''}.`
                : activePlaylist
                ? `Section playlist "${activePlaylist.name}" masih kosong.`
                : 'Belum ada lagu di daftar putar.'}
            </p>
            {onOpenSpotifySearch && (
              <button
                type="button"
                onClick={() => onOpenSpotifySearch(search.trim())}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs flex items-center justify-center gap-2 mx-auto transition-all active:scale-95 shadow-lg shadow-emerald-500/20"
              >
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                  <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.307c-.218.358-.68.472-1.038.254-2.846-1.74-6.428-2.133-10.648-1.168-.41.094-.82-.162-.914-.572-.093-.41.163-.82.573-.914 4.624-1.057 8.583-.615 11.773 1.362.358.218.472.68.254 1.038zm1.467-3.262c-.274.446-.86.588-1.306.314-3.258-2.003-8.224-2.585-12.077-1.415-.498.151-1.028-.135-1.18-.633-.15-.498.136-1.028.634-1.18 4.407-1.338 9.883-.69 13.615 1.608.446.274.588.86.314 1.306zm.126-3.41c-3.908-2.32-10.354-2.533-14.093-1.398-.6.182-1.238-.162-1.42-.762-.182-.6.162-1.238.762-1.42 4.303-1.306 11.417-1.055 15.918 1.617.538.319.713 1.018.394 1.556-.319.538-1.018.713-1.556.394z" />
                </svg>
                <span>
                  Cari &amp; Tambah Lagu Spotify{' '}
                  {activePlaylist ? `ke ${activePlaylist.name}` : ''}
                </span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
