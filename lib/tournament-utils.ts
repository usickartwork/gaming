import type { Player, TournamentMatch, TournamentState } from './types'

/**
 * Returns user-friendly Indonesian round names based on distance to the final.
 */
export function getRoundName(roundIndex: number, totalRounds: number): string {
  const roundsFromFinal = totalRounds - 1 - roundIndex
  if (roundsFromFinal === 0) return 'Grand Final'
  if (roundsFromFinal === 1) return 'Semifinal'
  if (roundsFromFinal === 2) return 'Perempat Final'
  if (roundsFromFinal === 3) return 'Babak 16 Besar'
  return `Babak ${roundIndex + 1}`
}

/**
 * Generates a clean single-elimination bracket for any number of players (>= 2).
 * Handles odd numbers of players automatically with BYEs (free passes).
 */
export function generateKnockoutBracket(
  players: Player[],
  targetPoints: number = 2
): TournamentState {
  if (players.length < 2) {
    return {
      mode: 'KNOCKOUT',
      matches: [],
      activeMatchId: null,
      targetPoints,
      championId: null,
    }
  }

  // Shuffle players randomly for fair matchmaking
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const n = shuffled.length

  // Calculate bracket power of 2 (e.g. 4, 8, 16)
  let bracketSize = 2
  let totalRounds = 1
  while (bracketSize < n) {
    bracketSize *= 2
    totalRounds++
  }

  const matches: TournamentMatch[] = []

  // Create empty matches round by round from Round 0 up to Final
  // For each round r, number of matches = bracketSize / 2^(r+1)
  const roundMatchIds: string[][] = []

  for (let r = 0; r < totalRounds; r++) {
    const matchCount = bracketSize / Math.pow(2, r + 1)
    roundMatchIds[r] = []
    const roundName = getRoundName(r, totalRounds)

    for (let m = 0; m < matchCount; m++) {
      const matchId = `match-r${r}-m${m}`
      roundMatchIds[r].push(matchId)
      matches.push({
        id: matchId,
        roundIndex: r,
        roundName,
        matchIndex: m,
        player1Id: null,
        player2Id: null,
        player1Score: 0,
        player2Score: 0,
        winnerId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        status: 'UPCOMING',
      })
    }
  }

  // Link child matches to their next match in round r+1
  for (let r = 0; r < totalRounds - 1; r++) {
    const currentRoundIds = roundMatchIds[r]
    const nextRoundIds = roundMatchIds[r + 1]

    currentRoundIds.forEach((mId, idx) => {
      const parentMatchIndex = Math.floor(idx / 2)
      const slot = (idx % 2 === 0 ? 1 : 2) as 1 | 2
      const match = matches.find((m) => m.id === mId)
      if (match) {
        match.nextMatchId = nextRoundIds[parentMatchIndex]
        match.nextMatchSlot = slot
      }
    })
  }

  // Seed players into Round 0
  // Number of BYEs = bracketSize - n
  const numByes = bracketSize - n
  const round0Matches = matches.filter((m) => m.roundIndex === 0)

  // Pairing strategy:
  // Give top seeded spots to players with standard matches, and bottom spots can have BYEs
  const slots: (string | null)[] = new Array(bracketSize).fill(null)
  
  // Assign players to slots
  for (let i = 0; i < n; i++) {
    slots[i] = shuffled[i].id
  }

  round0Matches.forEach((m, idx) => {
    const p1 = slots[idx * 2]
    const p2 = slots[idx * 2 + 1]
    m.player1Id = p1
    m.player2Id = p2

    // If player 2 is null (a BYE), player 1 automatically advances!
    if (p1 && !p2) {
      m.winnerId = p1
      m.status = 'FINISHED'
      // Push p1 to next round
      if (m.nextMatchId) {
        const nextM = matches.find((nm) => nm.id === m.nextMatchId)
        if (nextM) {
          if (m.nextMatchSlot === 1) nextM.player1Id = p1
          else nextM.player2Id = p1
        }
      }
    }
  })

  // Find first playable match that has 2 players
  const firstPlayable = matches.find(
    (m) => m.player1Id && m.player2Id && m.status === 'UPCOMING'
  )

  if (firstPlayable) {
    firstPlayable.status = 'ACTIVE'
  }

  return {
    mode: 'KNOCKOUT',
    matches,
    activeMatchId: firstPlayable?.id ?? null,
    targetPoints,
    championId: null,
  }
}

