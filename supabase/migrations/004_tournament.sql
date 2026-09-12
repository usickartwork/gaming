-- ============================================================
-- CG GUESS THE SONG — Migration 004: Tournament Knockout Mode
-- ============================================================

-- Add game_mode and tournament_state to games table
ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS game_mode TEXT NOT NULL DEFAULT 'CLASSIC'
  CHECK (game_mode IN ('CLASSIC', 'KNOCKOUT'));

ALTER TABLE games 
  ADD COLUMN IF NOT EXISTS tournament_state JSONB DEFAULT NULL;
