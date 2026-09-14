import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/games/[roomCode]
 * Returns full snapshot of current game state and active players for instant reconnection sync.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const normalized = roomCode.toUpperCase()
    const supabase = getSupabaseServerClient()

    const { data: game, error: gameErr } = await supabase
      .from('games')
      .select('*')
      .eq('room_code', normalized)
      .single()

    if (gameErr || !game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const { data: players } = await supabase
      .from('players')
      .select('id, game_id, name, score, connected, excluded_attempt, joined_at')
      .eq('game_id', game.id)
      .order('score', { ascending: false })

    return NextResponse.json({
      game,
      players: players || [],
    })
  } catch (err) {
    console.error('GET /api/games/[roomCode] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
