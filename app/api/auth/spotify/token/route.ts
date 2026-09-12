import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  let accessToken = req.cookies.get('spotify_access_token')?.value
  const refreshToken = req.cookies.get('spotify_refresh_token')?.value

  if (accessToken) {
    return NextResponse.json({ accessToken, connected: true })
  }

  if (!refreshToken) {
    return NextResponse.json({ accessToken: null, connected: false })
  }

  const clientId = process.env.SPOTIFY_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET

  if (!clientId || !clientSecret) {
    return NextResponse.json({ error: 'Missing Spotify credentials' }, { status: 500 })
  }

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
      }),
    })

    const data = await res.json()

    if (!res.ok || !data.access_token) {
      return NextResponse.json({ accessToken: null, connected: false })
    }

    accessToken = data.access_token
    const response = NextResponse.json({ accessToken, connected: true })

    response.cookies.set('spotify_access_token', accessToken!, {
      path: '/',
      httpOnly: false,
      maxAge: data.expires_in || 3600,
      sameSite: 'lax',
    })

    if (data.refresh_token) {
      response.cookies.set('spotify_refresh_token', data.refresh_token, {
        path: '/',
        httpOnly: true,
        maxAge: 30 * 24 * 3600,
        sameSite: 'lax',
      })
    }

    return response
  } catch (err) {
    console.error('Failed to refresh Spotify token:', err)
    return NextResponse.json({ accessToken: null, connected: false })
  }
}
