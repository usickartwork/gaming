import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

/**
 * POST /api/games/presence
 * Update a player's connected status.
 * Body: { playerId, sessionToken, connected }
 */
export async function POST(req: NextRequest) {
  try {
    const { playerId, sessionToken, connected } = await req.json()

    if (!playerId || !sessionToken) {
      return NextResponse.json({ error: 'Missing credentials' }, { status: 400 })
    }

    const supabase = getSupabaseServerClient()

    // Verify session token matches player
    const { data: player } = await supabase
      .from('players')
      .select('id')
      .eq('id', playerId)
      .eq('session_token', sessionToken)
      .single()

    if (!player) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 })
    }

    await supabase
      .from('players')
      .update({ connected: Boolean(connected) })
      .eq('id', playerId)

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('POST /api/games/presence error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
