import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState } from '@/lib/tournament-utils'

interface BuzzCandidate {
  playerId: string
  playerName: string
  pressedAt: number
  resolve: (res: { winner: boolean; winnerId: string; winnerName: string }) => void
}

interface BuzzWindow {
  gameId: string
  candidates: BuzzCandidate[]
  timer: NodeJS.Timeout
}

// In-memory fair resolution windows (120ms) to eliminate network latency advantage
const activeBuzzWindows = new Map<string, BuzzWindow>()

/**
 * POST /api/admin/[roomCode]/buzz
 * Player attempts to buzz in.
 * Headers: x-session-token: <token>
 * Body: { playerId: string, pressedAt?: number }
 * Returns: { winner: boolean, winnerId, winnerName }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const sessionToken = req.headers.get('x-session-token')
    const body = await req.json()
    const { playerId, pressedAt } = body

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

    // Check if player is excluded from this attempt
    if (player.excluded_attempt === game.current_attempt) {
      return NextResponse.json(
        { error: 'You cannot buzz on this attempt (answered wrong previously)' },
        { status: 403 }
      )
    }

    // Sanitize pressedAt to avoid spoofing while preserving high precision
    const now = Date.now()
    const validPressedAt =
      typeof pressedAt === 'number' && pressedAt <= now + 150 && pressedAt >= now - 4000
        ? pressedAt
        : now

    // If game is not in READY state, buzzer is already taken or disabled
    if (game.buzz_state !== 'READY') {
      let winnerName: string | null = null
      if (game.buzz_winner_id) {
        const { data: winnerPlayer } = await supabase
          .from('players')
          .select('name')
          .eq('id', game.buzz_winner_id)
          .single()
        winnerName = winnerPlayer?.name || null
      }

      return NextResponse.json({
        winner: false,
        winnerId: game.buzz_winner_id,
        winnerName: winnerName || 'Pemain Lain',
      })
    }

    // ── Fair Arbitration Window (120ms buffer) ──────────────────────────
    // If another buzz arrived within the last 120ms, join the current window
    if (activeBuzzWindows.has(game.id)) {
      const currentWin = activeBuzzWindows.get(game.id)!
      const outcome = await new Promise<{ winner: boolean; winnerId: string; winnerName: string }>(
        (resolve) => {
          currentWin.candidates.push({
            playerId,
            playerName: player.name,
            pressedAt: validPressedAt,
            resolve,
          })
        }
      )
      return NextResponse.json(outcome)
    }

    // Otherwise, start a fresh 120ms arbitration window for this game
    const outcome = await new Promise<{ winner: boolean; winnerId: string; winnerName: string }>(
      (resolve) => {
        const candidates: BuzzCandidate[] = [
          {
            playerId,
            playerName: player.name,
            pressedAt: validPressedAt,
            resolve,
          },
        ]

        const timer = setTimeout(async () => {
          activeBuzzWindows.delete(game.id)

          // Sort candidates by verified pressed timestamp (earliest reaction wins)
          candidates.sort((a, b) => a.pressedAt - b.pressedAt)
          const fastestCandidate = candidates[0]

          // Atomic claim in postgres
          const { data: dbWinnerId } = await supabase.rpc('atomic_buzz', {
            p_game_id: game.id,
            p_player_id: fastestCandidate.playerId,
          })

          const finalWinnerId = dbWinnerId || fastestCandidate.playerId
          let finalWinnerName = fastestCandidate.playerName

          if (dbWinnerId && dbWinnerId !== fastestCandidate.playerId) {
            const matched = candidates.find((c) => c.playerId === dbWinnerId)
            if (matched) {
              finalWinnerName = matched.playerName
            } else {
              const { data: wp } = await supabase
                .from('players')
                .select('name')
                .eq('id', dbWinnerId)
                .single()
              finalWinnerName = wp?.name || 'Pemain Lain'
            }
          }

          // Resolve all candidates in this window
          candidates.forEach((c) => {
            const isWinner = c.playerId === finalWinnerId
            c.resolve({
              winner: isWinner,
              winnerId: finalWinnerId,
              winnerName: finalWinnerName,
            })
          })
        }, 120)

        activeBuzzWindows.set(game.id, { gameId: game.id, candidates, timer })
      }
    )

    return NextResponse.json(outcome)
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
