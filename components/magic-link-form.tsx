'use client'

import { useState, useActionState, startTransition } from 'react'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { createMagicLink, type CreateMagicLinkState } from '@/app/(auth)/actions'
import { signIn, useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'

interface MagicLinkFormProps {
  onFocus?: () => void
  onBlur?: () => void
}

export function MagicLinkForm({ onFocus, onBlur }: MagicLinkFormProps) {
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [showCodeInput, setShowCodeInput] = useState(false)
  const [codeError, setCodeError] = useState('')
  const [codeLoading, setCodeLoading] = useState(false)
  const { update: updateSession } = useSession()
  const router = useRouter()

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
    startTransition(() => {
      formAction(formData)
    })
  }

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
      router.push('/profile')
    } catch {
      setCodeError('Ошибка соединения')
      setCodeLoading(false)
    }
  }

  // После успешного создания кода — показать кнопку "Ввести код".
  // В production magicCode не приходит вовсе: код уходит только на почту.
  if (isSuccess && !showCodeInput) {
    return (
      <div className="space-y-4">
        {magicCode && (
          <div className="border border-[#f4efe5]/10 bg-[#1b1c19] px-4 py-3 text-sm text-[#ded7cc]">
            <span className="font-bold text-[#d7c6ad]">Код создан: </span>
            <span className="font-mono text-[#f6d6a8] tracking-widest">{magicCode}</span>
          </div>
        )}

        <Button
          onClick={() => setShowCodeInput(true)}
          className="w-full h-11 bg-[#d52525] text-sm font-black uppercase text-white hover:bg-[#b91f1f]"
        >
          Ввести код
        </Button>

        <Button
          variant="outline"
          onClick={() => {
            setEmail('')
            window.location.reload()
          }}
          className="w-full h-11 border-[#f4efe5]/10 text-sm font-bold uppercase text-[#ded7cc] hover:bg-[#f4efe5]/5"
        >
          Новый код
        </Button>
      </div>
    )
  }

  // Форма ввода кода
  if (showCodeInput) {
    return (
      <div className="space-y-4">
        <form onSubmit={handleCodeSubmit} className="space-y-4">
          <label className="block space-y-2 text-sm text-[#ded7cc]">
            <span>Код из письма</span>
            <Input
              type="text"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="12345678"
              maxLength={8}
              required
              className="border-[#f4efe5]/10 bg-[#111210] text-center text-lg tracking-widest text-[#f4efe5]"
              onFocus={onFocus}
              onBlur={onBlur}
            />
          </label>

          {codeError && (
            <div className="border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
              {codeError}
            </div>
          )}

          <Button
            type="submit"
            disabled={codeLoading}
            className="w-full h-11 bg-[#d52525] text-sm font-black uppercase text-white hover:bg-[#b91f1f]"
          >
            {codeLoading ? 'Проверка...' : 'Войти по коду'}
          </Button>
        </form>

        <Button
          variant="outline"
          onClick={() => setShowCodeInput(false)}
          className="w-full h-11 border-[#f4efe5]/10 text-sm font-bold uppercase text-[#ded7cc] hover:bg-[#f4efe5]/5"
        >
          Назад
        </Button>
      </div>
    )
  }

  // Основная форма
  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {state.status === 'failed' && (
        <div className="border border-red-900/60 bg-red-950/40 px-4 py-3 text-sm text-red-200">
          {state.message || 'Ошибка. Попробуйте снова.'}
        </div>
      )}

      <label className="block space-y-2 text-sm text-[#ded7cc]">
        <span>Email</span>
        <Input
          type="email"
          name="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          disabled={isLoading}
          className="border-[#f4efe5]/10 bg-[#111210] text-[#f4efe5] placeholder-[#ded7cc]/40"
          onFocus={onFocus}
          onBlur={onBlur}
        />
      </label>

      <Button
        type="submit"
        disabled={isLoading}
        className="w-full h-11 bg-[#d52525] text-sm font-black uppercase text-white hover:bg-[#b91f1f]"
      >
        {isLoading ? 'Отправка...' : 'Получить ссылку для входа'}
      </Button>
    </form>
  )
}
