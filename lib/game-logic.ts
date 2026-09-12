import { ScoreConfig, DEFAULT_SCORE_CONFIG, AttemptResult } from './types'

/**
 * Calculate points for an attempt result.
 */
export function getPoints(
  attemptNumber: number,
  result: AttemptResult,
  config: ScoreConfig[] = DEFAULT_SCORE_CONFIG
): number {
  const cfg = config.find((c) => c.attempt_number === attemptNumber)
  if (!cfg) {
    const sorted = [...config].sort((a, b) => a.attempt_number - b.attempt_number)
    const last = sorted[sorted.length - 1]
    if (last) {
      return result === 'CORRECT' ? last.correct_points : last.wrong_points
    }
    return 0
  }
  return result === 'CORRECT' ? cfg.correct_points : cfg.wrong_points
}

/**
 * Generate a random room code — 5 uppercase alphanumeric chars.
 * Excludes ambiguous chars (0/O, 1/I/L) for readability.
 */
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () =>
    chars[Math.floor(Math.random() * chars.length)]
  ).join('')
}

/**
 * Validate a host password header from API request.
 */
export function extractHostPassword(request: Request): string | null {
  return request.headers.get('x-host-password')
}
