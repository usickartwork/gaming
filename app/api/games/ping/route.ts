import { NextResponse } from 'next/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/games/ping
 * Returns server time for high-precision client-server clock synchronization.
 * Helps equalize latency so players on higher-ping connections aren't unfairly penalized.
 */
export async function GET() {
  return NextResponse.json(
    { serverTime: Date.now() },
    {
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    }
  )
}
