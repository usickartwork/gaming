'use client'

import { useState, useEffect, useRef } from 'react'
import { CrossIcon, MusicIcon, CheckIcon } from '@/components/shared/Icons'

interface SpotifyTrack {
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
  isLoading?: boolean
}

export function SpotifySearchModal({
  isOpen,
  onClose,
  onSelectTrack,
  isLoading = false,
}: SpotifySearchModalProps) {
  const [query, setQuery] = useState('')
  const [tracks, setTracks] = useState<SpotifyTrack[]>([])
  const [isSearching, setIsSearching] = useState(false)
  const [selectedUri, setSelectedUri] = useState<string | null>(null)
  const debounceRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setTracks([])
      setSelectedUri(null)
    }
  }, [isOpen])

  const handleSearch = (val: string) => {
    setQuery(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (!val.trim()) {
      setTracks([])
      setIsSearching(false)
      return
    }

    setIsSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/spotify/search?q=${encodeURIComponent(val.trim())}`)
        const data = await res.json()
        if (data.tracks) {
          setTracks(data.tracks)
        }
      } catch (err) {
        console.error('Spotify search failed:', err)
      } finally {
        setIsSearching(false)
      }
    }, 350)
  }

  const handlePick = async (track: SpotifyTrack) => {
    setSelectedUri(track.uri)
    try {
      await onSelectTrack(track)
      onClose()
    } catch (err) {
      console.error('Pick song failed:', err)
    } finally {
      setSelectedUri(null)
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
      <div className="glass-panel rounded-3xl p-5 sm:p-7 max-w-xl w-full border border-emerald-500/40 bg-slate-950 shadow-2xl space-y-4 max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
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
              <h3 className="text-white font-black text-lg tracking-tight">Cari Lagu di Spotify</h3>
              <p className="text-slate-400 text-xs">Ketik judul lagu atau nama artis untuk dimainkan langsung</p>
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
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Ketik judul lagu atau nama musisi..."
            autoFocus
            className="w-full py-3.5 px-4 rounded-2xl bg-slate-900 border border-white/10 focus:border-emerald-400 text-white font-medium text-sm outline-none transition-all placeholder:text-slate-500"
          />
          {isSearching && (
            <div className="absolute right-4 top-3.5 w-5 h-5 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" />
          )}
        </div>

        {/* Results List */}
        <div className="overflow-y-auto space-y-2 flex-1 pr-1 min-h-[220px]">
          {tracks.map((track) => {
            const isPicking = selectedUri === track.uri || isLoading
            return (
              <div
                key={track.id}
                className="flex items-center justify-between p-3 rounded-2xl bg-slate-900/70 border border-white/5 hover:border-emerald-500/30 transition-all gap-3 group"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
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
                    <p className="text-white font-bold text-sm truncate group-hover:text-emerald-300 transition-colors">
                      {track.title}
                    </p>
                    <p className="text-slate-400 text-xs truncate mt-0.5">{track.artist}</p>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-slate-500 font-mono text-xs">{formatDuration(track.durationMs)}</span>
                  <button
                    type="button"
                    onClick={() => handlePick(track)}
                    disabled={isPicking}
                    className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 disabled:opacity-40 text-slate-950 font-black text-xs transition-all active:scale-95 shadow-md shadow-emerald-500/20 flex items-center gap-1.5"
                  >
                    <CheckIcon size={12} />
                    <span>{isPicking ? 'Memuat...' : 'Pilih'}</span>
                  </button>
                </div>
              </div>
            )
          })}

          {!isSearching && query.trim() && tracks.length === 0 && (
            <div className="text-center py-12 text-slate-500 space-y-2">
              <p className="text-sm font-semibold">Tidak ada lagu ditemukan untuk &quot;{query}&quot;</p>
              <p className="text-xs">Coba cari dengan kata kunci judul atau nama artis yang lebih spesifik.</p>
            </div>
          )}

          {!query.trim() && (
            <div className="text-center py-12 text-slate-500 space-y-1">
              <p className="text-sm font-semibold text-slate-400">Pencarian Katalog Spotify</p>
              <p className="text-xs">Ketik nama lagu di atas untuk memuat pilihan lagu dari Spotify.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
