import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * GET /api/games/[roomCode]/song
 * Returns the currently playing song's title & artist to players.
 * Only reveals full song details when game.buzz_state === 'RESULT' to prevent spoilers.
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const supabase = getSupabaseServerClient()

    const { data: game, error: gErr } = await supabase
      .from('games')
      .select('id, buzz_state, current_song_id, current_round')
      .eq('room_code', roomCode.toUpperCase())
      .single()

    if (gErr || !game || !game.current_song_id) {
      return NextResponse.json({ revealed: false, song: null })
    }

    // Only reveal if game is in RESULT state
    if (game.buzz_state !== 'RESULT') {
      return NextResponse.json({ revealed: false, song: null })
    }

    const { data: song, error: sErr } = await supabase
      .from('songs')
      .select('title, artist, round_type')
      .eq('id', game.current_song_id)
      .single()

    if (sErr || !song) {
      return NextResponse.json({ revealed: false, song: null })
    }

    return NextResponse.json({
      revealed: true,
      song: {
        title: song.title,
        artist: song.artist,
        roundType: song.round_type || game.current_round,
      },
    })
  } catch (err) {
    console.error('GET /api/games/[roomCode]/song error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

