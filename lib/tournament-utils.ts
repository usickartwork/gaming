import type { Player, TournamentMatch, TournamentState, TournamentPhase } from './types'

/**
 * Initializes tournament state for players.
 * Randomly distributes players into Group A and Group B.
 */
export function initTournamentState(
  players: Player[],
  targetPoints: number = 2
): TournamentState {
  const shuffled = [...players].sort(() => Math.random() - 0.5)
  const groupAPlayerIds: string[] = []
  const groupBPlayerIds: string[] = []

  shuffled.forEach((p, idx) => {
    if (idx % 2 === 0) {
      groupAPlayerIds.push(p.id)
    } else {
      groupBPlayerIds.push(p.id)
    }
  })

  return {
    mode: 'KNOCKOUT',
    phase: 'GROUP_A',
    groupAPlayerIds,
    groupBPlayerIds,
    matches: [],
    activeMatchId: null,
    targetPoints: targetPoints || 2,
    championId: null,
  }
}

/**
 * Re-shuffles players into Group A and Group B.
 */
export function shuffleTournamentGroups(
  state: TournamentState | null,
  players: Player[],
  targetPoints: number = 2
): TournamentState {
  return initTournamentState(players, targetPoints || state?.targetPoints || 2)
}

/**
 * Sets tournament phase:
 * - 'GROUP_A': Only Group A can buzz
 * - 'GROUP_B': Only Group B can buzz
 * - 'KNOCKOUT': Automatically takes Top 2 from Group A and Top 2 from Group B, generates Semifinals and Grand Final!
 */
export function setTournamentPhase(
  state: TournamentState,
  phase: TournamentPhase,
  players: Player[]
): TournamentState {
  if (phase === 'KNOCKOUT') {
    // Sort Group A players by current score
    const groupAPlayers = players
      .filter((p) => state.groupAPlayerIds.includes(p.id))
      .sort((a, b) => b.score - a.score)

    // Sort Group B players by current score
    const groupBPlayers = players
      .filter((p) => state.groupBPlayerIds.includes(p.id))
      .sort((a, b) => b.score - a.score)

    const a1 = groupAPlayers[0]?.id || null
    const a2 = groupAPlayers[1]?.id || null
    const b1 = groupBPlayers[0]?.id || null
    const b2 = groupBPlayers[1]?.id || null

    const matches: TournamentMatch[] = [
      {
        id: 'sf1',
        roundIndex: 0,
        roundName: 'Semifinal 1 (BO3)',
        matchIndex: 0,
        player1Id: a1,
        player2Id: b2,
        player1Score: 0,
        player2Score: 0,
        winnerId: null,
        nextMatchId: 'final',
        nextMatchSlot: 1,
        status: 'ACTIVE',
      },
      {
        id: 'sf2',
        roundIndex: 0,
        roundName: 'Semifinal 2 (BO3)',
        matchIndex: 1,
        player1Id: b1,
        player2Id: a2,
        player1Score: 0,
        player2Score: 0,
        winnerId: null,
        nextMatchId: 'final',
        nextMatchSlot: 2,
        status: 'UPCOMING',
      },
      {
        id: 'final',
        roundIndex: 1,
        roundName: 'Grand Final (BO3)',
        matchIndex: 0,
        player1Id: null,
        player2Id: null,
        player1Score: 0,
        player2Score: 0,
        winnerId: null,
        nextMatchId: null,
        nextMatchSlot: null,
        status: 'UPCOMING',
      },
    ]

    return {
      ...state,
      phase: 'KNOCKOUT',
      matches,
      activeMatchId: 'sf1',
      championId: null,
    }
  }

  return {
    ...state,
    phase,
  }
}

/**
 * Ensures any player is assigned to either Group A or Group B.
 */
export function ensurePlayerInGroup(state: TournamentState, playerId: string): TournamentState {
  if (state.groupAPlayerIds.includes(playerId) || state.groupBPlayerIds.includes(playerId)) {
    return state
  }

  if (state.groupAPlayerIds.length <= state.groupBPlayerIds.length) {
    return {
      ...state,
      groupAPlayerIds: [...state.groupAPlayerIds, playerId],
    }
  } else {
    return {
      ...state,
      groupBPlayerIds: [...state.groupBPlayerIds, playerId],
    }
  }
}

/**
 * Advances a winner of a match to the subsequent round.
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
    // Grand Final completed
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
 * Target points = 2 for Best of 3 (BO3).
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

  const target = state.targetPoints || 2

  if (p1Score >= target) {
    const advanced = advanceMatchWinner({ ...state, matches }, match.id, match.player1Id!)
    return { updatedState: advanced, matchWon: true, winnerId: match.player1Id }
  } else if (p2Score >= target) {
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
  let parsed: TournamentState | null = null

  if (game.tournament_state && typeof game.tournament_state === 'object') {
    parsed = game.tournament_state
  } else if (game.name && game.name.includes('|||')) {
    try {
      const jsonStr = game.name.split('|||')[1]
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse tournament state from game name:', e)
      return null
    }
  }

  if (parsed) {
    if (!parsed.groupAPlayerIds) {
      parsed.groupAPlayerIds = parsed.groupA?.playerIds || []
    }
    if (!parsed.groupBPlayerIds) {
      parsed.groupBPlayerIds = parsed.groupB?.playerIds || []
    }
    if (!parsed.phase) {
      parsed.phase = parsed.matches?.length > 0 ? 'KNOCKOUT' : 'GROUP_A'
    }
    if (!parsed.targetPoints) parsed.targetPoints = 2
  }

  return parsed
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

