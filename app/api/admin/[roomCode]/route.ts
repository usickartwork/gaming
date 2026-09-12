import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  initTournamentState,
  shuffleTournamentGroups,
  startGroupStage,
  finalizeGroupStage,
  generateKnockoutFromGroups,
  advanceMatchWinner,
  getTournamentState,
  encodeGameStateName,
} from '@/lib/tournament-utils'
import type { TournamentState } from '@/lib/types'

async function saveGameTournament(
  supabase: ReturnType<typeof getSupabaseServerClient>,
  gameId: string,
  currentName: string,
  state: TournamentState | null,
  mode: 'CLASSIC' | 'KNOCKOUT'
) {
  const encodedName = encodeGameStateName(currentName, state)
  // Always update name (guaranteed column, triggers realtime postgres_changes)
  await supabase
    .from('games')
    .update({ name: encodedName })
    .eq('id', gameId)

  // Try updating direct columns if migration 004 has been executed
  try {
    await supabase
      .from('games')
      .update({ game_mode: mode, tournament_state: state })
      .eq('id', gameId)
  } catch {
    // Gracefully ignore if columns not in DB schema yet
  }
}

/**
 * PATCH /api/admin/[roomCode]
 * Host control actions.
 * Headers: x-host-password: <password>
 * Body: { action: string, payload?: object }
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const hostPassword = req.headers.get('x-host-password')
    const { action, payload } = await req.json()

    if (!hostPassword) {
      return NextResponse.json({ error: 'Host password required' }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()

    // Get game + verify host
    const { data: game } = await supabase
      .from('games')
      .select('id, name, host_secret')
      .eq('room_code', roomCode.toUpperCase())
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(hostPassword, game.host_secret)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid host password' }, { status: 403 })
    }

    switch (action) {
      case 'SET_BUZZ_STATE': {
        await supabase
          .from('games')
          .update({ buzz_state: payload.buzzState, buzz_winner_id: null })
          .eq('id', game.id)
        break
      }

      case 'SET_GAME_STATUS': {
        await supabase
          .from('games')
          .update({ status: payload.status })
          .eq('id', game.id)
        break
      }

      case 'SET_CURRENT_SONG': {
        await supabase
          .from('games')
          .update({
            current_song_id: payload.songId,
            buzz_state: 'DISABLED',
            buzz_winner_id: null,
            current_attempt: 1,
          })
          .eq('id', game.id)
        // Reset all player exclusions for new song
        await supabase
          .from('players')
          .update({ excluded_attempt: null })
          .eq('game_id', game.id)
        break
      }

      case 'SET_ROUND': {
        await supabase
          .from('games')
          .update({
            current_round: payload.round,
            current_song_id: null,
            buzz_state: 'DISABLED',
            buzz_winner_id: null,
            current_attempt: 1,
          })
          .eq('id', game.id)
        break
      }

      case 'NEXT_SONG': {
        await supabase
          .from('games')
          .update({
            current_song_id: null,
            buzz_state: 'DISABLED',
            buzz_winner_id: null,
            current_attempt: 1,
          })
          .eq('id', game.id)
        await supabase
          .from('players')
          .update({ excluded_attempt: null })
          .eq('game_id', game.id)
        break
      }

      case 'RESET_ALL_EXCLUSIONS': {
        await supabase
          .from('players')
          .update({ excluded_attempt: null })
          .eq('game_id', game.id)
        break
      }

      case 'UPDATE_PLAYER_SCORE': {
        if (!payload?.playerId || typeof payload?.score !== 'number') {
          return NextResponse.json({ error: 'playerId and numeric score required' }, { status: 400 })
        }
        await supabase
          .from('players')
          .update({ score: Math.max(0, payload.score) })
          .eq('id', payload.playerId)
          .eq('game_id', game.id)
        break
      }

      case 'RESET_ALL_SCORES': {
        await supabase
          .from('players')
          .update({ score: 0, excluded_attempt: null })
          .eq('game_id', game.id)
        break
      }

      case 'SET_GAME_MODE': {
        const targetMode = payload?.mode === 'KNOCKOUT' ? 'KNOCKOUT' : 'CLASSIC'
        let currentTS = getTournamentState(game)
        if (targetMode === 'KNOCKOUT' && (!currentTS || currentTS.groupA.playerIds.length === 0)) {
          const { data: currentPlayers } = await supabase
            .from('players')
            .select('*')
            .eq('game_id', game.id)
          currentTS = initTournamentState(currentPlayers || [], 2)
        } else if (currentTS) {
          currentTS = { ...currentTS, mode: targetMode }
        }
        await saveGameTournament(supabase, game.id, game.name, currentTS, targetMode)
        break
      }

      case 'SHUFFLE_GROUPS': {
        const { data: currentPlayers } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id)
        const targetPts = typeof payload?.targetPoints === 'number' ? payload.targetPoints : 2
        const freshState = shuffleTournamentGroups(null, currentPlayers || [], targetPts)
        await saveGameTournament(supabase, game.id, game.name, freshState, 'KNOCKOUT')
        break
      }

      case 'START_GROUP_A': {
        let currentTS = getTournamentState(game)
        if (currentTS) {
          currentTS = startGroupStage(currentTS, 'groupA')
          await saveGameTournament(supabase, game.id, game.name, currentTS, 'KNOCKOUT')
        }
        break
      }

      case 'FINISH_GROUP_A': {
        let currentTS = getTournamentState(game)
        if (currentTS) {
          currentTS = finalizeGroupStage(currentTS, 'groupA')
          await saveGameTournament(supabase, game.id, game.name, currentTS, 'KNOCKOUT')
        }
        break
      }

      case 'START_GROUP_B': {
        let currentTS = getTournamentState(game)
        if (currentTS) {
          currentTS = startGroupStage(currentTS, 'groupB')
          await saveGameTournament(supabase, game.id, game.name, currentTS, 'KNOCKOUT')
        }
        break
      }

      case 'FINISH_GROUP_B': {
        let currentTS = getTournamentState(game)
        if (currentTS) {
          currentTS = finalizeGroupStage(currentTS, 'groupB')
          await saveGameTournament(supabase, game.id, game.name, currentTS, 'KNOCKOUT')
        }
        break
      }

      case 'START_KNOCKOUT': {
        let currentTS = getTournamentState(game)
        if (currentTS) {
          currentTS = generateKnockoutFromGroups(currentTS)
          await saveGameTournament(supabase, game.id, game.name, currentTS, 'KNOCKOUT')
        }
        break
      }

      case 'GENERATE_BRACKET': {
        const { data: currentPlayers } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id)
        const targetPts = typeof payload?.targetPoints === 'number' ? payload.targetPoints : 2
        const newBracket = shuffleTournamentGroups(null, currentPlayers || [], targetPts)
        await saveGameTournament(supabase, game.id, game.name, newBracket, 'KNOCKOUT')
        break
      }

      case 'SET_ACTIVE_MATCH': {
        let currentTS = getTournamentState(game)
        if (currentTS && payload?.matchId) {
          currentTS = {
            ...currentTS,
            matches: currentTS.matches.map((m) => ({
              ...m,
              status: m.id === payload.matchId ? 'ACTIVE' : (m.status === 'ACTIVE' ? 'UPCOMING' : m.status),
            })),
            activeMatchId: payload.matchId,
          }
          await saveGameTournament(supabase, game.id, game.name, currentTS, 'KNOCKOUT')
        }
        break
      }

      case 'ADVANCE_MATCH_WINNER': {
        const currentTS = getTournamentState(game)
        if (currentTS && payload?.matchId && payload?.winnerId) {
          const updatedTS = advanceMatchWinner(currentTS, payload.matchId, payload.winnerId)
          await saveGameTournament(supabase, game.id, game.name, updatedTS, 'KNOCKOUT')
        }
        break
      }

      case 'RESET_TOURNAMENT': {
        const { data: currentPlayers } = await supabase
          .from('players')
          .select('*')
          .eq('game_id', game.id)
        const freshState = shuffleTournamentGroups(null, currentPlayers || [], 2)
        await saveGameTournament(supabase, game.id, game.name, freshState, 'KNOCKOUT')
        break
      }

      default:
        return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('PATCH /api/admin/[roomCode] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/[roomCode]
 * Deletes the game room and all cascading data from Supabase.
 * Headers: x-host-password: <password>
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const hostPassword = req.headers.get('x-host-password')

    if (!hostPassword) {
      return NextResponse.json({ error: 'Host password required' }, { status: 401 })
    }

    const supabase = getSupabaseServerClient()

    // Get game + verify host
    const { data: game } = await supabase
      .from('games')
      .select('id, host_secret')
      .eq('room_code', roomCode.toUpperCase())
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(hostPassword, game.host_secret)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid host password' }, { status: 403 })
    }

    // Step 1: Notify players by setting status to FINAL_RESULT
    await supabase
      .from('games')
      .update({ status: 'FINAL_RESULT', buzz_state: 'DISABLED' })
      .eq('id', game.id)

    // Step 2: Delete game row (CASCADE will remove players, attempts, score_configs)
    const { error: delErr } = await supabase
      .from('games')
      .delete()
      .eq('id', game.id)

    if (delErr) {
      console.error('Error deleting game:', delErr)
      return NextResponse.json({ error: 'Failed to delete game' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, message: 'Game room deleted' })
  } catch (err) {
    console.error('DELETE /api/admin/[roomCode] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
