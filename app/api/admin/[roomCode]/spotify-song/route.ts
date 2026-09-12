import { NextRequest, NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/admin/[roomCode]/spotify-song
 * Host adds a track from Spotify to playlist or selects it to play.
 * If setActive: true, sets as current_song_id in game.
 * If setActive: false, only adds to playlist so host can prepare multiple songs.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const hostPassword = req.headers.get('x-host-password')
    const { title, artist, spotifyUri, roundType = 'GUESS', setActive = false } = await req.json()

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
      .select('id, active')
      .eq('audio_url', spotifyUri)
      .maybeSingle()

    if (existingSong) {
      songId = existingSong.id
      if (!existingSong.active) {
        await supabase.from('songs').update({ active: true }).eq('id', songId)
      }
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

    // If host wants to activate and play immediately:
    if (setActive) {
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
    }

    return NextResponse.json({ ok: true, songId })
  } catch (err) {
    console.error('POST /api/admin/[roomCode]/spotify-song error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

/**
 * DELETE /api/admin/[roomCode]/spotify-song
 * Removes a song from the room's playlist.
 */
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ roomCode: string }> }
) {
  try {
    const { roomCode } = await params
    const hostPassword = req.headers.get('x-host-password')
    const { songId } = await req.json()

    if (!hostPassword || !songId) {
      return NextResponse.json({ error: 'Host password and songId required' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Verify host
    const { data: game } = await supabase
      .from('games')
      .select('id, host_secret, current_song_id')
      .eq('room_code', roomCode.toUpperCase())
      .single()

    if (!game) {
      return NextResponse.json({ error: 'Game not found' }, { status: 404 })
    }

    const valid = await bcrypt.compare(hostPassword, game.host_secret)
    if (!valid) {
      return NextResponse.json({ error: 'Invalid host password' }, { status: 403 })
    }

    // Soft-delete song
    await supabase.from('songs').update({ active: false }).eq('id', songId)

    // If current active song was deleted, reset game current_song_id
    if (game.current_song_id === songId) {
      await supabase
        .from('games')
        .update({
          current_song_id: null,
          buzz_state: 'DISABLED',
          buzz_winner_id: null,
          current_attempt: 1,
        })
        .eq('id', game.id)
    }

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('DELETE /api/admin/[roomCode]/spotify-song error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
