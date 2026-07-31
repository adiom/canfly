'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

import { MagicLinkForm } from '@/components/magic-link-form'
import { Button } from '@/components/ui/button'

const isCanflySsoEnabled = process.env.NEXT_PUBLIC_CANFLY_SSO_ENABLED === 'true'
const isYandexEnabled = process.env.NEXT_PUBLIC_AUTH_YANDEX_ENABLED === 'true'
const isGoogleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === 'true'
const isGitHubEnabled = process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED === 'true'

const hasOAuth = isCanflySsoEnabled || isYandexEnabled || isGoogleEnabled || isGitHubEnabled

function LoginForm() {
  const searchParams = useSearchParams()

  // Редиректа «уже авторизован → /» здесь больше нет: это уже делает
  // proxy.ts (`pathname === '/login'` + valid token) до отрисовки страницы.
  // Дублирующий клиентский эффект здесь гонялся с router.push('/profile')
  // из MagicLinkForm после входа по коду и иногда побеждал — уносил на / вместо /profile.

  // Автологина по ?magic_email= здесь больше нет: он входил под любым адресом
  // из query-строки, то есть ссылка вида /login?magic_email=victim@example.com
  // логинила под жертвой. Вход по ссылке живёт на /hi/[token].

  const errorParam = searchParams.get('error')
  const errorMessages: Record<string, string> = {
    invalid_token: 'Ссылка недействительна',
    expired_token: 'Ссылка устарела. Запросите новую.',
    used_token: 'Ссылка уже была использована',
    server_error: 'Ошибка сервера. Попробуйте снова.',
  }

  return (
    <div className="w-full max-w-md border border-[#f4efe5]/10 bg-[#1b1c19] p-6">
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#d7c6ad]">
        Профиль читателя
      </p>
      <h1 className="mt-3 text-3xl font-black uppercase">Вход</h1>
      <p className="mt-3 text-sm leading-6 text-[#ded7cc]">
        Введите email — мы отправим ссылку для входа. Аккаунт создаётся автоматически.
      </p>

      {errorParam && errorMessages[errorParam] && (
        <div className="mt-5 border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {errorMessages[errorParam]}
        </div>
      )}

      <div className="mt-6">
        <MagicLinkForm />
      </div>

      {hasOAuth && (
        <>
          <div className="mt-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-[#f4efe5]/10" />
            <span className="text-xs uppercase tracking-[0.12em] text-[#ded7cc]/50">или</span>
            <div className="h-px flex-1 bg-[#f4efe5]/10" />
          </div>

          <div className="mt-4 flex flex-col gap-3">
            {isCanflySsoEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => signIn('canfly', { callbackUrl: searchParams.get('redirect') || '/' })}
                className="h-11 w-full border-[#f6d6a8]/35 bg-[#f6d6a8]/10 text-sm font-black uppercase text-[#f6d6a8] hover:bg-[#f6d6a8]/15"
              >
                Войти через canfly
              </Button>
            )}

            {isYandexEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => signIn('yandex', { callbackUrl: searchParams.get('redirect') || '/' })}
                className="h-11 w-full border-[#f4efe5]/10 text-sm font-bold uppercase text-[#ded7cc] hover:bg-[#f4efe5]/5"
              >
                Войти через Яндекс
              </Button>
            )}

            {isGoogleEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => signIn('google', { callbackUrl: searchParams.get('redirect') || '/' })}
                className="h-11 w-full border-[#f4efe5]/10 text-sm font-bold uppercase text-[#ded7cc] hover:bg-[#f4efe5]/5"
              >
                Войти через Google
              </Button>
            )}

            {isGitHubEnabled && (
              <Button
                type="button"
                variant="outline"
                onClick={() => signIn('github', { callbackUrl: searchParams.get('redirect') || '/' })}
                className="h-11 w-full border-[#f4efe5]/10 text-sm font-bold uppercase text-[#ded7cc] hover:bg-[#f4efe5]/5"
              >
                Войти через GitHub
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

export default function LoginPage() {
  return (
    <main className="min-h-screen bg-[#111210] text-[#f4efe5]">
      <header className="border-b border-[#f4efe5]/10 bg-[#111210]/95">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-5 md:px-8">
          <Link
            href="/"
            className="text-xl font-black uppercase tracking-[0.18em] text-[#f4efe5]"
          >
            canfly
          </Link>
          <Link
            href="/characters"
            className="text-xs font-bold uppercase tracking-[0.18em] text-[#ded7cc]"
          >
            Персонажи
          </Link>
        </div>
      </header>

      <section className="mx-auto flex min-h-[calc(100vh-73px)] max-w-7xl items-center px-4 py-12 md:px-8">
        <Suspense fallback={null}>
          <LoginForm />
        </Suspense>
      </section>
    </main>
  )
}
