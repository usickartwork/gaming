-- ============================================================
-- CG GUESS THE SONG — Sample Songs
-- Replace audio_url with actual Supabase Storage public URLs
-- ============================================================

INSERT INTO songs (title, artist, audio_url, round_type, difficulty) VALUES
  ('APT.', 'ROSÉ & Bruno Mars', 'https://your-project.supabase.co/storage/v1/object/public/audio/apt.mp3', 'GUESS', 'EASY'),
  ('Espresso', 'Sabrina Carpenter', 'https://your-project.supabase.co/storage/v1/object/public/audio/espresso.mp3', 'GUESS', 'EASY'),
  ('Die With A Smile', 'Lady Gaga & Bruno Mars', 'https://your-project.supabase.co/storage/v1/object/public/audio/die-with-a-smile.mp3', 'GUESS', 'MEDIUM'),
  ('Blinding Lights', 'The Weeknd', 'https://your-project.supabase.co/storage/v1/object/public/audio/blinding-lights.mp3', 'LYRICS', 'EASY'),
  ('Stay', 'The Kid LAROI & Justin Bieber', 'https://your-project.supabase.co/storage/v1/object/public/audio/stay.mp3', 'LYRICS', 'MEDIUM');
