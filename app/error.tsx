'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { AlertIcon } from '@/components/shared/Icons'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const router = useRouter()

  useEffect(() => {
    console.error('Root application error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-slate-950 select-none">
      <div className="glass-panel rounded-3xl p-8 border border-white/10 text-center max-w-sm w-full space-y-5 shadow-2xl">
        <div className="w-14 h-14 rounded-2xl bg-rose-500/20 text-rose-400 flex items-center justify-center mx-auto shadow-md">
          <AlertIcon size={28} />
        </div>
        <div>
          <h2 className="text-white text-lg font-black">Aplikasi Mengalami Masalah</h2>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Terjadi kendala saat memproses halaman ini. Silakan refresh atau kembali ke beranda.
          </p>
        </div>
        <div className="space-y-2 pt-2">
          <button
            onClick={() => reset()}
            className="w-full bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black py-3 rounded-2xl text-sm transition-all shadow-lg shadow-emerald-500/20 active:scale-95"
          >
            Coba Lagi
          </button>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-2xl text-sm transition-all border border-white/5 active:scale-95"
          >
            Kembali ke Beranda
          </button>
        </div>
      </div>
    </div>
  )
}

