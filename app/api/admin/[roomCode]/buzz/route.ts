import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState } from '@/lib/tournament-utils'

/**
 * POST /api/admin/[roomCode]/buzz
 * Ultra-responsive atomic buzzer endpoint.
 * Evaluates session, checks exclusions, and executes atomic PostgreSQL lock in <50ms.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const normalizedRoom = roomCode.toUpperCase()
    const sessionToken = req.headers.get('x-session-token')
    const body = await req.json()
    const { playerId } = body

    if (!sessionToken || !playerId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Parallel session & game verification
    const [
      { data: player, error: playerErr },
      { data: game, error: gameErr },
    ] = await Promise.all([
      supabase
        .from('players')
        .select('id, game_id, name, excluded_attempt')
        .eq('id', playerId)
        .eq('session_token', sessionToken)
        .single(),
      supabase
        .from('games')
        .select('id, name, buzz_state, buzz_winner_id, current_attempt')
        .eq('room_code', normalizedRoom)
        .single(),
    ])

    if (playerErr || !player) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (gameErr || !game || game.id !== player.game_id) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Check if tournament mode restricts buzzing
    const mode = getGameMode(game)
    if (mode === 'KNOCKOUT') {
      const ts = getTournamentState(game)
      if (ts) {
        const activePhase =
          ts.phase ||
          (ts.stage === 'GROUP_B' ? 'GROUP_B' : ts.stage === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP_A')
        const groupAIds = ts.groupAPlayerIds || ts.groupA?.playerIds || []
        const groupBIds = ts.groupBPlayerIds || ts.groupB?.playerIds || []

        if (activePhase === 'GROUP_A') {
          if (!groupAIds.includes(playerId)) {
            return NextResponse.json(
              { error: 'Buzzer saat ini hanya untuk anggota Grup A!' },
              { status: 403 }
            )
          }
        } else if (activePhase === 'GROUP_B') {
          if (!groupBIds.includes(playerId)) {
            return NextResponse.json(
              { error: 'Buzzer saat ini hanya untuk anggota Grup B!' },
              { status: 403 }
            )
          }
        } else if (activePhase === 'KNOCKOUT') {
          const activeMatch = ts.matches?.find((m) => m.id === ts.activeMatchId)
          if (activeMatch && activeMatch.player1Id !== playerId && activeMatch.player2Id !== playerId) {
            return NextResponse.json(
              { error: 'Buzzer hanya untuk 2 pemain yang sedang bertanding di duel BO3 ini!' },
              { status: 403 }
            )
          }
        }
      }
    }

    // ── STRICT EXCLUSION CHECK ───────────────────────────────────────
    // If player answered wrong on this song, they are NOT permitted to buzz again!
    if (player.excluded_attempt !== null) {
      return NextResponse.json(
        { error: 'Anda sudah menjawab salah untuk lagu ini.' },
        { status: 403 }
      )
    }

    // If game is already locked or not READY, return the existing winner immediately
    if (game.buzz_state !== 'READY' || game.buzz_winner_id !== null) {
      let currentWinnerName = 'Pemain Lain'
      const existingWinnerId = game.buzz_winner_id

      if (existingWinnerId) {
        if (existingWinnerId === playerId) {
          return NextResponse.json({
            winner: true,
            winnerId: playerId,
            winnerName: player.name,
          })
        }
        const { data: wp } = await supabase
          .from('players')
          .select('name')
          .eq('id', existingWinnerId)
          .single()
        if (wp?.name) currentWinnerName = wp.name
      }

      return NextResponse.json({
        winner: false,
        winnerId: existingWinnerId,
        winnerName: currentWinnerName,
      })
    }

    // ── ATOMIC FAST CLAIM IN POSTGRESQL (ZERO ARTIFICIAL DELAYS) ─────
    const { data: claimedGame } = await supabase
      .from('games')
      .update({
        buzz_winner_id: playerId,
        buzz_state: 'LOCKED',
      })
      .eq('id', game.id)
      .eq('buzz_state', 'READY')
      .is('buzz_winner_id', null)
      .select('id, buzz_winner_id')
      .maybeSingle()

    if (claimedGame?.buzz_winner_id === playerId) {
      return NextResponse.json({
        winner: true,
        winnerId: playerId,
        winnerName: player.name,
      })
    }

    // If another contestant claimed it first in the database, fetch winner details
    const { data: freshGame } = await supabase
      .from('games')
      .select('buzz_winner_id')
      .eq('id', game.id)
      .single()

    const winnerId = freshGame?.buzz_winner_id || game.buzz_winner_id
    let winnerName = 'Pemain Lain'

    if (winnerId) {
      if (winnerId === playerId) {
        return NextResponse.json({
          winner: true,
          winnerId: playerId,
          winnerName: player.name,
        })
      }
      const { data: wp } = await supabase
        .from('players')
        .select('name')
        .eq('id', winnerId)
        .single()
      if (wp?.name) winnerName = wp.name
    }

    return NextResponse.json({
      winner: false,
      winnerId: winnerId || null,
      winnerName,
    })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
