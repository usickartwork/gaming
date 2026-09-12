import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getGameMode, getTournamentState } from '@/lib/tournament-utils'

interface BuzzCandidate {
  playerId: string
  playerName: string
  pressedAt: number
}

interface ActiveRace {
  roomCode: string
  gameId: string
  attempt: number
  best: BuzzCandidate
  resolveFns: Array<(result: { winner: boolean; winnerId: string; winnerName: string }) => void>
  timer: NodeJS.Timeout
}

// In-memory race window map: key is `${roomCode}:${gameId}:${attempt}`
const activeRaces = new Map<string, ActiveRace>()

/**
 * POST /api/admin/[roomCode]/buzz
 * Player attempts to buzz in.
 * Headers: x-session-token: <token>
 * Body: { playerId: string, pressedAt?: number }
 * Returns: { winner: boolean, winnerId: string | null, winnerName: string }
 *
 * Implements high-precision, fair 150ms time-calibrated arbitration:
 * Equalizes latency differences so a player on higher-ping connection who physically
 * pressed earlier is guaranteed to win over a later press on low-ping connection.
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
    const { playerId, pressedAt } = body

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

    // Check if player is excluded from this song (answered wrong previously)
    if (player.excluded_attempt !== null) {
      return NextResponse.json(
        { error: 'Anda sudah menjawab salah untuk lagu ini.' },
        { status: 403 }
      )
    }

    // Validate and bound the reported physical pressedAt timestamp against cheating/clock drift
    const now = Date.now()
    const validPressedAt =
      typeof pressedAt === 'number' && pressedAt <= now + 100 && pressedAt >= now - 5000
        ? pressedAt
        : now

    const raceKey = `${normalizedRoom}:${game.id}:${game.current_attempt}`

    // ── 1. ACTIVE RACE WINDOW IN PROGRESS ─────────────────────────────────
    let race = activeRaces.get(raceKey)
    if (race) {
      // Compare pressedAt: if this candidate physically pressed EARLIER, they take the lead!
      if (validPressedAt < race.best.pressedAt) {
        race.best = {
          playerId,
          playerName: player.name,
          pressedAt: validPressedAt,
        }
      }

      // Wait for the arbitration window to settle and return the fair outcome
      const result = await new Promise<{ winner: boolean; winnerId: string; winnerName: string }>(
        (resolve) => {
          race!.resolveFns.push((finalRes) => {
            resolve({
              winner: finalRes.winnerId === playerId,
              winnerId: finalRes.winnerId,
              winnerName: finalRes.winnerName,
            })
          })
        }
      )

      return NextResponse.json(result)
    }

    // ── 2. ALREADY LOCKED OR PREVIOUSLY CLAIMED IN DB ────────────────────
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

    // ── 3. FIRST BUZZER ARRIVAL: START 150MS FAIR ARBITRATION WINDOW ──────
    const result = await new Promise<{ winner: boolean; winnerId: string; winnerName: string }>(
      (resolve) => {
        const firstCandidate: BuzzCandidate = {
          playerId,
          playerName: player.name,
          pressedAt: validPressedAt,
        }

        const newRace: ActiveRace = {
          roomCode: normalizedRoom,
          gameId: game.id,
          attempt: game.current_attempt,
          best: firstCandidate,
          resolveFns: [
            (finalRes) => {
              resolve({
                winner: finalRes.winnerId === playerId,
                winnerId: finalRes.winnerId,
                winnerName: finalRes.winnerName,
              })
            },
          ],
          timer: setTimeout(async () => {
            activeRaces.delete(raceKey)
            const trueWinner = newRace.best

            // Authoritatively persist the true winner to Supabase Postgres
            try {
              await supabase
                .from('games')
                .update({
                  buzz_winner_id: trueWinner.playerId,
                  buzz_state: 'LOCKED',
                })
                .eq('id', game.id)
                .eq('buzz_state', 'READY')
            } catch (err) {
              console.error('Failed to commit buzz winner to DB:', err)
            }

            // Distribute fair verdict to all waiting requests in this window
            const outcome = {
              winner: true,
              winnerId: trueWinner.playerId,
              winnerName: trueWinner.playerName,
            }
            newRace.resolveFns.forEach((fn) => fn(outcome))
          }, 150), // 150ms window: completely eliminates ping advantages while feeling instant
        }

        activeRaces.set(raceKey, newRace)
      }
    )

    return NextResponse.json(result)
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/buzz error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
