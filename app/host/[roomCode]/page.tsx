import { notFound, redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { HostDashboard } from '@/components/host/HostDashboard'
import { HostSessionLoader } from './HostSessionLoader'

export const dynamic = 'force-dynamic'

interface Props {
  params: Promise<{ roomCode: string }>
}

export default async function HostPage({ params }: Props) {
  const { roomCode } = await params
  const supabase = getSupabaseServerClient()

  const { data: game } = await supabase
    .from('games')
    .select('*')
    .eq('room_code', roomCode.toUpperCase())
    .single()

  if (!game) notFound()

  const { data: players } = await supabase
    .from('players')
    .select('*')
    .eq('game_id', game.id)
    .order('score', { ascending: false })

  const { data: songs } = await supabase
    .from('songs')
    .select('*')
    .eq('active', true)
    .order('title')

  return (
    <HostSessionLoader
      game={game}
      players={players ?? []}
      songs={songs ?? []}
      roomCode={roomCode.toUpperCase()}
    />
  )
}
