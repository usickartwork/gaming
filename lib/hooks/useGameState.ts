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
 * Host-only broadcast: signal players about a host action (NEXT_SONG, SET_BUZZ_STATE, etc.)
 * so they don't have to wait for the slower postgres_changes path.
 */
export function broadcastHostAction(gameId: string, action: string, payload?: Record<string, any>) {
  broadcastFastBuzz(gameId, { type: 'HOST_ACTION', action, payload })
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
          } else if (msg.type === 'HOST_ACTION') {
            setGame((prev) => {
              const next = { ...prev }
              switch (msg.action) {
                case 'NEXT_SONG':
                  next.current_song_id = null
                  next.buzz_state = 'DISABLED'
                  next.buzz_winner_id = null
                  next.current_attempt = 1
                  break
                case 'SET_BUZZ_STATE':
                  next.buzz_state = msg.payload?.buzzState || 'DISABLED'
                  next.buzz_winner_id = null
                  break
                case 'SET_CURRENT_SONG':
                  next.current_song_id = msg.payload?.songId || null
                  next.buzz_state = 'DISABLED'
                  next.buzz_winner_id = null
                  next.current_attempt = 1
                  break
                case 'SET_GAME_STATUS':
                  next.status = msg.payload?.status || prev.status
                  break
                case 'SET_ROUND':
                  next.current_round = msg.payload?.round || prev.current_round
                  next.current_song_id = null
                  next.buzz_state = 'DISABLED'
                  next.buzz_winner_id = null
                  next.current_attempt = 1
                  break
                case 'ANSWER_RESULT':
                  if (msg.payload?.result === 'CORRECT') {
                    next.buzz_state = 'RESULT'
                    next.buzz_winner_id = null
                    next.current_attempt = 1
                  } else if (msg.payload?.result === 'WRONG') {
                    if (msg.payload?.allWrong) {
                      next.buzz_state = 'RESULT'
                      next.buzz_winner_id = null
                      next.current_attempt = 1
                    } else {
                      next.buzz_state = 'READY'
                      next.buzz_winner_id = null
                      next.current_attempt = (prev.current_attempt || 1) + 1
                    }
                  }
                  break
              }
              return next
            })
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
