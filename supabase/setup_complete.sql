-- ============================================================
-- CG GUESS THE SONG — Complete Database Setup
-- Paste this entire file into Supabase SQL Editor and Run.
-- ============================================================


-- ============================================================
-- PART 1: SCHEMA
-- ============================================================

-- SONGS (master data, isi manual via Table Editor atau seed.sql)
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

-- Add FK: games.buzz_winner_id -> players
ALTER TABLE games ADD CONSTRAINT fk_buzz_winner
  FOREIGN KEY (buzz_winner_id) REFERENCES players(id) ON DELETE SET NULL;

-- SCORE CONFIG (per game, inserted on game creation)
CREATE TABLE IF NOT EXISTS score_configs (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id        UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  attempt_number INT NOT NULL,
  correct_points INT NOT NULL,
  wrong_points   INT NOT NULL,
  UNIQUE (game_id, attempt_number)
);

-- ATTEMPTS (history log per lagu)
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
CREATE INDEX IF NOT EXISTS idx_score_configs_game ON score_configs(game_id);

-- REPLICA IDENTITY (wajib untuk Supabase Realtime + RLS)
ALTER TABLE games    REPLICA IDENTITY FULL;
ALTER TABLE players  REPLICA IDENTITY FULL;
ALTER TABLE attempts REPLICA IDENTITY FULL;


-- ============================================================
-- PART 2: ROW LEVEL SECURITY
-- ============================================================

-- GAMES: public read, no client writes (service role only via API)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read games"
  ON games FOR SELECT USING (true);

-- PLAYERS: public read, anyone can insert (join game)
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read players"
  ON players FOR SELECT USING (true);
CREATE POLICY "anyone can join"
  ON players FOR INSERT WITH CHECK (true);

-- SONGS: public read (active only)
ALTER TABLE songs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read active songs"
  ON songs FOR SELECT USING (active = true);

-- SCORE_CONFIGS: public read
ALTER TABLE score_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read score configs"
  ON score_configs FOR SELECT USING (true);

-- ATTEMPTS: public read
ALTER TABLE attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read attempts"
  ON attempts FOR SELECT USING (true);


-- ============================================================
-- PART 3: ATOMIC BUZZ FUNCTION
-- ============================================================
-- Dipanggil dari API Route ketika player menekan BUZZ.
-- Hanya satu player yang bisa menang (atomic UPDATE).
-- Return: player_id jika menang, NULL jika sudah ada yang buzz lebih dulu.

CREATE OR REPLACE FUNCTION atomic_buzz(
  p_game_id   UUID,
  p_player_id UUID
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_winner UUID;
BEGIN
  UPDATE games
  SET
    buzz_winner_id = p_player_id,
    buzz_state     = 'LOCKED'
  WHERE
    id             = p_game_id
    AND buzz_state = 'READY'
    AND buzz_winner_id IS NULL
  RETURNING buzz_winner_id INTO v_winner;

  RETURN v_winner;
END;
$$;


-- ============================================================
-- DONE!
-- Setelah ini, buat Storage bucket "audio" (Public)
-- dan upload file MP3 kamu ke sana.
-- ============================================================
