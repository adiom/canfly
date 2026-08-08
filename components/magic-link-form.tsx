'use client'

import { useState, useEffect, useCallback, useActionState, startTransition } from 'react'
import { createMagicLink, type CreateMagicLinkState } from '@/app/(auth)/actions'
import { signIn, useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { safeInternalPath } from '@/lib/safe-redirect'
import {
  LOGIN_FIELD,
  LOGIN_GHOST,
  LOGIN_LABEL,
  LOGIN_NOTE,
  LOGIN_PRIMARY,
} from '@/lib/login-ui'

interface MagicLinkFormProps {
  onFocus?: () => void
  onBlur?: () => void
}

const COOLDOWN_SECONDS = 60

export function MagicLinkForm({ onFocus, onBlur }: MagicLinkFormProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const { update: updateSession } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  // Без safeInternalPath ?redirect=https://example.com уносил наружу
  // сразу после успешного входа по коду.
  const redirectTo = safeInternalPath(searchParams.get('redirect'))

  useEffect(() => {
    if (cooldown <= 0) return
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000)
    return () => clearTimeout(timer)
  }, [cooldown])

  const [state, formAction] = useActionState<CreateMagicLinkState, FormData>(
    createMagicLink,
    { status: 'idle' },
  )

  const isSuccess = state.status === 'success'
  const isLoading = state.status === 'in_progress'
  const magicCode = state.magicLink

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const formData = new FormData()
    formData.append('email', email)
    setCooldown(COOLDOWN_SECONDS)
    startTransition(() => {
      formAction(formData)
    })
  }

  const handleResend = useCallback(() => {
    if (cooldown > 0) return
    const formData = new FormData()
    formData.append('email', email)
    setCooldown(COOLDOWN_SECONDS)
    startTransition(() => {
      formAction(formData)
    })
  }, [cooldown, email, formAction])

  const handleCodeSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim()) return

    setCodeError('')
    setCodeLoading(true)

    try {
      // Код уходит прямо в authorize — он там и проверяется, и гасится.
      // Отдельной серверной проверки «до» больше нет: именно разрыв между
      // проверкой кода и выдачей сессии позволял войти по одному email.
      const signInResult = await signIn('credentials', {
        email,
        token: code.trim(),
        via: 'code',
        redirect: false,
      })

      if (signInResult?.error) {
        setCodeError('Неверный или просроченный код')
        setCodeLoading(false)
        return
      }

      await updateSession()
      // push() на новый маршрут уже приносит свежие серверные данные —
      // следом идущий refresh() обрывал этот же в разгаре RSC-запрос
      // (ERR_ABORTED) и был чистым дублированием.
      router.push(redirectTo)
    } catch {
      setCodeError('Ошибка соединения')
      setCodeLoading(false)
    }
  }

  // После успешного создания кода — показать кнопку "Ввести код".
  // В production magicCode не приходит вовсе: код уходит только на почту.
  if (isSuccess && !showCodeInput) {
    return (
      <div className="space-y-5">
        <p className="text-sm leading-6 text-cf-text-3">
          Письмо ушло на <span className="text-cf-text-1">{email}</span>. В нём восьмизначный код.
        </p>

        {magicCode && (
          <div className="border border-cf-text-1/12 bg-cf-bg-2 px-4 py-3">
            <p className={LOGIN_LABEL}>код создан · только в dev</p>
            <p
              className="mt-2 font-mono text-xl tracking-[0.4em] text-cf-warm"
              data-testid="magic-code"
            >
              {magicCode}
            </p>
          </div>
        )}

        <button type="button" onClick={() => setShowCodeInput(true)} className={LOGIN_PRIMARY}>
          Ввести код
        </button>

        {cooldown > 0 ? (
          <p className={`text-center ${LOGIN_LABEL}`}>отправить повторно через {cooldown} сек</p>
        ) : (
          <button type="button" onClick={handleResend} className={LOGIN_GHOST}>
            Отправить повторно
          </button>
        )}
      </div>
    )
  }

  // Форма ввода кода
  if (showCodeInput) {
    return (
      <div className="space-y-5">
        <form onSubmit={handleCodeSubmit} className="space-y-5">
          <label className="block">
            <span className={LOGIN_LABEL}>код из письма</span>
            <input
              type="text"
              inputMode="numeric"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345678"
              maxLength={8}
              required
              className={`${LOGIN_FIELD} mt-2 text-center font-mono text-2xl tracking-[0.45em]`}
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </label>

          {codeError && <p className={LOGIN_NOTE}>{codeError}</p>}

          <button type="submit" disabled={codeLoading} className={LOGIN_PRIMARY}>
            {codeLoading ? 'Проверка…' : 'Войти по коду'}
          </button>
        </form>

        <button type="button" onClick={() => setShowCodeInput(false)} className={LOGIN_GHOST}>
          Назад
        </button>
      </div>
    )
  }

  // Основная форма
  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      {state.status === 'failed' && (
        <p className={LOGIN_NOTE}>{state.message || 'Ошибка. Попробуйте снова.'}</p>
      )}

      <label className="block">
        <span className={LOGIN_LABEL}>email</span>
        <input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={isLoading}
          className={`${LOGIN_FIELD} mt-2`}
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </label>

      <button type="submit" disabled={isLoading} className={LOGIN_PRIMARY}>
        {isLoading ? 'Отправка…' : 'Получить ссылку для входа'}
      </button>
    </form>
  )
}
