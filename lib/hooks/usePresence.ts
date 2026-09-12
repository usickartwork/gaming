'use client'

import { useEffect, useRef } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

interface PresencePayload {
  playerId: string
  playerName: string
}

/**
 * Tracks the current player's online presence in a game room.
 * When the player connects/disconnects, updates their `connected` status in the DB.
 */
export function usePresence(
  gameId: string,
  playerId: string,
  playerName: string,
  sessionToken: string
) {
  const channelRef = useRef<ReturnType<ReturnType<typeof getSupabaseBrowserClient>['channel']> | null>(null)

  useEffect(() => {
    if (!playerId || !gameId) return

    const supabase = getSupabaseBrowserClient()
    const channel = supabase.channel(`presence:${gameId}`)

    channel
      .on('presence', { event: 'join' }, ({ newPresences }: { newPresences: PresencePayload[] }) => {
        // Other players joined — handled by usePlayers via DB changes
        console.log('Player joined presence:', newPresences)
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }: { leftPresences: PresencePayload[] }) => {
        // Update connected status when someone leaves
        leftPresences.forEach(async (p: PresencePayload) => {
          if (p.playerId !== playerId) return
          // Mark self as disconnected via API
          await fetch(`/api/games/presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, sessionToken, connected: false }),
          })
        })
      })
      .subscribe(async (status: string) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ playerId, playerName } as PresencePayload)
          // Mark as connected
          await fetch(`/api/games/presence`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ playerId, sessionToken, connected: true }),
          })
        }
      })

    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [gameId, playerId, playerName, sessionToken])
}
