import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * PATCH /api/admin/[roomCode]
 * Host control actions.
 * Headers: x-host-password: <password>
 * Body: { action: string, payload?: object }
 *
 * Actions:
 *   SET_BUZZ_STATE  — payload: { buzzState: BuzzState }
 *   SET_GAME_STATUS — payload: { status: GameStatus }
 *   SET_CURRENT_SONG — payload: { songId: string }
 *   SET_ROUND       — payload: { round: RoundType }
 *   NEXT_SONG       — reset attempt, clear winner, set buzz DISABLED
 *   RESET_ALL_EXCLUSIONS — clear excluded_attempt for all players in game
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
