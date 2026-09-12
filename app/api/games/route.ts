import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { generateRoomCode } from '@/lib/game-logic'
import { DEFAULT_SCORE_CONFIG } from '@/lib/types'

/**
 * POST /api/games
 * Create a new game room.
 * Body: { name: string, hostPassword: string }
 * Returns: { roomCode, gameId }
 */
export async function POST(req: NextRequest) {
  try {
    const { name, hostPassword } = await req.json()

    if (!name?.trim() || !hostPassword?.trim()) {
      return NextResponse.json({ error: 'Name and password required' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()
    const hashedSecret = await bcrypt.hash(hostPassword, 10)

    // Generate unique room code (retry on collision)
    let roomCode = ''
    let game = null
    let attempts = 0

    while (!game && attempts < 5) {
      roomCode = generateRoomCode()
      const { data, error } = await supabase
        .from('games')
        .insert({
          room_code: roomCode,
          name: name.trim(),
          host_secret: hashedSecret,
          status: 'LOBBY',
          buzz_state: 'DISABLED',
          current_round: 'GUESS',
          current_attempt: 1,
        })
        .select()
        .single()

      if (!error) {
        game = data
      } else if (error.code !== '23505') {
        // Not a uniqueness violation — real error
        throw error
      }
      attempts++
    }

    if (!game) {
      return NextResponse.json({ error: 'Failed to generate unique room code' }, { status: 500 })
    }

    // Insert default score config (3 attempts)
    await supabase.from('score_configs').insert(
      DEFAULT_SCORE_CONFIG.map((cfg) => ({
        game_id: game.id,
        attempt_number: cfg.attempt_number,
        correct_points: cfg.correct_points,
        wrong_points: cfg.wrong_points,
      }))
    )

    return NextResponse.json({ roomCode: game.room_code, gameId: game.id })
  } catch (err) {
    console.error('POST /api/games error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
