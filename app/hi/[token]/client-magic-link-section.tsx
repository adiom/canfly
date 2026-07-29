'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { signIn, useSession } from 'next-auth/react'

interface ClientMagicLinkSectionProps {
  token: string
}

export function ClientMagicLinkSection({ token }: ClientMagicLinkSectionProps) {
  const router = useRouter()
  const { update: updateSession } = useSession()
  const started = useRef(false)

  useEffect(() => {
    // Токен одноразовый — второй signIn получит уже погашенный код,
    // поэтому эффект должен отработать ровно один раз.
    if (started.current) return
    started.current = true

    signIn('credentials', { token, via: 'link', redirect: false })
      .then(async (result) => {
        if (result?.error) {
          router.push('/login?error=invalid_token')
          return
        }
        await updateSession()
        // push() на новый маршрут уже приносит свежие серверные данные —
        // следом идущий refresh() обрывал этот же в разгаре RSC-запрос.
        router.push('/profile')
      })
      .catch(() => {
        router.push('/login?error=server_error')
      })
  }, [token, router, updateSession])

  return null
}
