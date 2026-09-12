import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { PlaylistSection } from '@/lib/types'

export const dynamic = 'force-dynamic'

const MASTER_ROOM_CODE = '__ADMIN_PLAYLISTS__'

/**
 * GET /api/admin/master-playlists
 * Fetches the permanent master playlists saved across all game rooms for the admin.
 */
export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    const { data } = await supabase
      .from('games')
      .select('name')
      .eq('room_code', MASTER_ROOM_CODE)
      .maybeSingle()

    if (!data?.name || !data.name.includes('|||')) {
      return NextResponse.json({ playlists: [] })
    }

    try {
      const jsonStr = data.name.split('|||')[1]
      const parsed = JSON.parse(jsonStr)
      return NextResponse.json({ playlists: parsed?.playlists || [] })
    } catch {
      return NextResponse.json({ playlists: [] })
    }
  } catch (err) {
    console.error('GET /api/admin/master-playlists error:', err)
    return NextResponse.json({ playlists: [] })
  }
}

/**
 * POST /api/admin/master-playlists
 * Saves the master playlists permanently in Supabase so they persist across game rooms,
 * room recreations, and browser sessions.
 * Body: { playlists: PlaylistSection[] }
 */
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const playlists: PlaylistSection[] = Array.isArray(body?.playlists) ? body.playlists : []

    const supabase = getSupabaseServerClient()

    const statePayload = {
      playlists,
      updatedAt: Date.now(),
    }

    const { error } = await supabase.from('games').upsert(
      {
        room_code: MASTER_ROOM_CODE,
        name: `Admin Master Playlists|||${JSON.stringify(statePayload)}`,
        host_secret: 'ADMIN_MASTER_SECRET',
        status: 'LOBBY',
        buzz_state: 'DISABLED',
        current_round: 'GUESS',
        current_attempt: 1,
      },
      { onConflict: 'room_code' }
    )

    if (error) {
      console.error('Failed to upsert master playlists:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true, count: playlists.length })
  } catch (err) {
    console.error('POST /api/admin/master-playlists error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

