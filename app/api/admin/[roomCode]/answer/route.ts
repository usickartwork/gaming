import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getPoints } from '@/lib/game-logic'
import {
  recordDuelPoint,
  getGameMode,
  getTournamentState,
  encodeGameStateName,
  saveGameTournament,
} from '@/lib/tournament-utils'
import type { TournamentState } from '@/lib/types'

/**
 * POST /api/admin/[roomCode]/answer
 * Host evaluates an answer as CORRECT or WRONG.
 * Headers: x-host-password: <password>
 * Body: { result: 'CORRECT' | 'WRONG' }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const hostPassword = req.headers.get('x-host-password')
    const { result } = await req.json()

    if (!hostPassword) {
      return NextResponse.json({ error: 'Host password required' }, { status: 401 })
    }

    if (result !== 'CORRECT' && result !== 'WRONG') {
      return NextResponse.json({ error: 'Invalid result' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Get game with host secret
    const { data: game } = await supabase
      .from('games')
      .select('id, name, host_secret, buzz_winner_id, current_attempt, current_song_id')
      .eq('room_code', roomCode.toUpperCase())
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    // Verify host password
    const valid = await bcrypt.compare(hostPassword, game.host_secret)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid host password' }, { status: 403 })
    }

    if (!game.buzz_winner_id) {
      return NextResponse.json({ error: 'No player has buzzed' }, { status: 400 })
    }

    // Get score config for this attempt
    const { data: scoreConfigs } = await supabase
      .from('score_configs')
      .select('attempt_number, correct_points, wrong_points')
      .eq('game_id', game.id)

    const points = getPoints(
      game.current_attempt,
      result,
      scoreConfigs ?? undefined
    )

    // Update player score
    const { data: player } = await supabase
      .from('players')
      .select('score')
      .eq('id', game.buzz_winner_id)
      .single()

    const newScore = Math.max(0, (player?.score ?? 0) + points)

    await supabase
      .from('players')
      .update({
        score: newScore,
        // If WRONG, exclude this player from the current attempt's next buzz
        excluded_attempt: result === 'WRONG' ? game.current_attempt : null,
      })
      .eq('id', game.buzz_winner_id)

    // Log attempt
    await supabase.from('attempts').insert({
      game_id: game.id,
      song_id: game.current_song_id,
      attempt_number: game.current_attempt,
      player_id: game.buzz_winner_id,
      result,
      points,
    })

    if (result === 'CORRECT') {
      // Check if tournament mode score or duel should be updated
      const mode = getGameMode(game)
      let duelResult: { matchWon: boolean; winnerId: string | null } = { matchWon: false, winnerId: null }
      let ts = getTournamentState(game) || ({
        mode: 'CLASSIC',
        phase: 'GROUP_A',
        groupAPlayerIds: [],
        groupBPlayerIds: [],
        matches: [],
        activeMatchId: null,
        targetPoints: 2,
        championId: null,
      } as TournamentState)

      if (mode === 'KNOCKOUT') {
        const activePhase = ts.phase || ts.stage
        if (activePhase === 'KNOCKOUT' && ts.activeMatchId) {
          const duelRes = recordDuelPoint(
            ts,
            ts.activeMatchId,
            game.buzz_winner_id
          )
          ts = duelRes.updatedState
          duelResult = { matchWon: duelRes.matchWon, winnerId: duelRes.winnerId }
        }
      }

      // Mark that this song was answered correctly
      ts.lastSongOutcome = 'CORRECT'
      await saveGameTournament(supabase, game.id, game.name, ts, mode)

      // Song done — move to RESULT state, reset attempt counter
      await supabase
        .from('games')
        .update({
          buzz_state: 'RESULT',
          buzz_winner_id: null,
          current_attempt: 1,
        })
        .eq('id', game.id)

      return NextResponse.json({ ok: true, points, ...duelResult })
    } else {
      // Wrong answer
      // In KNOCKOUT BO3 duel: if player 1 answers wrong on attempt 1, immediately give turn to player 2!
      const mode = getGameMode(game)
      const ts = mode === 'KNOCKOUT' ? getTournamentState(game) : null
      const activePhase = ts?.phase || ts?.stage

      if (mode === 'KNOCKOUT' && activePhase === 'KNOCKOUT' && ts?.activeMatchId) {
        const activeMatch = ts.matches.find((m) => m.id === ts.activeMatchId)
        if (activeMatch && activeMatch.player1Id && activeMatch.player2Id) {
          const wrongPlayerId = game.buzz_winner_id
          const otherPlayerId =
            wrongPlayerId === activeMatch.player1Id
              ? activeMatch.player2Id
              : wrongPlayerId === activeMatch.player2Id
              ? activeMatch.player1Id
              : null

          // If this is attempt 1, immediately grant the answering turn to the opponent!
          if (otherPlayerId && game.current_attempt === 1) {
            const nextAttempt = 2
            await supabase
              .from('games')
              .update({
                buzz_state: 'LOCKED',
                buzz_winner_id: otherPlayerId,
                current_attempt: nextAttempt,
              })
              .eq('id', game.id)

            return NextResponse.json({
              ok: true,
              points,
              duelTurnPassed: true,
              nextPlayerId: otherPlayerId,
            })
          }
        }
      }

      // ── NO-ONE-CAN-BUZZ DEADLOCK GUARD ──────────────────────────
      // If every player who is allowed to answer has already answered wrong on this
      // song, advancing to the next attempt would leave the buzzer open but nobody
      // able to press it. Auto-close the song (RESULT) so the host can advance.
      const { data: roomPlayers } = await supabase
        .from('players')
        .select('id, excluded_attempt')
        .eq('game_id', game.id)

      const eligibleIds = new Set(
        (roomPlayers || [])
          .filter((p) => p.excluded_attempt === null)
          .map((p) => p.id)
      )

      let canStillBuzz = eligibleIds.size > 0
      if (canStillBuzz && mode === 'KNOCKOUT') {
        if (activePhase === 'KNOCKOUT') {
          const activeMatch = ts?.matches.find((m) => m.id === ts?.activeMatchId)
          const duelIds = new Set(
            [activeMatch?.player1Id, activeMatch?.player2Id].filter(Boolean)
          )
          const eligibleDuelist = [...eligibleIds].some((id) => duelIds.has(id))
          canStillBuzz = duelIds.size > 0 && eligibleDuelist
        } else {
          const groupIds = new Set(
            activePhase === 'GROUP_B'
              ? ts?.groupBPlayerIds || []
              : ts?.groupAPlayerIds || []
          )
          const eligibleInGroup = [...eligibleIds].some((id) => groupIds.has(id))
          canStillBuzz = groupIds.size > 0 && eligibleInGroup
        }
      }

      if (!canStillBuzz) {
        const mode = getGameMode(game)
        const tsObj = getTournamentState(game) || ({
          mode: 'CLASSIC',
          phase: 'GROUP_A',
          groupAPlayerIds: [],
          groupBPlayerIds: [],
          matches: [],
          activeMatchId: null,
          targetPoints: 2,
          championId: null,
        } as TournamentState)

        tsObj.lastSongOutcome = 'ALL_WRONG'
        await saveGameTournament(supabase, game.id, game.name, tsObj, mode)

        await supabase
          .from('games')
          .update({
            buzz_state: 'RESULT',
            buzz_winner_id: null,
            current_attempt: 1,
          })
          .eq('id', game.id)
        await supabase
          .from('players')
          .update({ excluded_attempt: null })
          .eq('game_id', game.id)

        return NextResponse.json({ ok: true, points, songEnded: true, allWrong: true })
      }

      // Default wrong flow: next attempt, reset buzz to READY
      const nextAttempt = game.current_attempt + 1
      await supabase
        .from('games')
        .update({
          buzz_state: 'READY',
          buzz_winner_id: null,
          current_attempt: nextAttempt,
        })
        .eq('id', game.id)

      return NextResponse.json({ ok: true, points })
    }
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/answer error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
