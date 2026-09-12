import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_CLIENT_ID = '452cdcb1d72d48d994f0f8a8156266a5'

export async function GET(req: NextRequest) {
  const clientId = process.env.SPOTIFY_CLIENT_ID || DEFAULT_CLIENT_ID
  if (!clientId) {
    return NextResponse.json({ error: 'SPOTIFY_CLIENT_ID not configured' }, { status: 500 })
  }

  const searchParams = req.nextUrl.searchParams
  const roomCode = searchParams.get('roomCode') || ''

  // Determine dynamic redirect URI matching request origin
  const origin = req.nextUrl.origin
  const redirectUri = `${origin}/api/auth/spotify/callback`

  const scopes = [
    'streaming',
    'user-read-email',
    'user-read-private',
    'user-modify-playback-state',
    'user-read-playback-state',
  ].join(' ')

  const state = JSON.stringify({ roomCode, origin })

  const authUrl = new URL('https://accounts.spotify.com/authorize')
  authUrl.searchParams.set('response_type', 'code')
  authUrl.searchParams.set('client_id', clientId)
  authUrl.searchParams.set('scope', scopes)
  authUrl.searchParams.set('redirect_uri', redirectUri)
  authUrl.searchParams.set('state', state)

  return NextResponse.redirect(authUrl.toString())
}
