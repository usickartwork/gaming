import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState } from '@/lib/tournament-utils'

/**
 * POST /api/admin/[roomCode]/buzz
 * Player attempts to buzz in.
 * Headers: x-session-token: <token>
 * Body: { playerId: string }
 * Returns: { winner: boolean, winnerId?, winnerName? }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const sessionToken = req.headers.get('x-session-token')
    const { playerId } = await req.json()

    if (!sessionToken || !playerId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Parallel verification queries
    const [
      { data: player, error: playerErr },
      { data: game, error: gameErr }
    ] = await Promise.all([
      supabase
        .from('players')
        .select('id, game_id, name, excluded_attempt')
        .eq('id', playerId)
        .eq('session_token', sessionToken)
        .single(),
      supabase
        .from('games')
        .select('id, name, buzz_state, current_attempt')
        .eq('room_code', roomCode.toUpperCase())
        .single(),
    ])

    if (playerErr || !player) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (gameErr || !game || game.id !== player.game_id) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Check if tournament mode restricts buzzing to the 2 active duelists
    const mode = getGameMode(game)
    if (mode === 'KNOCKOUT') {
      const ts = getTournamentState(game)
      const activeMatch = ts?.matches?.find((m) => m.id === ts.activeMatchId)
      if (activeMatch && activeMatch.player1Id !== playerId && activeMatch.player2Id !== playerId) {
        return NextResponse.json(
          { error: 'Buzzer hanya untuk 2 pemain yang sedang bertanding di duel ini!' },
          { status: 403 }
        )
      }
    }

    // Check if player is excluded from this attempt
    if (player.excluded_attempt === game.current_attempt) {
      return NextResponse.json(
        { error: 'You cannot buzz on this attempt (answered wrong previously)' },
        { status: 403 }
      )
    }

    if (game.buzz_state !== 'READY') {
      return NextResponse.json({ error: 'Buzzer is not active' }, { status: 400 })
    }

    // 4. Atomic buzz — call PostgreSQL function
    const { data: winnerId } = await supabase.rpc('atomic_buzz', {
      p_game_id: game.id,
      p_player_id: playerId,
    })

    if (winnerId) {
      // This player won the buzz!
      return NextResponse.json({ winner: true, winnerId: playerId, winnerName: player.name })
    }

    // Someone else already buzzed — get winner info
    const { data: updatedGame } = await supabase
      .from('games')
      .select('buzz_winner_id, players!buzz_winner_id(name)')
      .eq('id', game.id)
      .single()

    const winnerName =
      updatedGame && Array.isArray(updatedGame.players)
        ? (updatedGame.players[0] as { name: string })?.name
        : null

    return NextResponse.json({
      winner: false,
      winnerId: updatedGame?.buzz_winner_id,
      winnerName,
    })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
