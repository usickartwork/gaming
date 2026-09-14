import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState, saveGameTournament } from '@/lib/tournament-utils'

export const dynamic = 'force-dynamic'

/**
 * POST /api/admin/[roomCode]/buzz
 *
 * Ultra-Fair Buzzer with Database Atomic Lock & Timestamp Arbitration:
 *
 * 1. Safe query using ONLY guaranteed core columns (no unmigrated columns).
 * 2. Atomic lock on PostgreSQL (`buzz_state = 'READY' -> 'LOCKED'`).
 * 3. 250ms Grace Window: If a player on a slower network physically touched first
 *    (calibrated pressedAt is earlier), the database atomically awards them the win.
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
    const { playerId, pressedAt: rawPressedAt } = body

    if (!sessionToken || !playerId) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Parallel session & game verification (ONLY guaranteed columns from 001_schema.sql)
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
      console.warn('[buzz] Invalid player session:', { playerId, playerErr })
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    if (gameErr || !game || game.id !== player.game_id) {
      console.warn('[buzz] Game not found:', { normalizedRoom, gameErr })
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // ── STRICT EXCLUSION CHECK ───────────────────────────────────────
    // If player answered wrong on this song, they are NOT permitted to buzz again
    if (player.excluded_attempt !== null) {
      return NextResponse.json(
        { error: 'Anda sudah menjawab salah untuk lagu ini.' },
        { status: 403 }
      )
    }

    // ── TOURNAMENT RESTRICTIONS ──────────────────────────────────────
    const mode = getGameMode(game)
    const ts = getTournamentState(game)
    if (mode === 'KNOCKOUT' && ts) {
      const activePhase =
        ts.phase ||
        (ts.stage === 'GROUP_B' ? 'GROUP_B' : ts.stage === 'KNOCKOUT' ? 'KNOCKOUT' : 'GROUP_A')
      const groupAIds = ts.groupAPlayerIds || ts.groupA?.playerIds || []
      const groupBIds = ts.groupBPlayerIds || ts.groupB?.playerIds || []

      if (activePhase === 'GROUP_A' && !groupAIds.includes(playerId)) {
        return NextResponse.json(
          { error: 'Buzzer saat ini hanya untuk anggota Grup A!' },
          { status: 403 }
        )
      }
      if (activePhase === 'GROUP_B' && !groupBIds.includes(playerId)) {
        return NextResponse.json(
          { error: 'Buzzer saat ini hanya untuk anggota Grup B!' },
          { status: 403 }
        )
      }
      if (activePhase === 'KNOCKOUT') {
        const activeMatch = ts.matches?.find((m) => m.id === ts.activeMatchId)
        if (activeMatch && activeMatch.player1Id !== playerId && activeMatch.player2Id !== playerId) {
          return NextResponse.json(
            { error: 'Buzzer hanya untuk 2 pemain yang sedang duel BO3!' },
            { status: 403 }
          )
        }
      }
    }

    // ── TIMESTAMP SANITIZATION ───────────────────────────────────────
    const now = Date.now()
    let pressedAt = typeof rawPressedAt === 'number' && !isNaN(rawPressedAt) ? rawPressedAt : now
    // Anti-spoofing clamp
    if (pressedAt > now + 150) pressedAt = now
    if (pressedAt < now - 4000) pressedAt = now - 4000

    const currentTs: any = ts ? { ...ts } : {}
    const winningPressedAt = currentTs.buzz_pressed_at ?? 0
    const lockedAt = currentTs.buzz_locked_at ?? 0
    const timeSinceLock = now - lockedAt

    // ── CASE 1: Buzzer is READY -> First Arrival Locks ──────────────
    if (game.buzz_state === 'READY') {
      const updatedTs = {
        ...currentTs,
        buzz_pressed_at: pressedAt,
        buzz_locked_at: now,
        buzz_winner_id: playerId,
        buzz_winner_name: player.name,
      }

      // Atomic DB lock: only succeeds if buzz_state is still READY
      const { data: lockedGame, error: lockErr } = await supabase
        .from('games')
        .update({
          buzz_state: 'LOCKED',
          buzz_winner_id: playerId,
        })
        .eq('id', game.id)
        .eq('buzz_state', 'READY')
        .select('buzz_winner_id')
        .maybeSingle()

      if (!lockErr && lockedGame?.buzz_winner_id === playerId) {
        // Save tournament state with lock metadata asynchronously
        saveGameTournament(supabase, game.id, game.name, updatedTs, mode, {
          buzz_state: 'LOCKED',
          buzz_winner_id: playerId,
        }).catch((e) => console.warn('saveGameTournament lock error:', e))

        return NextResponse.json({
          winner: true,
          winnerId: playerId,
          winnerName: player.name,
          pressedAt,
        })
      }
    }

    // ── CASE 2: Buzzer was LOCKED, but this player pressed EARLIER! ─
    if (
      game.buzz_state === 'LOCKED' &&
      game.buzz_winner_id &&
      game.buzz_winner_id !== playerId &&
      timeSinceLock < 250 &&
      winningPressedAt > 0 &&
      pressedAt < winningPressedAt
    ) {
      const previousWinnerId = game.buzz_winner_id
      const correctedTs = {
        ...currentTs,
        buzz_pressed_at: pressedAt,
        buzz_locked_at: lockedAt,
        buzz_winner_id: playerId,
        buzz_winner_name: player.name,
      }

      const { data: stolenGame, error: stealErr } = await supabase
        .from('games')
        .update({
          buzz_winner_id: playerId,
        })
        .eq('id', game.id)
        .eq('buzz_state', 'LOCKED')
        .eq('buzz_winner_id', previousWinnerId)
        .select('buzz_winner_id')
        .maybeSingle()

      if (!stealErr && stolenGame?.buzz_winner_id === playerId) {
        saveGameTournament(supabase, game.id, game.name, correctedTs, mode, {
          buzz_state: 'LOCKED',
          buzz_winner_id: playerId,
        }).catch((e) => console.warn('saveGameTournament steal error:', e))

        return NextResponse.json({
          winner: true,
          winnerId: playerId,
          winnerName: player.name,
          pressedAt,
          corrected: true,
        })
      }
    }

    // ── CASE 3: Not the winner ───────────────────────────────────────
    // Re-fetch confirmed winner
    const { data: freshGame } = await supabase
      .from('games')
      .select('buzz_winner_id')
      .eq('id', game.id)
      .single()

    const currentWinnerId = freshGame?.buzz_winner_id || game.buzz_winner_id
    if (currentWinnerId === playerId) {
      return NextResponse.json({
        winner: true,
        winnerId: playerId,
        winnerName: player.name,
      })
    }

    let currentWinnerName = currentTs?.buzz_winner_name || 'Pemain Lain'
    if (currentWinnerId && currentWinnerId !== playerId) {
      const { data: wp } = await supabase
        .from('players')
        .select('name')
        .eq('id', currentWinnerId)
        .single()
      if (wp?.name) currentWinnerName = wp.name
    }

    return NextResponse.json({
      winner: false,
      winnerId: currentWinnerId,
      winnerName: currentWinnerName,
    })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
