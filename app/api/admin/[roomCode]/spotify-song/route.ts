import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/[roomCode]/spotify-song
 * Host selects a track from Spotify search results.
 * Upserts into `songs` table and sets as current_song_id in game.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const hostPassword = req.headers.get('x-host-password')
    const { title, artist, spotifyUri, roundType = 'GUESS' } = await req.json()

    if (!hostPassword) {
      return NextResponse.json({ error: 'Host password required' }, { status: 401 })
    }

    if (!title || !artist || !spotifyUri) {
      return NextResponse.json({ error: 'Title, artist, and spotifyUri required' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Verify host
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

    // Check if song already exists with this spotifyUri
    let songId: string | null = null
    const { data: existingSong } = await supabase
      .from('songs')
      .select('id')
      .eq('audio_url', spotifyUri)
      .maybeSingle()

    if (existingSong) {
      songId = existingSong.id
    } else {
      // Insert new song
      const { data: newSong, error: insertErr } = await supabase
        .from('songs')
        .insert({
          title,
          artist,
          audio_url: spotifyUri,
          round_type: roundType,
          difficulty: 'MEDIUM',
          active: true,
        })
        .select('id')
        .single()

      if (insertErr || !newSong) {
        console.error('Failed to insert Spotify song:', insertErr)
        return NextResponse.json({ error: 'Failed to insert song' }, { status: 500 })
      }
      songId = newSong.id
    }

    // Set as current song in game and reset attempts & exclusions
    await Promise.all([
      supabase
        .from('games')
        .update({
          current_song_id: songId,
          buzz_state: 'DISABLED',
          buzz_winner_id: null,
          current_attempt: 1,
        })
        .eq('id', game.id),
      supabase
        .from('players')
        .update({ excluded_attempt: null })
        .eq('game_id', game.id),
    ])

    return NextResponse.json({ ok: true, songId })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/spotify-song error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
