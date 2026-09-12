import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams
  const code = searchParams.get('code')
  const error = searchParams.get('error')
  const stateStr = searchParams.get('state')

  let roomCode = ''
  let origin = req.nextUrl.origin

  if (stateStr) {
    try {
      const parsed = JSON.parse(stateStr)
      if (parsed.roomCode) roomCode = parsed.roomCode
      if (parsed.origin) origin = parsed.origin
    } catch {
      // ignore
    }
  }

  const redirectTarget = roomCode ? `${origin}/host/${roomCode}?spotify=connected` : `${origin}/?spotify=connected`

  if (error || !code) {
    console.error('Spotify auth error:', error)
    return NextResponse.redirect(`${redirectTarget}&error=${encodeURIComponent(error || 'cancelled')}`)
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${redirectTarget}&error=missing_credentials`)
  }

  const redirectUri = `${origin}/api/auth/spotify/callback`

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }),
    })

    const data = await tokenRes.json()

    if (!tokenRes.ok || !data.access_token) {
      console.error('Spotify token exchange failed:', data)
      return NextResponse.redirect(`${redirectTarget}&error=token_failed`)
    }

    const res = NextResponse.redirect(redirectTarget)

    // Set secure cookies for access_token and refresh_token
    res.cookies.set('spotify_access_token', data.access_token, {
      path: '/',
      httpOnly: false, // accessible to client for Web Playback SDK
      maxAge: data.expires_in || 3600,
      sameSite: 'lax',
    })

    if (data.refresh_token) {
      res.cookies.set('spotify_refresh_token', data.refresh_token, {
        path: '/',
        httpOnly: true,
        maxAge: 30 * 24 * 3600, // 30 days
        sameSite: 'lax',
      })
    }

    return res
  } catch (err) {
    console.error('Spotify callback exception:', err)
    return NextResponse.redirect(`${redirectTarget}&error=server_error`)
  }
}
