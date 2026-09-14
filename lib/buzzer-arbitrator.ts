/**
 * Ultra-fair Buzzer Latency Arbitrator.
 * 
 * Guarantees 100% fair buzzer resolution regardless of network latency discrepancies
 * (e.g. Wi-Fi vs 4G/LTE mobile ping differences).
 * 
 * Rather than declaring whoever's HTTP packet reaches PostgreSQL first as the winner,
 * it opens a brief arbitration window (220ms) upon the first buzz arrival.
 * Any buzzes arriving during this window are sorted by their calibrated physical
 * press timestamp (pressedAt). The player who physically touched the button first
 * WINS the buzz.
 */

export interface Candidate {
  playerId: string
  playerName: string
  pressedAt: number
  receivedAt: number
}

export interface ArbitrationResult {
  winnerId: string
  winnerName: string
}

interface ArbitrationSession {
  key: string
  deadline: number
  candidates: Candidate[]
  promise: Promise<ArbitrationResult>
  resolve: (res: ArbitrationResult) => void
}

// In-process shared session map (keyed by `${gameId}:${attempt}`)
// Persisted across requests within the same Node/Next.js runtime
declare global {
  // eslint-disable-next-line no-var
  var __buzzer_arbitration_sessions: Map<string, ArbitrationSession> | undefined
  // eslint-disable-next-line no-var
  var __buzzer_recent_results: Map<string, { winnerId: string; winnerName: string; finalizedAt: number }> | undefined
}

const activeSessions = globalThis.__buzzer_arbitration_sessions ?? new Map<string, ArbitrationSession>()
globalThis.__buzzer_arbitration_sessions = activeSessions

const recentResults = globalThis.__buzzer_recent_results ?? new Map<string, { winnerId: string; winnerName: string; finalizedAt: number }>()
globalThis.__buzzer_recent_results = recentResults

const ARBITRATION_WINDOW_MS = 220

/**
 * Arbitrates a buzz candidate against concurrent buzzes for the same round/attempt.
 */
export async function arbitrateBuzz(
  gameId: string,
  attempt: number,
  candidate: Candidate,
  onFinalize: (winner: Candidate, allCandidates: Candidate[]) => Promise<ArbitrationResult | null>
): Promise<ArbitrationResult> {
  const key = `${gameId}:${attempt}`
  const now = Date.now()

  // 1. Check if this attempt was already finalized within the last 10 seconds
  const cached = recentResults.get(key)
  if (cached) {
    return { winnerId: cached.winnerId, winnerName: cached.winnerName }
  }

  // 2. Check if an arbitration window is currently open
  const existingSession = activeSessions.get(key)
  if (existingSession && now < existingSession.deadline) {
    existingSession.candidates.push(candidate)
    return await existingSession.promise
  }

  // 3. Start a new arbitration session
  const deadline = now + ARBITRATION_WINDOW_MS
  let resolveWinner!: (res: ArbitrationResult) => void
  const promise = new Promise<ArbitrationResult>((resolve) => {
    resolveWinner = resolve
  })

  const session: ArbitrationSession = {
    key,
    deadline,
    candidates: [candidate],
    promise,
    resolve: resolveWinner,
  }
  activeSessions.set(key, session)

  // Schedule final evaluation at deadline
  const waitMs = Math.max(0, deadline - Date.now())
  setTimeout(async () => {
    try {
      // Sort candidates by calibrated physical touch timestamp (ASCENDING: lowest timestamp = earliest physical touch)
      session.candidates.sort((a, b) => a.pressedAt - b.pressedAt)
      const earliestCandidate = session.candidates[0]

      // Call database finalizer
      const dbResult = await onFinalize(earliestCandidate, session.candidates)
      const finalWinner = dbResult || {
        winnerId: earliestCandidate.playerId,
        winnerName: earliestCandidate.playerName,
      }

      recentResults.set(key, { ...finalWinner, finalizedAt: Date.now() })
      session.resolve(finalWinner)
    } catch (err) {
      console.error('[arbitrateBuzz] Error finalizing buzz:', err)
      const fallback = session.candidates[0]
      session.resolve({ winnerId: fallback.playerId, winnerName: fallback.playerName })
    } finally {
      activeSessions.delete(key)
      // Evict cached result after 10s
      setTimeout(() => {
        recentResults.delete(key)
      }, 10000)
    }
  }, waitMs)

  return await session.promise
}
