import type { Player, TournamentMatch, TournamentState, TournamentStage, GroupData } from './types'

/**
 * Creates default GroupData.
 */
export function createDefaultGroup(name: 'Grup A' | 'Grup B'): GroupData {
  return {
    name,
    playerIds: [],
    scores: {},
    qualifiedPlayerIds: [],
    status: 'UPCOMING',
  }
}

/**
 * Splits players randomly and evenly into Group A and Group B.
 */
export function shuffleTournamentGroups(
  state: TournamentState | null,
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

  const groupA: GroupData = {
    name: 'Grup A',
    playerIds: groupAPlayerIds,
    scores: {},
    qualifiedPlayerIds: [],
    status: 'UPCOMING',
  }

  const groupB: GroupData = {
    name: 'Grup B',
    playerIds: groupBPlayerIds,
    scores: {},
    qualifiedPlayerIds: [],
    status: 'UPCOMING',
  }

  return {
    mode: 'KNOCKOUT',
    stage: 'GROUPS_SETUP',
    groupA,
    groupB,
    matches: [],
    activeMatchId: null,
    targetPoints: targetPoints || 2,
    championId: null,
  }
}

/**
 * Initializes tournament state for players.
 */
export function initTournamentState(players: Player[], targetPoints: number = 2): TournamentState {
  return shuffleTournamentGroups(null, players, targetPoints)
}

/**
 * Starts stage for Group A or Group B.
 */
export function startGroupStage(
  state: TournamentState,
  groupKey: 'groupA' | 'groupB'
): TournamentState {
  const stage: TournamentStage = groupKey === 'groupA' ? 'GROUP_A' : 'GROUP_B'
  return {
    ...state,
    stage,
    [groupKey]: {
      ...state[groupKey],
      status: 'ACTIVE',
    },
  }
}

/**
 * Records score for a player in the active group stage.
 */
export function recordGroupPoint(
  state: TournamentState,
  playerId: string,
  points: number
): TournamentState {
  if (state.stage !== 'GROUP_A' && state.stage !== 'GROUP_B') {
    return state
  }

  const groupKey = state.stage === 'GROUP_A' ? 'groupA' : 'groupB'
  const group = state[groupKey]

  const currentScore = group.scores[playerId] || 0
  const updatedScores = {
    ...group.scores,
    [playerId]: Math.max(0, currentScore + points),
  }

  return {
    ...state,
    [groupKey]: {
      ...group,
      scores: updatedScores,
    },
  }
}

/**
 * Finalizes a group stage:
 * Sorts group players by score descending. Top 2 advance (`qualifiedPlayerIds`).
 * If both groups are finished, automatically generates the BO3 Knockout matches (A1 vs B2, B1 vs A2)!
 */
export function finalizeGroupStage(
  state: TournamentState,
  groupKey: 'groupA' | 'groupB'
): TournamentState {
  const group = state[groupKey]
  
  // Sort players in this group by points descending
  const sortedPlayerIds = [...group.playerIds].sort((a, b) => {
    const scoreA = group.scores[a] || 0
    const scoreB = group.scores[b] || 0
    return scoreB - scoreA
  })

  // Top 2 advance
  const qualified = sortedPlayerIds.slice(0, 2)

  const updatedGroup: GroupData = {
    ...group,
    qualifiedPlayerIds: qualified,
    status: 'FINISHED',
  }

  let nextState: TournamentState = {
    ...state,
    [groupKey]: updatedGroup,
  }

  const otherGroupKey = groupKey === 'groupA' ? 'groupB' : 'groupA'
  const otherGroup = state[otherGroupKey]

  // If both groups are finished, generate BO3 Knockout matches
  if (otherGroup.status === 'FINISHED') {
    nextState = generateKnockoutFromGroups(nextState)
  }

  return nextState
}

/**
 * Generates the Semifinals and Grand Final (Best-of-3) from qualified players.
 * Semifinal 1 (BO3): A1 (Winner Grup A) vs B2 (Runner-up Grup B)
 * Semifinal 2 (BO3): B1 (Winner Grup B) vs A2 (Runner-up Grup A)
 * Grand Final (BO3): Winner SF1 vs Winner SF2
 */
export function generateKnockoutFromGroups(state: TournamentState): TournamentState {
  const a1 = state.groupA.qualifiedPlayerIds[0] || null
  const a2 = state.groupA.qualifiedPlayerIds[1] || null
  const b1 = state.groupB.qualifiedPlayerIds[0] || null
  const b2 = state.groupB.qualifiedPlayerIds[1] || null

  const matches: TournamentMatch[] = [
    {
      id: 'match-sf1',
      roundIndex: 0,
      roundName: 'Semifinal 1 (BO3)',
      matchIndex: 0,
      player1Id: a1,
      player2Id: b2,
      player1Score: 0,
      player2Score: 0,
      winnerId: null,
      nextMatchId: 'match-final',
      nextMatchSlot: 1,
      status: 'ACTIVE', // start immediately with SF1
    },
    {
      id: 'match-sf2',
      roundIndex: 0,
      roundName: 'Semifinal 2 (BO3)',
      matchIndex: 1,
      player1Id: b1,
      player2Id: a2,
      player1Score: 0,
      player2Score: 0,
      winnerId: null,
      nextMatchId: 'match-final',
      nextMatchSlot: 2,
      status: 'UPCOMING',
    },
    {
      id: 'match-final',
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
    stage: 'KNOCKOUT',
    matches,
    activeMatchId: 'match-sf1',
    targetPoints: state.targetPoints || 2,
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
 * Target points = 2 for Best of 3 (BO3).
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

  const target = state.targetPoints || 2

  // Check if player won the duel
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
 * Legacy single-elimination generator (preserved if needed).
 */
export function generateKnockoutBracket(
  players: Player[],
  targetPoints: number = 2
): TournamentState {
  return initTournamentState(players, targetPoints)
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

