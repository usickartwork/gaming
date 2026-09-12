'use client'

import { useState, useEffect, useRef } from 'react'
import { CrossIcon, MusicIcon, CheckIcon } from '@/components/shared/Icons'

export interface SpotifyTrack {
  id: string
  title: string
  artist: string
  album?: string
  albumArt?: string | null
  durationMs: number
  uri: string
  previewUrl?: string | null
}

interface SpotifySearchModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectTrack: (track: SpotifyTrack) => Promise<void>
  onAddToPlaylist?: (track: SpotifyTrack) => Promise<void>
  existingSongUris?: string[]
  initialQuery?: string
  isLoading?: boolean
}

export function SpotifySearchModal({
  isOpen,
  onClose,
  onSelectTrack,
  onAddToPlaylist,
  existingSongUris = [],
  initialQuery = '',
  isLoading = false,
}: SpotifySearchModalProps) {
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [addingUri, setAddingUri] = useState<string | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [addedUris, setAddedUris] = useState<Set<string>>(new Set())
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  // Sync added tracks from props
  useEffect(() => {
    setAddedUris(new Set(existingSongUris))
  }, [existingSongUris])

  const performSearch = async (val: string) => {
    if (!val.trim()) {
      setTracks([])
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    setSearchError(null)

    try {
      const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(val.trim())}`)
      const data = await res.json()
      if (res.ok && data.tracks) {
        setTracks(data.tracks)
        setSearchError(null)
      } else {
        setTracks([])
        setSearchError(data.error || 'Gagal mencari lagu di Spotify')
      }
    } catch (err) {
      console.error('Spotify search failed:', err)
      setTracks([])
      setSearchError('Terjadi kendala jaringan saat menghubungi Spotify.')
    } finally {
      setIsSearching(false)
    }
  }

  useEffect(() => {
    if (isOpen) {
      const initial = initialQuery.trim()
      setQuery(initial)
      if (initial) {
        performSearch(initial)
      } else {
        setTracks([])
        setSearchError(null)
      }
    } else {
      setQuery('')
      setTracks([])
      setSearchError(null)
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [isOpen, initialQuery])

  const handleInputChange = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!val.trim()) {
      setTracks([])
      setIsSearching(false)
      setSearchError(null)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(() => {
      performSearch(val)
    }, 350)
  }

  // Quick add to playlist without closing modal
  const handleAdd = async (track: SpotifyTrack) => {
    if (!onAddToPlaylist) return
    setAddingUri(track.uri)
    try {
      await onAddToPlaylist(track)
      setAddedUris((prev) => new Set(prev).add(track.uri))
    } catch (err) {
      console.error('Add to playlist failed:', err)
    } finally {
      setAddingUri(null)
    }
  }

  // Play immediately and close modal
  const handlePickAndPlay = async (track: SpotifyTrack) => {
    setAddingUri(track.uri)
    try {
      await onSelectTrack(track)
      setAddedUris((prev) => new Set(prev).add(track.uri))
      onClose()
    } catch (err) {
      console.error('Pick song failed:', err)
    } finally {
      setAddingUri(null)
    }
  }

  const formatDuration = (ms: number) => {
    const s = Math.floor(ms / 1000)
    const m = Math.floor(s / 60)
    const sec = s % 60
    return `${m}:${sec.toString().padStart(2, '0')}`
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="glass-panel rounded-3xl p-5 sm:p-7 max-w-2xl w-full border border-emerald-500/40 bg-slate-950 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-black">
              {/* Spotify SVG Icon */}
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.498 17.307c-.218.358-.68.472-1.038.254-2.846-1.74-6.428-2.133-10.648-1.168-.41.094-.82-.162-.914-.572-.093-.41.163-.82.573-.914 4.624-1.057 8.583-.615 11.773 1.362.358.218.472.68.254 1.038zm1.467-3.262c-.274.446-.86.588-1.306.314-3.258-2.003-8.224-2.585-12.077-1.415-.498.151-1.028-.135-1.18-.633-.15-.498.136-1.028.634-1.18 4.407-1.338 9.883-.69 13.615 1.608.446.274.588.86.314 1.306zm.126-3.41c-3.908-2.32-10.354-2.533-14.093-1.398-.6.182-1.238-.162-1.42-.762-.182-.6.162-1.238.762-1.42 4.303-1.306 11.417-1.055 15.918 1.617.538.319.713 1.018.394 1.556-.319.538-1.018.713-1.556.394z" />
              </svg>
            </div>
            <div>
              <h3 className="text-white font-black text-lg tracking-tight">Cari &amp; Buat Playlist Spotify</h3>
              <p className="text-slate-400 text-xs">Pilih dan tambahkan beberapa lagu sekaligus ke playlist sesi game</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white flex items-center justify-center transition-colors"
          >
            <CrossIcon size={14} />
          </button>
        </div>

        {/* Search Input Box */}
        <div className="relative shrink-0">
          <input
            type="text"
            value={query}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                performSearch(query)
              }
            }}
            placeholder="Ketik judul lagu atau nama musisi... (tekan Enter)"
            autoFocus
            className="w-full py-3.5 px-4 pr-11 rounded-2xl bg-slate-900 border border-white/10 focus:border-emerald-400 text-white font-medium text-sm outline-none transition-all placeholder:text-slate-500"
          />
          {isSearching && (
            <div className="absolute right-4 top-3.5 w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Error notification if any */}
        {searchError && (
          <div className="p-3 rounded-2xl bg-rose-500/15 border border-rose-500/30 text-rose-300 text-xs font-semibold flex items-center justify-between gap-2 shrink-0">
            <span>{searchError}</span>
            <button
              type="button"
              onClick={() => performSearch(query)}
              className="text-[11px] underline hover:text-white shrink-0"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Results List */}
        <div className="overflow-y-auto space-y-2.5 flex-1 pr-1 min-h-[260px]">
          {tracks.map((track) => {
            const isAlreadyAdded = addedUris.has(track.uri)
            const isBusy = addingUri === track.uri || isLoading

            return (
              <div
                key={track.id}
                className={`flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-2xl border transition-all gap-3 ${
                  isAlreadyAdded
                    ? 'bg-emerald-950/20 border-emerald-500/30 ring-1 ring-emerald-500/20'
                    : 'bg-slate-900/70 border-white/5 hover:border-white/15'
                }`}
              >
                <div className="flex items-center gap-3.5 min-w-0 flex-1">
                  {track.albumArt ? (
                    <img
                      src={track.albumArt}
                      alt={track.title}
                      className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md"
                    />
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-slate-800 flex items-center justify-center text-slate-500 shrink-0">
                      <MusicIcon size={20} />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <p className="text-white font-bold text-sm truncate">
                      {track.title}
                    </p>
                    <p className="text-slate-400 text-xs truncate mt-0.5">{track.artist}</p>
                  </div>

                  <span className="text-slate-500 font-mono text-xs shrink-0 sm:hidden">
                    {formatDuration(track.durationMs)}
                  </span>
                </div>

                <div className="flex items-center justify-end gap-2 shrink-0">
                  <span className="text-slate-500 font-mono text-xs hidden sm:inline mr-1">
                    {formatDuration(track.durationMs)}
                  </span>

                  {/* Button 1: Add to Playlist */}
                  {isAlreadyAdded ? (
                    <span className="px-3 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-sm">
                      <CheckIcon size={13} className="stroke-[3]" />
                      <span>Di Playlist</span>
                    </span>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAdd(track)}
                      disabled={isBusy}
                      className="px-3.5 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/10 disabled:opacity-40 text-white font-bold text-xs transition-all active:scale-95 flex items-center gap-1.5"
                    >
                      <span>+ Playlist</span>
                    </button>
                  )}

                  {/* Button 2: Play Now */}
                  <button
                    type="button"
                    onClick={() => handlePickAndPlay(track)}
                    disabled={isBusy}
                    className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/20 flex items-center gap-1"
                  >
                    <span>Mainkan</span>
                  </button>
                </div>
              </div>
            )
          })}

          {!isSearching && !searchError && query.trim() && tracks.length === 0 && (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <p className="text-sm font-semibold">Tidak ada lagu ditemukan untuk &quot;{query}&quot;</p>
              <p className="text-xs">Coba cari dengan kata kunci judul atau nama musisi yang lebih umum.</p>
            </div>
          )}

          {!query.trim() && (
            <div className="text-center py-12 text-slate-500 space-y-1">
              <p className="text-sm font-semibold text-slate-300">Pencarian Katalog Spotify</p>
              <p className="text-xs text-slate-500">
                Ketik nama lagu di atas lalu klik <strong>&quot;+ Playlist&quot;</strong> untuk menampung beberapa lagu sekaligus.
              </p>
            </div>
          )}
        </div>

        {/* Footer info & Done button */}
        <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-3 shrink-0">
          <div className="text-xs text-slate-400">
            <span className="text-emerald-400 font-bold">{addedUris.size}</span> lagu ada di playlist game
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/25"
          >
            Selesai Memilih ({addedUris.size} Lagu)
          </button>
        </div>
      </div>
    </div>
  )
}
