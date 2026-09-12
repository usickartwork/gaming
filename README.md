# CG Guess The Song 🎵

Real-time multiplayer music quiz game. Built with Next.js 15 + Supabase.

## Setup

### 1. Buat Supabase Project

1. Daftar di [supabase.com](https://supabase.com) dan buat project baru
2. Buat bucket Storage bernama `audio` (set sebagai **Public**)
3. Upload file MP3 ke folder `audio/` di bucket tersebut
4. Salin URL Supabase project kamu

### 2. Setup Database

Buka **SQL Editor** di Supabase dashboard dan jalankan ketiga file ini secara berurutan:

```
supabase/migrations/001_schema.sql
supabase/migrations/002_rls.sql
supabase/migrations/003_functions.sql
```

Kemudian isi data lagu (edit `supabase/seed.sql` dengan URL audio yang benar lalu jalankan):
```
supabase/seed.sql
```

### 3. Environment Variables

```bash
cp .env.local.example .env.local
```

Isi `.env.local` dengan credentials dari Supabase dashboard:
- `NEXT_PUBLIC_SUPABASE_URL` — dari Settings > API
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — dari Settings > API  
- `SUPABASE_SERVICE_ROLE_KEY` — dari Settings > API (jangan di-expose ke publik)

### 4. Run Development Server

```bash
npm install
npm run dev
```

Buka [http://localhost:3000](http://localhost:3000)

---

## How to Play

### Host (Laptop)
1. Buka website → **Host Game**
2. Isi nama game + buat password host
3. Copy **Room Code** yang muncul → bagikan ke pemain
4. Tunggu pemain join → klik **START GAME**
5. Pilih lagu → tekan **PLAY**
6. Klik **ENABLE BUZZ** untuk membuka buzzer
7. Lihat siapa yang buzz pertama → klik **CORRECT** atau **WRONG**

### Player (HP)
1. Buka website → **Join Game**
2. Masukkan Room Code + nama kamu
3. Tunggu host mulai game
4. Tekan tombol **🔴 BUZZ** besar ketika tahu jawabannya
5. Jika menang: jawab secara lisan
6. Lihat score berubah real-time

---

## Scoring (Default)

| Attempt | Correct | Wrong |
|---------|---------|-------|
| 1       | +10     | -3    |
| 2       | +7      | -2    |
| 3       | +5      | 0     |

---

## Architecture

- **Frontend**: Next.js 15 App Router
- **Database**: Supabase PostgreSQL
- **Real-time**: Supabase Realtime (Postgres Changes + Presence)
- **Storage**: Supabase Storage (audio files)
- **Auth**: Simple per-game password for host, session token for players

### First Buzz (Atomic)

Penentuan siapa yang buzz pertama menggunakan atomic SQL transaction:

```sql
UPDATE games 
SET buzz_state = 'LOCKED', buzz_winner_id = $player_id
WHERE id = $game_id 
  AND buzz_state = 'READY' 
  AND buzz_winner_id IS NULL
RETURNING buzz_winner_id;
```

Hanya satu player yang bisa "menang" bahkan jika 12 HP menekan di saat yang sama.

---

## Tech Stack

- Next.js 15 (App Router)
- Supabase (PostgreSQL + Realtime + Storage)
- Tailwind CSS
- TypeScript
- bcryptjs (host password hashing)
