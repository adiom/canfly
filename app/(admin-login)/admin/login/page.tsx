'use client'

import { useSession, signIn } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'
import Link from 'next/link'

const ROLE_LABELS: Record<string, string> = {
  reader: 'Читатель',
  author: 'Автор',
  editor: 'Редактор',
  admin: 'Администратор',
}

export default function AdminLoginPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const roles = (session?.user as { roles?: string[] } | undefined)?.roles ?? []
  const isAdmin = roles.includes('admin')

  useEffect(() => {
    if (status === 'authenticated' && isAdmin) {
      router.replace('/admin')
    }
  }, [status, isAdmin, router])

  if (status === 'loading') {
    return (
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center">
        <p className="text-slate-400">Загрузка...</p>
      </main>
    )
  }

  const roleLabels = roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="text-3xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400 inline-block">
            Canfly
          </Link>
          <p className="text-slate-400 mt-2">Администраторская панель</p>
        </div>

        <div className="bg-slate-800 border border-slate-700 rounded-lg p-8 space-y-6">
          <h1 className="text-2xl font-bold text-white">Вход для администраторов</h1>

          {status === 'authenticated' && !isAdmin ? (
            <div className="space-y-4">
              <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-sm space-y-2">
                <p className="text-red-200 font-semibold">Недостаточно прав</p>
                <p className="text-red-300">
                  Ваша роль: <span className="font-mono bg-red-900/50 px-1.5 py-0.5 rounded text-red-100">{roleLabels || 'нет ролей'}</span>
                </p>
                <p className="text-red-400 text-xs">
                  Для входа в панель администратора требуется роль «Администратор».
                </p>
              </div>
              <Link href="/">
                <button className="w-full h-12 bg-slate-700 hover:bg-slate-600 rounded-lg text-white font-bold transition-colors">
                  На главную
                </button>
              </Link>
            </div>
          ) : status === 'authenticated' && isAdmin ? (
            <p className="text-green-400 text-sm">Перенаправление в панель...</p>
          ) : (
            <div>
              <p className="text-slate-400 text-sm leading-relaxed mb-4">
                Войдите через единую систему. После аутентификации вы будете перенаправлены в панель управления.
              </p>
              <button
                onClick={() => signIn(undefined, { callbackUrl: '/admin' })}
                className="w-full h-12 bg-purple-600 hover:bg-purple-700 rounded-lg text-white font-bold transition-colors"
              >
                Войти
              </button>
            </div>
          )}
        </div>
      </div>
    </main>
  )
}
