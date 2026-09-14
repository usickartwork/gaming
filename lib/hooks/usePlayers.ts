'use client'

import { useEffect, useState, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Player } from '@/lib/types'

/**
 * Subscribes to real-time changes on the players table for a specific game,
 * with auto-resync on window focus / mobile wake.
 * Returns the live list of players, sorted by score descending.
 */
export function usePlayers(gameId: string, initialPlayers: Player[]): Player[] {
  const [players, setPlayers] = useState<Player[]>(initialPlayers)

  const fetchFreshPlayers = useCallback(async () => {
    try {
      const supabase = getSupabaseBrowserClient()
      const { data } = await supabase
        .from('players')
        .select('id, game_id, name, score, connected, excluded_attempt, joined_at')
        .eq('game_id', gameId)
        .order('score', { ascending: false })

      if (data && data.length > 0) {
        setPlayers(data as Player[])
      }
    } catch {
      // ignore network hiccup during background sleep
    }
  }, [gameId])

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`players:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*', // INSERT, UPDATE, DELETE
          schema: 'public',
          table: 'players',
          filter: `game_id=eq.${gameId}`,
        },
        (payload: { eventType: string; new: Record<string, unknown>; old: Record<string, unknown> }) => {
          if (payload.eventType === 'INSERT') {
            setPlayers((prev) => [...prev, payload.new as unknown as Player])
          } else if (payload.eventType === 'UPDATE') {
            setPlayers((prev) =>
              prev.map((p) => (p.id === payload.new.id ? (payload.new as unknown as Player) : p))
            )
          } else if (payload.eventType === 'DELETE') {
            setPlayers((prev) => prev.filter((p) => p.id !== payload.old.id))
          }
        }
      )
      .subscribe()

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        fetchFreshPlayers()
      }
    }

    window.addEventListener('focus', fetchFreshPlayers)
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      window.removeEventListener('focus', fetchFreshPlayers)
      document.removeEventListener('visibilitychange', handleVisibility)
      supabase.removeChannel(channel)
    }
  }, [gameId, fetchFreshPlayers])

  // Sort by score descending
  return [...players].sort((a, b) => b.score - a.score)
}
