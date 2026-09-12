-- ============================================================
-- CG GUESS THE SONG — Database Schema
-- ============================================================

-- SONGS (master data, filled manually via Supabase dashboard)
CREATE TABLE IF NOT EXISTS songs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  artist      TEXT NOT NULL,
  audio_url   TEXT NOT NULL,
  round_type  TEXT NOT NULL CHECK (round_type IN ('GUESS', 'LYRICS')),
  difficulty  TEXT NOT NULL DEFAULT 'EASY' CHECK (difficulty IN ('EASY', 'MEDIUM', 'HARD')),
  active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- GAMES
CREATE TABLE IF NOT EXISTS games (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  room_code        TEXT UNIQUE NOT NULL,
  name             TEXT NOT NULL,
  status           TEXT NOT NULL DEFAULT 'LOBBY'
                   CHECK (status IN ('LOBBY','STARTING','ROUND_ACTIVE','ROUND_COMPLETE','FINAL_RESULT')),
  host_secret      TEXT NOT NULL,
  current_song_id  UUID REFERENCES songs(id),
  current_round    TEXT NOT NULL DEFAULT 'GUESS' CHECK (current_round IN ('GUESS','LYRICS')),
  buzz_state       TEXT NOT NULL DEFAULT 'DISABLED'
                   CHECK (buzz_state IN ('DISABLED','READY','LOCKED','ANSWERING','RESULT')),
  buzz_winner_id   UUID,
  current_attempt  INT NOT NULL DEFAULT 1,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- PLAYERS
CREATE TABLE IF NOT EXISTS players (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id          UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  score            INT NOT NULL DEFAULT 0,
  connected        BOOLEAN NOT NULL DEFAULT TRUE,
  session_token    UUID NOT NULL DEFAULT gen_random_uuid(),
  excluded_attempt INT,
  joined_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add FK from games.buzz_winner_id -> players
ALTER TABLE games ADD CONSTRAINT fk_buzz_winner
  FOREIGN KEY (buzz_winner_id) REFERENCES players(id) ON DELETE SET NULL;

-- SCORE CONFIG (per game)
CREATE TABLE IF NOT EXISTS score_configs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  correct_points INT NOT NULL,
  wrong_points   INT NOT NULL,
  UNIQUE (game_id, attempt_number)
);

-- ATTEMPTS (history log)
CREATE TABLE IF NOT EXISTS attempts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  song_id        UUID REFERENCES songs(id),
  attempt_number INT NOT NULL,
  player_id      UUID REFERENCES players(id),
  result         TEXT CHECK (result IN ('CORRECT','WRONG')),
  points         INT NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- INDEXES
CREATE INDEX IF NOT EXISTS idx_games_room_code    ON games(room_code);
CREATE INDEX IF NOT EXISTS idx_players_game_id    ON players(game_id);
CREATE INDEX IF NOT EXISTS idx_players_session    ON players(session_token);
CREATE INDEX IF NOT EXISTS idx_attempts_game_id   ON attempts(game_id);

-- REPLICA IDENTITY (required for Realtime + RLS)
ALTER TABLE games    REPLICA IDENTITY FULL;
ALTER TABLE players  REPLICA IDENTITY FULL;
ALTER TABLE attempts REPLICA IDENTITY FULL;
