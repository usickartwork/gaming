import { NextResponse } from 'next/server'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'

/**
 * GET /api/games/ping
 * Ultra-low latency Edge route (<5ms).
 * Returns server time for high-precision client-server clock synchronization.
 */
export async function GET() {
  return NextResponse.json(
    { serverTime: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
        Pragma: 'no-cache',
      },
    }
  )
}
