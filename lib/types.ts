// ============================================================
// CG GUESS THE SONG — Shared TypeScript Types
// ============================================================

export type BuzzState = 'DISABLED' | 'READY' | 'LOCKED' | 'ANSWERING' | 'RESULT'
export type GameStatus = 'LOBBY' | 'STARTING' | 'ROUND_ACTIVE' | 'ROUND_COMPLETE' | 'FINAL_RESULT'
export type RoundType = 'GUESS' | 'LYRICS'
export type Difficulty = 'EASY' | 'MEDIUM' | 'HARD'
export type AttemptResult = 'CORRECT' | 'WRONG'
export type GameMode = 'CLASSIC' | 'KNOCKOUT'
export type TournamentPhase = 'GROUP_A' | 'GROUP_B' | 'KNOCKOUT'
export type TournamentStage = 'GROUPS_SETUP' | 'GROUP_A' | 'GROUP_B' | 'KNOCKOUT'
export type TournamentMatchStatus = 'UPCOMING' | 'ACTIVE' | 'FINISHED'

export interface GroupData {
  name: 'Grup A' | 'Grup B'
  playerIds: string[]
  scores: Record<string, number>
  qualifiedPlayerIds: string[]
  status: 'UPCOMING' | 'ACTIVE' | 'FINISHED'
}

export interface TournamentMatch {
  id: string
  roundIndex: number
  roundName: string
  matchIndex: number
  player1Id: string | null
  player2Id: string | null
  player1Score: number
  player2Score: number
  winnerId: string | null
  nextMatchId: string | null
  nextMatchSlot: 1 | 2 | null
  status: TournamentMatchStatus
}

export interface PlaylistSection {
  id: string
  name: string
  songIds: string[]
}

export interface TournamentState {
  mode: GameMode
  phase: TournamentPhase
  groupAPlayerIds: string[]
  groupBPlayerIds: string[]
  matches: TournamentMatch[]
  activeMatchId: string | null
  targetPoints: number
  championId: string | null
  stage?: TournamentStage
  groupA?: GroupData
  groupB?: GroupData
  readyPlayerIds?: string[]
  countdownEndTime?: number | null
  qualifyCount?: 2 | 3
  playlists?: PlaylistSection[]
}

export interface Game {
  id: string
  room_code: string
  name: string
  status: GameStatus
  current_song_id: string | null
  current_round: RoundType
  buzz_state: BuzzState
  buzz_winner_id: string | null
  current_attempt: number
  created_at: string
  game_mode?: GameMode
  tournament_state?: TournamentState | null
}

export interface Player {
  id: string
  game_id: string
  name: string
  score: number
  connected: boolean
  session_token: string
  excluded_attempt: number | null
  joined_at: string
}

export interface Song {
  id: string
  title: string
  artist: string
  audio_url: string
  round_type: RoundType
  difficulty: Difficulty
  active: boolean
}

export interface ScoreConfig {
  attempt_number: number
  correct_points: number
  wrong_points: number
}

export interface Attempt {
  id: string
  game_id: string
  song_id: string | null
  attempt_number: number
  player_id: string | null
  result: AttemptResult | null
  points: number
  created_at: string
}

// Session stored in localStorage for players
export interface PlayerSession {
  playerId: string
  sessionToken: string
  gameId: string
  playerName: string
  roomCode: string
}

// Session stored in sessionStorage for host
export interface HostSession {
  gameId: string
  roomCode: string
  hostPassword: string // plaintext, used for API header
}

export const DEFAULT_SCORE_CONFIG: ScoreConfig[] = [
  { attempt_number: 1, correct_points: 10, wrong_points: -3 },
  { attempt_number: 2, correct_points: 7,  wrong_points: -2 },
  { attempt_number: 3, correct_points: 5,  wrong_points: 0  },
]
