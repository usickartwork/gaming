import { NextRequest, NextResponse } from 'next/server'

const DEFAULT_CLIENT_ID = '452cdcb1d72d48d994f0f8a8156266a5'
const DEFAULT_CLIENT_SECRET = '58b241c53ea34a9a92b2a78b5c1ebfc8'

async function getClientCredentialsToken(): Promise<string | null> {
  const clientId = process.env.SPOTIFY_CLIENT_ID || DEFAULT_CLIENT_ID
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || DEFAULT_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  try {
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      },
      body: 'grant_type=client_credentials',
    })
    const data = await res.json()
    return data.access_token || null
  } catch (err) {
    console.error('Error fetching client credentials token:', err)
    return null
  }
}

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get('q')
  if (!q || !q.trim()) {
    return NextResponse.json({ tracks: [] })
  }

  // Client credentials flow is optimal for searching public catalog
  let token = await getClientCredentialsToken()

  // Fallback to user access token cookie if client credentials token failed
  if (!token) {
    token = req.cookies.get('spotify_access_token')?.value || null
  }

  if (!token) {
    return NextResponse.json(
      { error: 'Kredensial Spotify API tidak tersedia. Periksa Client ID & Client Secret.' },
      { status: 500 }
    )
  }

  try {
    // Spotify Client Credentials flow permits a maximum limit of 10
    const spotifyRes = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=10&q=${encodeURIComponent(q.trim())}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!spotifyRes.ok) {
      const errData = await spotifyRes.json().catch(() => null)
      const message = errData?.error?.message || `Spotify API error (${spotifyRes.status})`
      console.error('Spotify search failed:', spotifyRes.status, errData)
      return NextResponse.json({ error: message }, { status: spotifyRes.status })
    }

    const data = await spotifyRes.json()
    return formatSpotifyTracks(data)
  } catch (err) {
    console.error('Spotify search error:', err)
    return NextResponse.json({ error: 'Internal server error saat mencari lagu' }, { status: 500 })
  }
}

function formatSpotifyTracks(data: any) {
  const items = data.tracks?.items || []
  const tracks = items.map((item: any) => ({
    id: item.id,
    title: item.name,
    artist: item.artists.map((a: any) => a.name).join(', '),
    album: item.album?.name,
    albumArt: item.album?.images?.[0]?.url || item.album?.images?.[1]?.url || null,
    durationMs: item.duration_ms,
    uri: item.uri, // e.g. "spotify:track:5gkTGkjFB5wAd3mSBEcQPY"
    previewUrl: item.preview_url || null,
  }))

  return NextResponse.json({ tracks })
}
