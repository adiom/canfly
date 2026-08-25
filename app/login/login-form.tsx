'use client'

import { Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'

import { MagicLinkForm } from '@/components/magic-link-form'
import { safeInternalPath } from '@/lib/safe-redirect'
import { LOGIN_EYEBROW, LOGIN_LABEL, LOGIN_NOTE, LOGIN_SERIF } from '@/lib/login-ui'

const isCanflySsoEnabled = process.env.NEXT_PUBLIC_CANFLY_SSO_ENABLED === 'true'
const isYandexEnabled = process.env.NEXT_PUBLIC_AUTH_YANDEX_ENABLED === 'true'
const isGoogleEnabled = process.env.NEXT_PUBLIC_AUTH_GOOGLE_ENABLED === 'true'
const isGitHubEnabled = process.env.NEXT_PUBLIC_AUTH_GITHUB_ENABLED === 'true'
const isTwitterEnabled = process.env.NEXT_PUBLIC_AUTH_TWITTER_ENABLED === 'true'

const oauthProviders: { id: string; label: string }[] = [
  ...(isCanflySsoEnabled ? [{ id: 'canfly', label: 'canfly ID' }] : []),
  ...(isYandexEnabled ? [{ id: 'yandex', label: 'Яндекс' }] : []),
  ...(isGoogleEnabled ? [{ id: 'google', label: 'Google' }] : []),
  ...(isGitHubEnabled ? [{ id: 'github', label: 'GitHub' }] : []),
  ...(isTwitterEnabled ? [{ id: 'twitter', label: 'X' }] : []),
]

const hasOAuth = oauthProviders.length > 0

const errorMessages: Record<string, string> = {
  invalid_token: 'Ссылка недействительна',
  expired_token: 'Ссылка устарела. Запросите новую.',
  used_token: 'Ссылка уже была использована',
  server_error: 'Ошибка сервера. Попробуйте снова.',
  link_required:
    'Аккаунт с таким email уже существует. Войдите привычным способом и привяжите провайдера в настройках профиля.',
}

function LoginFormInner() {
  const searchParams = useSearchParams()

  // Редиректа «уже авторизован → /» здесь нет: этим занимается серверный
  // page.tsx, который рендерит <AlreadySignedIn> вместо формы.
  // Дублирующий клиентский эффект гонялся с router.push('/profile')
  // из MagicLinkForm после входа по коду и иногда побеждал — уносил на / вместо /profile.

  // Автологина по ?magic_email= здесь больше нет: он входил под любым адресом
  // из query-строки, то есть ссылка вида /login?magic_email=victim@example.com
  // логинила под жертвой. Вход по ссылке живёт на /hi/[token].

  const errorParam = searchParams.get('error')
  // Без safeInternalPath значение уходило прямо в callbackUrl — открытый редирект.
  const callbackUrl = safeInternalPath(searchParams.get('redirect'), '/')

  return (
    <div>
      <p className={LOGIN_EYEBROW}>Профиль читателя</p>

      <h1
        className="mt-5 text-[clamp(2.6rem,5vw,4.2rem)] font-light leading-[0.92] tracking-[-0.02em] text-cf-text-heading"
        style={{ fontFamily: LOGIN_SERIF }}
      >
        Место, на котором вы <em className="italic text-cf-accent">остановились</em>
      </h1>

      <p className="mt-5 text-[0.95rem] leading-relaxed text-cf-text-3">
        Прогресс, закладки и выделения останутся при вас на любом устройстве.
      </p>

      {errorParam && errorMessages[errorParam] && (
        <p className={`mt-6 ${LOGIN_NOTE}`}>{errorMessages[errorParam]}</p>
      )}

      <div className="mt-9">
        <MagicLinkForm />
      </div>

      {hasOAuth && (
        <>
          <div className="mt-9 flex items-center gap-4">
            <span className="h-px flex-1 bg-cf-text-1/12" />
            <span className={LOGIN_LABEL}>или</span>
            <span className="h-px flex-1 bg-cf-text-1/12" />
          </div>

          {/* Волосяная сетка: провайдеры — вторичный путь, форма остаётся главной. */}
          <div className="mt-5 grid grid-cols-2 gap-px border border-cf-text-1/12 bg-cf-text-1/12">
            {oauthProviders.map((provider, index) => (
              <button
                key={provider.id}
                type="button"
                onClick={() => signIn(provider.id, { redirectTo: callbackUrl })}
                className={`bg-cf-bg px-3 py-4 font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-2 transition-colors hover:bg-cf-bg-2 hover:text-cf-text-1 focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-cf-accent ${
                  index === oauthProviders.length - 1 && oauthProviders.length % 2 === 1
                    ? 'col-span-2'
                    : ''
                }`}
              >
                {provider.label}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function LoginForm() {
  return (
    <Suspense fallback={null}>
      <LoginFormInner />
    </Suspense>
  )
}
