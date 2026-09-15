'use client'

import { useEffect, useState, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { Game } from '@/lib/types'

/**
 * Broadcasts sub-50ms ultra-low latency WebSocket signals directly between Host and Players.
 * Prefers the already-subscribed channel so the broadcast is never silently dropped.
 */
export function broadcastFastBuzz(gameId: string, payload: Record<string, any>) {
  try {
    const supabase = getSupabaseBrowserClient()
    const channels = supabase.getChannels()
    // Supabase internally prefixes topic with 'realtime:'
    const existing = channels.find(
      (ch: any) =>
        ch.topic === `realtime:game-state:${gameId}` ||
        ch.topic === `game-state:${gameId}`
    )

    if (existing) {
      existing.send({ type: 'broadcast', event: 'fast_buzz', payload })
    } else {
      // Fallback: open a temporary channel and broadcast once subscribed
      const ch = supabase.channel(`game-state:${gameId}`, {
        config: { broadcast: { self: true, ack: false } },
      })
      ch.subscribe((status: string) => {
        if (status === 'SUBSCRIBED') {
          ch.send({ type: 'broadcast', event: 'fast_buzz', payload })
        }
      })
    }
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
 * combining instant WebSocket broadcast events with persistent database changes
 * and automatic sleep/wake resynchronization.
 */
export function useGameState(gameId: string, initialGame: Game): Game {
  const [game, setGame] = useState<Game>(initialGame)
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)
  // Use a stable ref so useEffect never re-runs due to object identity changes
  const roomCodeRef = useRef(initialGame.room_code)

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    const channel = supabase
      .channel(`game-state:${gameId}`, {
        config: {
          broadcast: { self: true, ack: false },
        },
      })
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
                case 'RESET_BUZZ':
                  next.buzz_state = 'READY'
                  next.buzz_winner_id = null
                  next.current_attempt = 1
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
                    next.buzz_winner_id = msg.payload?.winnerId || prev.buzz_winner_id
                    next.current_attempt = 1
                  } else if (msg.payload?.result === 'WRONG') {
                    if (msg.payload?.allWrong) {
                      next.buzz_state = 'RESULT'
                      next.buzz_winner_id = null
                      next.current_attempt = 1
                    } else if (msg.payload?.duelTurnPassed && msg.payload?.nextPlayerId) {
                      next.buzz_state = 'LOCKED'
                      next.buzz_winner_id = msg.payload.nextPlayerId
                      next.current_attempt = 2
                    } else {
                      next.buzz_state = 'READY'
                      next.buzz_winner_id = null
                      next.current_attempt = msg.payload?.nextAttempt || (prev.current_attempt || 1) + 1
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

    // ── Resynchronize on Screen Unlock / Tab Refocus (Mobile Sleep & Wake) ──
    const syncFreshSnapshot = async () => {
      try {
        const roomCode = roomCodeRef.current
        if (!roomCode) return
        const res = await fetch(`/api/games/${roomCode}`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          if (data.game) {
            setGame(data.game)
          }
        }
      } catch {
        // ignore network error during background sleep
      }
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        syncFreshSnapshot()
      }
    }

    window.addEventListener('focus', syncFreshSnapshot)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('focus', syncFreshSnapshot)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      supabase.removeChannel(channel)
    }
  }, [gameId]) // gameId is stable — never changes for the same room

  return game
}
