-- ============================================================
-- CG GUESS THE SONG — Row Level Security Policies
-- ============================================================
-- NOTE: Score/game-state updates are done ONLY via API Routes
-- using the SERVICE_ROLE_KEY (bypasses RLS). Anon key is used
-- only for reading data and Realtime subscriptions.

-- GAMES: public read, no client writes (service role only)
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read games"
  ON games FOR SELECT USING (true);

-- PLAYERS: public read, client can insert (join), no update from client
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public read players"
  ON players FOR SELECT USING (true);
CREATE POLICY "anyone can join"
  ON players FOR INSERT WITH CHECK (true);

-- SONGS: public read (active songs only)
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
