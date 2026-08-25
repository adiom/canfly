'use client'

import { useSession, signOut } from 'next-auth/react'
import Link from 'next/link'

export default function StudioAccessDeniedPage() {
  const { status } = useSession()

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-[#111210] flex items-center justify-center">
        <p className="text-[#f4efe5]/40 text-sm">Загрузка...</p>
      </main>
    )
  }

  return (
    <main className="min-h-screen bg-[#111210] flex items-center justify-center px-4">
      <div className="w-full max-w-md text-center space-y-8">
        <div>
          <Link href="/" className="text-2xl font-black uppercase tracking-[0.18em] text-[#f4efe5]">
            canfly
          </Link>
        </div>

        <div className="border border-[#f4efe5]/10 rounded-lg p-8 space-y-6 text-left">
          <div className="space-y-1">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d52525]">Нет доступа</p>
            <h1 className="text-xl font-black text-[#f4efe5]">Studio недоступна</h1>
          </div>

          <div className="space-y-3 text-sm">
            <p className="text-[#ded7cc] leading-7">
              Studio предназначена для авторов, редакторов и администраторов.
            </p>
            <p className="text-[#f4efe5]/40 text-xs leading-6">
              Чтобы получить доступ, обратитесь к администратору — он может изменить вашу роль.
            </p>
          </div>

          <div className="flex flex-col gap-3 pt-2">
            <Link href="/">
              <button className="w-full h-11 bg-[#d52525] text-white font-black uppercase text-sm tracking-[0.1em] hover:bg-[#b81e1e] transition-colors">
                На главную
              </button>
            </Link>
            <button
              onClick={() => signOut({ callbackUrl: '/' })}
              className="w-full h-11 border border-[#f4efe5]/15 text-[#f4efe5]/60 font-bold text-sm hover:border-[#f4efe5]/30 hover:text-[#f4efe5]/80 transition-colors"
            >
              Выйти из аккаунта
            </button>
          </div>
        </div>
      </div>
    </main>
  )
}
