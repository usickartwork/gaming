import type { Player, TournamentMatch, TournamentState, TournamentPhase } from './types'

/**
 * Initializes tournament state for players.
 * Randomly distributes players into Group A and Group B.
 */
export function initTournamentState(
  players: Player[],
  targetPoints: number = 2,
  qualifyCount: 2 | 3 = 2
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
    qualifyCount: qualifyCount || 2,
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
  return initTournamentState(
    players,
    targetPoints || state?.targetPoints || 2,
    state?.qualifyCount || 2
  )
}

/**
 * Sets tournament phase:
 * - 'GROUP_A': Only Group A can buzz
 * - 'GROUP_B': Only Group B can buzz
 * - 'KNOCKOUT': Automatically takes Top 2 or Top 3 from Group A and Group B, generates Play-offs / Semifinals and Grand Final!
 */
export function setTournamentPhase(
  state: TournamentState,
  phase: TournamentPhase,
  players: Player[]
): TournamentState {
  if (phase === 'KNOCKOUT') {
    const qualifyCount = state.qualifyCount === 3 ? 3 : 2

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
    const a3 = groupAPlayers[2]?.id || null

    const b1 = groupBPlayers[0]?.id || null
    const b2 = groupBPlayers[1]?.id || null
    const b3 = groupBPlayers[2]?.id || null

    let matches: TournamentMatch[] = []
    let initialActiveId = 'sf1'

    if (qualifyCount === 3) {
      // 3 lolos per group = 6 players
      // QF1: A2 vs B3 -> winner to SF2 (slot 2)
      // QF2: B2 vs A3 -> winner to SF1 (slot 2)
      // SF1: A1 (BYE) vs winner QF2 -> winner to Final (slot 1)
      // SF2: B1 (BYE) vs winner QF1 -> winner to Final (slot 2)
      // Final: Winner SF1 vs Winner SF2
      matches = [
        {
          id: 'qf1',
          roundIndex: 0,
          roundName: 'Perempat Final 1 (BO3)',
          matchIndex: 0,
          player1Id: a2,
          player2Id: b3,
          player1Score: 0,
          player2Score: 0,
          winnerId: null,
          nextMatchId: 'sf2',
          nextMatchSlot: 2,
          status: 'ACTIVE',
        },
        {
          id: 'qf2',
          roundIndex: 0,
          roundName: 'Perempat Final 2 (BO3)',
          matchIndex: 1,
          player1Id: b2,
          player2Id: a3,
          player1Score: 0,
          player2Score: 0,
          winnerId: null,
          nextMatchId: 'sf1',
          nextMatchSlot: 2,
          status: 'UPCOMING',
        },
        {
          id: 'sf1',
          roundIndex: 1,
          roundName: 'Semifinal 1 (BO3)',
          matchIndex: 0,
          player1Id: a1,
          player2Id: null,
          player1Score: 0,
          player2Score: 0,
          winnerId: null,
          nextMatchId: 'final',
          nextMatchSlot: 1,
          status: 'UPCOMING',
        },
        {
          id: 'sf2',
          roundIndex: 1,
          roundName: 'Semifinal 2 (BO3)',
          matchIndex: 1,
          player1Id: b1,
          player2Id: null,
          player1Score: 0,
          player2Score: 0,
          winnerId: null,
          nextMatchId: 'final',
          nextMatchSlot: 2,
          status: 'UPCOMING',
        },
        {
          id: 'final',
          roundIndex: 2,
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
      initialActiveId = 'qf1'
    } else {
      // 2 lolos per group = 4 players
      matches = [
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
      initialActiveId = 'sf1'
    }

    return {
      ...state,
      phase: 'KNOCKOUT',
      matches,
      activeMatchId: initialActiveId,
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
export function getTournamentState(game: { tournament_state?: TournamentState | null; name: string } | null | undefined): TournamentState | null {
  if (!game) return null
  let parsed: TournamentState | null = null

  if (game.tournament_state && typeof game.tournament_state === 'object') {
    parsed = { ...game.tournament_state }
  } else if (game.name && typeof game.name === 'string' && game.name.includes('|||')) {
    try {
      const jsonStr = game.name.split('|||')[1]
      parsed = JSON.parse(jsonStr)
    } catch (e) {
      console.error('Failed to parse tournament state from game name:', e)
      return null
    }
  }

  if (parsed && typeof parsed === 'object') {
    if (!Array.isArray(parsed.matches)) {
      parsed.matches = []
    }
    if (!Array.isArray(parsed.groupAPlayerIds)) {
      parsed.groupAPlayerIds = (parsed as any).groupA?.playerIds || []
    }
    if (!Array.isArray(parsed.groupBPlayerIds)) {
      parsed.groupBPlayerIds = (parsed as any).groupB?.playerIds || []
    }
    if (!parsed.phase) {
      parsed.phase = parsed.matches.length > 0 ? 'KNOCKOUT' : 'GROUP_A'
    }
    if (!parsed.targetPoints) parsed.targetPoints = 2
    if (!Array.isArray(parsed.readyPlayerIds)) parsed.readyPlayerIds = []
    if (parsed.countdownEndTime === undefined) parsed.countdownEndTime = null
    if (!parsed.qualifyCount) parsed.qualifyCount = 2
    if (!parsed.mode) parsed.mode = 'CLASSIC'
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

/**
 * Helper to get ready player IDs from tournament state or empty array
 */
export function getReadyPlayerIds(state: TournamentState | null): string[] {
  return state?.readyPlayerIds || []
}

/**
 * Updates ready state for a player
 */
export function setPlayerReady(state: TournamentState | null, playerId: string, isReady: boolean): TournamentState {
  const current: TournamentState = state || {
    mode: 'CLASSIC',
    phase: 'GROUP_A',
    groupAPlayerIds: [],
    groupBPlayerIds: [],
    matches: [],
    activeMatchId: null,
    targetPoints: 2,
    championId: null,
    readyPlayerIds: [],
  }

  const existing = new Set(current.readyPlayerIds || [])
  if (isReady) {
    existing.add(playerId)
  } else {
    existing.delete(playerId)
  }

  return {
    ...current,
    readyPlayerIds: Array.from(existing),
  }
}

/**
 * Resets all players' ready state (e.g., when moving to next song or next match)
 */
export function resetReadyPlayers(state: TournamentState | null): TournamentState | null {
  if (!state) return null
  return {
    ...state,
    readyPlayerIds: [],
  }
}

/**
 * Encodes and saves tournament state into game record (both name column and tournament_state column)
 * Uses a single atomic update to prevent duplicate Realtime postgres_changes broadcast events.
 */
export async function saveGameTournament(
  supabase: any,
  gameId: string,
  currentName: string,
  state: TournamentState | null,
  mode: 'CLASSIC' | 'KNOCKOUT',
  extraUpdates?: Record<string, any>
) {
  const encodedName = encodeGameStateName(currentName, state)

  // Single combined update to prevent firing multiple postgres_changes triggers
  const { error } = await supabase
    .from('games')
    .update({
      name: encodedName,
      game_mode: mode,
      tournament_state: state,
      ...extraUpdates,
    })
    .eq('id', gameId)

  if (error) {
    // Fallback if tournament_state or game_mode column doesn't exist in DB schema
    await supabase
      .from('games')
      .update({ name: encodedName, ...extraUpdates })
      .eq('id', gameId)
  }
}

