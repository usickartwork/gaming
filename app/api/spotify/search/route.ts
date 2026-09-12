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
      body: new URLSearchParams({
        grant_type: 'client_credentials',
      }),
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

  let token = req.cookies.get('spotify_access_token')?.value
  if (!token) {
    token = (await getClientCredentialsToken()) || undefined
  }

  if (!token) {
    return NextResponse.json({ error: 'Spotify API credentials not available' }, { status: 500 })
  }

  try {
    const spotifyRes = await fetch(
      `https://api.spotify.com/v1/search?type=track&limit=20&q=${encodeURIComponent(q.trim())}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      }
    )

    if (!spotifyRes.ok) {
      // If unauthorized, attempt client credentials once
      const fallbackToken = await getClientCredentialsToken()
      if (fallbackToken && fallbackToken !== token) {
        const retryRes = await fetch(
          `https://api.spotify.com/v1/search?type=track&limit=20&q=${encodeURIComponent(q.trim())}`,
          {
            headers: {
              Authorization: `Bearer ${fallbackToken}`,
            },
          }
        )
        if (retryRes.ok) {
          const retryData = await retryRes.json()
          return formatSpotifyTracks(retryData)
        }
      }
      return NextResponse.json({ error: 'Failed to search Spotify' }, { status: spotifyRes.status })
    }

    const data = await spotifyRes.json()
    return formatSpotifyTracks(data)
  } catch (err) {
    console.error('Spotify search error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
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
    uri: item.uri, // e.g. "spotify:track:4cOdK2wGLETKBW3PvgPWqT"
    previewUrl: item.preview_url || null,
  }))

  return NextResponse.json({ tracks })
}
