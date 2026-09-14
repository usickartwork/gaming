import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState } from '@/lib/tournament-utils'
import { arbitrateBuzz, Candidate } from '@/lib/buzzer-arbitrator'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/[roomCode]/buzz
 * Latency-neutral, 100% fair buzzer endpoint.
 * Arbitrates competing buzzes based on calibrated physical touch timestamps (pressedAt)
 * rather than arbitrary network packet arrival speed.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const normalizedRoom = roomCode.toUpperCase()
    const sessionToken = req.headers.get('x-session-token')
    const body = await req.json().catch(() => ({}))
    const { playerId, clientRtt } = body

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

    // Check if tournament knockout mode restricts buzzing
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
    // If player answered wrong on this song, they are NOT permitted to buzz again
    if (player.excluded_attempt !== null) {
      return NextResponse.json(
        { error: 'Anda sudah menjawab salah untuk lagu ini.' },
        { status: 403 }
      )
    }

    // If buzzer is already LOCKED or not READY, return the existing winner immediately
    if (game.buzz_state !== 'READY') {
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

    // ── SERVER-SIDE FAIR PRESS TIME CALCULATION ─────────────────────
    // Instead of trusting client-provided timestamps (prone to clock drift),
    // we compute: adjustedPressTime = serverReceiveTime - oneWayLatency
    // where oneWayLatency ≈ clientRtt / 2 (assumes symmetric network)
    //
    // RTT is a RELATIVE measurement — immune to client clock drift and
    // asymmetric network jitter that plagued the old Cristian's Algorithm approach.
    const receivedAt = Date.now()
    const rtt = typeof clientRtt === 'number' && clientRtt >= 10 && clientRtt <= 3000
      ? clientRtt
      : 200 // default 200ms if client didn't send RTT
    const adjustedPressTime = receivedAt - Math.round(rtt / 2)

    const candidate: Candidate = {
      playerId,
      playerName: player.name,
      pressedAt: adjustedPressTime,
      receivedAt,
    }

    // ── LATENCY-FAIR ARBITRATION ────────────────────────────────────
    // Arbitrates all competing buzzes arriving within a brief 220ms window.
    // The candidate with the earliest physical touch (pressedAt) wins!
    const result = await arbitrateBuzz(
      game.id,
      game.current_attempt || 1,
      candidate,
      async (winnerCandidate, allCandidates) => {
        // Check if database was already finalized by another process
        const { data: freshGame } = await supabase
          .from('games')
          .select('buzz_state, buzz_winner_id')
          .eq('id', game.id)
          .single()

        if (freshGame && freshGame.buzz_state === 'LOCKED' && freshGame.buzz_winner_id) {
          const match = allCandidates.find((c) => c.playerId === freshGame.buzz_winner_id)
          let finalWinnerName = match?.playerName || 'Pemain Lain'
          if (!match) {
            const { data: p } = await supabase
              .from('players')
              .select('name')
              .eq('id', freshGame.buzz_winner_id)
              .single()
            if (p?.name) finalWinnerName = p.name
          }
          return { winnerId: freshGame.buzz_winner_id, winnerName: finalWinnerName }
        }

        // Atomically lock the true physical winner into PostgreSQL
        await supabase
          .from('games')
          .update({
            buzz_winner_id: winnerCandidate.playerId,
            buzz_state: 'LOCKED',
          })
          .eq('id', game.id)
          .eq('buzz_state', 'READY')

        return {
          winnerId: winnerCandidate.playerId,
          winnerName: winnerCandidate.playerName,
        }
      }
    )

    const isWinner = result.winnerId === playerId

    return NextResponse.json({
      winner: isWinner,
      winnerId: result.winnerId,
      winnerName: result.winnerName,
    })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
