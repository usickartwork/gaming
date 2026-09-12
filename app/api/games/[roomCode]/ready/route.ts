import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  getTournamentState,
  setPlayerReady,
  encodeGameStateName,
} from '@/lib/tournament-utils'

/**
 * POST /api/games/[roomCode]/ready
 * Toggles a player's readiness state before starting music or next round.
 * Headers: x-session-token: <session_token>
 * Body: { playerId: string, ready?: boolean }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const sessionToken = req.headers.get('x-session-token')
    const { playerId, ready = true } = await req.json()

    if (!sessionToken || !playerId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Parallel verification of player session and game room
    const [
      { data: player, error: playerErr },
      { data: game, error: gameErr },
    ] = await Promise.all([
      supabase
        .from('players')
        .select('id, game_id, name')
        .eq('id', playerId)
        .eq('session_token', sessionToken)
        .single(),
      supabase
        .from('games')
        .select('id, name, status, current_song_id')
        .eq('room_code', roomCode.toUpperCase())
        .single(),
    ])

    if (playerErr || !player) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (gameErr || !game || game.id !== player.game_id) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const currentTS = getTournamentState(game)
    const updatedTS = setPlayerReady(currentTS, playerId, Boolean(ready))
    const encodedName = encodeGameStateName(game.name, updatedTS)

    await supabase
      .from('games')
      .update({ name: encodedName })
      .eq('id', game.id)

    try {
      await supabase
        .from('games')
        .update({ tournament_state: updatedTS })
        .eq('id', game.id)
    } catch {
      // ignore if column not present
    }

    return NextResponse.json({
      ok: true,
      readyPlayerIds: updatedTS.readyPlayerIds || [],
    })
  } catch (err) {
    console.error('POST /api/games/[roomCode]/ready error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

