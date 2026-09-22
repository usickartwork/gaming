import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/games/[roomCode]/join
 * Player joins a game room.
 * Body: { name: string }
 * Returns: { playerId, sessionToken, gameId, playerName }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const { name } = await req.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Name required' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Find game by room code
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('id, status')
      .eq('room_code', roomCode.toUpperCase())
      .single()

    if (gameError || !game) {
      return NextResponse.json({ error: 'Room not found' }, { status: 404 })
    }

    // Check if player with this name already exists in room (e.g. added by host, or rejoining)
    const { data: existing } = await supabase
      .from('players')
      .select('id, name, session_token')
      .eq('game_id', game.id)
      .ilike('name', name.trim())
      .single()

    if (existing) {
      await supabase
        .from('players')
        .update({ connected: true })
        .eq('id', existing.id)

      return NextResponse.json({
        playerId: existing.id,
        sessionToken: existing.session_token,
        gameId: game.id,
        playerName: existing.name,
      })
    }

    if (game.status !== 'LOBBY') {
      return NextResponse.json({ error: 'Game already started' }, { status: 400 })
    }

    // Check player count
    const { count } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', game.id)

    if ((count ?? 0) >= 30) {
      return NextResponse.json({ error: 'Room is full (max 30 players)' }, { status: 400 })
    }

    // Insert player
    const { data: player, error: playerError } = await supabase
      .from('players')
      .insert({
        game_id: game.id,
        name: name.trim(),
        score: 0,
        connected: true,
      })
      .select()
      .single()

    if (playerError || !player) {
      throw playerError
    }

    return NextResponse.json({
      playerId: player.id,
      sessionToken: player.session_token,
      gameId: game.id,
      playerName: player.name,
    })
  } catch (err) {
    console.error('POST /api/games/[roomCode]/join error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
