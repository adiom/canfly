'use client'

import { Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { signOut } from 'next-auth/react'

import { safeInternalPath } from '@/lib/safe-redirect'
import {
  LOGIN_EYEBROW,
  LOGIN_GHOST,
  LOGIN_LABEL,
  LOGIN_PRIMARY,
  LOGIN_SERIF,
} from '@/lib/login-ui'

interface AlreadySignedInProps {
  displayName: string
  identity: string
}

function AlreadySignedInInner({ displayName, identity }: AlreadySignedInProps) {
  const searchParams = useSearchParams()
  const redirectTo = safeInternalPath(searchParams.get('redirect'))

  // Выход — только явным действием и только POST'ом: signOut из next-auth
  // отправляет форму с CSRF-токеном. Гасить сессию прямо на GET /login нельзя —
  // любой prefetch <Link href="/login"> или сторонний <img src="/login">
  // молча выкидывал бы пользователя из аккаунта.
  const handleSwitch = () => {
    const back = redirectTo === '/profile'
      ? '/login'
      : `/login?redirect=${encodeURIComponent(redirectTo)}`
    signOut({ redirectTo: back })
  }

  return (
    <div>
      <p className={LOGIN_EYEBROW}>Профиль читателя</p>

      <h1
        className="mt-5 text-[clamp(2.6rem,5vw,4.2rem)] font-light leading-[0.92] tracking-[-0.02em] text-cf-text-heading"
        style={{ fontFamily: LOGIN_SERIF }}
      >
        Вы уже <em className="italic text-cf-accent">здесь</em>
      </h1>

      <div className="mt-8 border-l-2 border-cf-text-1/15 pl-4">
        <p className={LOGIN_LABEL}>вошли как</p>
        <p
          className="mt-2 text-2xl font-light leading-tight text-cf-text-heading"
          style={{ fontFamily: LOGIN_SERIF }}
        >
          {displayName}
        </p>
        <p className="mt-1 break-all font-mono text-[11px] tracking-[0.08em] text-cf-text-3">
          {identity}
        </p>
      </div>

      <div className="mt-9 space-y-4">
        <Link href={redirectTo} className={`block text-center ${LOGIN_PRIMARY}`}>
          Продолжить как {displayName}
        </Link>

        <button type="button" onClick={handleSwitch} className={LOGIN_GHOST}>
          Войти в другой аккаунт
        </button>
      </div>
    </div>
  )
}

export function AlreadySignedIn(props: AlreadySignedInProps) {
  return (
    <Suspense fallback={null}>
      <AlreadySignedInInner {...props} />
    </Suspense>
  )
}
