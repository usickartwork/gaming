'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/types'

/**
 * Broadcasts sub-50ms ultra-low latency WebSocket signals directly between Host and Players.
 * Bypasses database disk latency for instantaneous UI and audio reactions.
 */
export function broadcastFastBuzz(gameId: string, payload: Record<string, any>) {
  try {
    const supabase = getSupabaseBrowserClient()
    const channel = supabase.channel(`game-state:${gameId}`)
    channel.send({
      type: 'broadcast',
      event: 'fast_buzz',
      payload,
    })
  } catch (err) {
    console.warn('broadcastFastBuzz error:', err)
  }
}

/**
 * Subscribes to real-time changes on the games table for a specific game,
 * combining instant WebSocket broadcast events with persistent database changes.
 */
export function useGameState(gameId: string, initialGame: Game): Game {
  const [game, setGame] = useState<Game>(initialGame)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`game-state:${gameId}`)
      .on(
        'broadcast',
        { event: 'fast_buzz' },
        (payload: { payload: Record<string, any> }) => {
          const msg = payload?.payload
          if (!msg) return
          if (msg.type === 'BUZZ_STATE') {
            setGame((prev) => ({
              ...prev,
              buzz_state: msg.buzzState,
              buzz_winner_id: msg.winnerId ?? null,
            }))
          } else if (msg.type === 'BUZZ_WINNER') {
            setGame((prev) => ({
              ...prev,
              buzz_state: 'LOCKED',
              buzz_winner_id: msg.winnerId,
            }))
          }
        }
      )
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
