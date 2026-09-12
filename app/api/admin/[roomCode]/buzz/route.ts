import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState } from '@/lib/tournament-utils'

/**
 * POST /api/admin/[roomCode]/buzz
 * Player attempts to buzz in.
 * Headers: x-session-token: <token>
 * Body: { playerId: string, pressedAt?: number }
 * Returns: { winner: boolean, winnerId: string | null, winnerName: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const sessionToken = req.headers.get('x-session-token')
    const body = await req.json()
    const { playerId } = body

    if (!sessionToken || !playerId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Parallel verification queries
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
        .eq('room_code', roomCode.toUpperCase())
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

    // Check if player is excluded from this song (answered wrong previously)
    if (player.excluded_attempt !== null) {
      return NextResponse.json(
        { error: 'Anda sudah menjawab salah untuk lagu ini.' },
        { status: 403 }
      )
    }

    // If game is already not READY or winner is already set, immediately return the current winner
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

    // ── ATOMIC BUZZ CLAIM IN POSTGRESQL ─────────────────────────────────
    // Using database row locking so that if multiple buzzes arrive concurrently,
    // EXACTLY ONE query can ever update the row.
    let won = false
    let finalWinnerId: string | null = null

    // 1. Try atomic_buzz RPC function first
    try {
      const { data: rpcWinner, error: rpcErr } = await supabase.rpc('atomic_buzz', {
        p_game_id: game.id,
        p_player_id: playerId,
      })

      if (!rpcErr && rpcWinner) {
        if (rpcWinner === playerId) {
          won = true
          finalWinnerId = playerId
        } else {
          won = false
          finalWinnerId = rpcWinner
        }
      }
    } catch {
      // RPC may not exist or errored, proceed to direct atomic update
    }

    // 2. Direct atomic update fallback (conditional on buzz_state === 'READY' AND buzz_winner_id IS NULL)
    if (!won && !finalWinnerId) {
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
        won = true
        finalWinnerId = playerId
      }
    }

    // 3. If this candidate did NOT win, fetch whoever actually claimed the row
    if (!won && !finalWinnerId) {
      const { data: freshGame } = await supabase
        .from('games')
        .select('buzz_winner_id')
        .eq('id', game.id)
        .single()

      finalWinnerId = freshGame?.buzz_winner_id || null
      // In the rare case that freshGame also has null (e.g. disabled concurrently by host), won remains false
    }

    // Resolve the winner's display name
    let finalWinnerName = player.name
    if (!won && finalWinnerId) {
      const { data: wp } = await supabase
        .from('players')
        .select('name')
        .eq('id', finalWinnerId)
        .single()
      finalWinnerName = wp?.name || 'Pemain Lain'
    }

    return NextResponse.json({
      winner: won,
      winnerId: finalWinnerId,
      winnerName: finalWinnerName,
    })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