/**
 * Advances a winner of a match to the subsequent round.
 * If the match is the final round, crowns the champion!
 */
export function advanceMatchWinner(
  state: TournamentState,
  matchId: string,
  winnerId: string
): TournamentState {
  const matches = state.matches.map((m) => ({ ...m }))
  const match = matches.find((m) => m.id === matchId)
  if (!match) return state

  match.winnerId = winnerId
  match.status = 'FINISHED'

  let championId = state.championId

  if (match.nextMatchId) {
    const nextMatch = matches.find((m) => m.id === match.nextMatchId)
    if (nextMatch) {
      if (match.nextMatchSlot === 1) {
        nextMatch.player1Id = winnerId
      } else {
        nextMatch.player2Id = winnerId
      }
    }
  } else {
    // This was the Grand Final!
    championId = winnerId
  }

  // Find next upcoming match with both players ready
  let nextActiveId: string | null = null
  if (!championId) {
    const nextPlayable = matches.find(
      (m) => m.player1Id && m.player2Id && m.status === 'UPCOMING'
    )
    if (nextPlayable) {
      nextPlayable.status = 'ACTIVE'
      nextActiveId = nextPlayable.id
    }
  }

  return {
    ...state,
    matches,
    activeMatchId: nextActiveId,
    championId,
  }
}

/**
 * Records a duel point for a player in the active match.
 * If the player reaches targetPoints, automatically advances the winner!
 */
export function recordDuelPoint(
  state: TournamentState,
  activeMatchId: string,
  scorerPlayerId: string
): { updatedState: TournamentState; matchWon: boolean; winnerId: string | null } {
  const matches = state.matches.map((m) => ({ ...m }))
  const match = matches.find((m) => m.id === activeMatchId)

  if (!match || match.status !== 'ACTIVE') {
    return { updatedState: state, matchWon: false, winnerId: null }
  }

  let p1Score = match.player1Score
  let p2Score = match.player2Score

  if (match.player1Id === scorerPlayerId) {
    p1Score += 1
  } else if (match.player2Id === scorerPlayerId) {
    p2Score += 1
  } else {
    return { updatedState: state, matchWon: false, winnerId: null }
  }

  match.player1Score = p1Score
  match.player2Score = p2Score

  // Check if player won the duel
  if (p1Score >= state.targetPoints) {
    const advanced = advanceMatchWinner({ ...state, matches }, match.id, match.player1Id!)
    return { updatedState: advanced, matchWon: true, winnerId: match.player1Id }
  } else if (p2Score >= state.targetPoints) {
    const advanced = advanceMatchWinner({ ...state, matches }, match.id, match.player2Id!)
    return { updatedState: advanced, matchWon: true, winnerId: match.player2Id }
  }

  return {
    updatedState: {
      ...state,
      matches,
    },
    matchWon: false,
    winnerId: null,
  }
}

/**
 * Extracts the user-facing game title without any internal tournament serialization metadata.
 */
export function getGameDisplayName(name: string): string {
  if (!name) return 'CG Guess The Song'
  return name.split('|||')[0].trim() || 'CG Guess The Song'
}

/**
 * Parses tournament state from game object with seamless backwards compatibility.
 */
export function getTournamentState(game: { tournament_state?: TournamentState | null; name: string }): TournamentState | null {
  if (game.tournament_state && typeof game.tournament_state === 'object') {
    return game.tournament_state
  }
  if (game.name && game.name.includes('|||')) {
    try {
      const jsonStr = game.name.split('|||')[1]
      return JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse tournament state from game name:', e)
      return null
    }
  }
  return null
}

/**
 * Extracts active game mode (CLASSIC or KNOCKOUT).
 */
export function getGameMode(game: { game_mode?: string; tournament_state?: TournamentState | null; name: string }): 'CLASSIC' | 'KNOCKOUT' {
  if (game.game_mode === 'KNOCKOUT' || game.game_mode === 'CLASSIC') {
    return game.game_mode
  }
  const ts = getTournamentState(game)
  return ts?.mode === 'KNOCKOUT' ? 'KNOCKOUT' : 'CLASSIC'
}

/**
 * Encodes tournament state into the game name field for bulletproof database storage
 * even if SQL migration 004 has not yet been executed by the user.
 */
export function encodeGameStateName(currentName: string, state: TournamentState | null): string {
  const cleanName = getGameDisplayName(currentName)
  if (!state) return cleanName
  return `${cleanName}|||${JSON.stringify(state)}`
}

