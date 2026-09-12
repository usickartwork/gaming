'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/types'

/**
 * Subscribes to real-time changes on the games table for a specific game.
 * Returns the live game state, updating whenever the host changes anything.
 */
export function useGameState(gameId: string, initialGame: Game): Game {
  const [game, setGame] = useState<Game>(initialGame)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`game-state:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        (payload: { new: Record<string, unknown> }) => {
          setGame(payload.new as unknown as Game)
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`,
        },
        () => {
          setGame((prev) => ({ ...prev, status: 'FINAL_RESULT', buzz_state: 'DISABLED' }))
        }
      )
      .subscribe()

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId])

  return game
}
