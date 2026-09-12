-- ============================================================
-- CG GUESS THE SONG — Atomic Buzz Function
-- ============================================================
-- This function is called from the API Route when a player buzzes.
-- It atomically sets buzz_winner_id ONLY IF no one has buzzed yet.
-- Returns the winner player_id, or NULL if already taken.

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
  -- Returns the player_id if this player won the buzz
  -- Returns NULL if someone else already buzzed (or buzz wasn't READY)
END;
$$;
