'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Link2, Unlink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { getAccountSettings, unlinkAccount } from '@/lib/actions/account-settings'
import type { LinkedAccount } from '@/lib/actions/account-settings'

interface AccountSettingsClientProps {
  initialLinkedAccounts: LinkedAccount[]
}

const PROVIDERS: Record<string, { label: string; icon: string }> = {
  yandex: { label: 'Яндекс', icon: 'Я' },
  github: { label: 'GitHub', icon: 'G' },
  google: { label: 'Google', icon: 'G' },
  twitter: { label: 'X', icon: 'X' },
  canfly: { label: 'canfly', icon: 'C' },
}

/** Метка «этот OAuth-вход — привязка, а не логин». Читается в auth.config.ts. */
const OAUTH_LINK_COOKIE = 'cf_oauth_link'

function oauthCookieSuffix() {
  return `path=/; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`
}

function setOauthLinkCookie(providerId: string) {
  // 5 минут: привязка — это один редирект туда-обратно, больше не нужно.
  document.cookie = `${OAUTH_LINK_COOKIE}=${providerId}; max-age=300; ${oauthCookieSuffix()}`
}

function clearOauthLinkCookie() {
  document.cookie = `${OAUTH_LINK_COOKIE}=; max-age=0; ${oauthCookieSuffix()}`
}

export function AccountSettingsClient({ initialLinkedAccounts }: AccountSettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(initialLinkedAccounts)

  async function refreshData() {
    const data = await getAccountSettings()
    if (data) {
      setLinkedAccounts(data.linkedAccounts)
    }
  }

  useEffect(() => {
    const linked = searchParams.get('linked')
    const linkError = searchParams.get('link_error')
    if (!linked && !linkError) return

    // Cookie снимается сразу по возвращении с провайдера. Без этого она жила
    // все 600 секунд, и обычный вход тем же провайдером всё это время уходил
    // в ветку линковки (auth.config.ts) — то есть ломался с link_error=session.
    clearOauthLinkCookie()

    if (linked) {
      toast.success(`Аккаунт ${PROVIDERS[linked]?.label ?? linked} привязан`)
    } else {
      toast.error(
        linkError === 'session'
          ? 'Сессия истекла — войдите заново и повторите привязку'
          : 'Не удалось привязать аккаунт',
      )
    }

    // router.replace убирает query и перезапрашивает страницу серверно —
    // свежий список привязок приходит в проп initialLinkedAccounts.
    router.replace('/profile/settings')
  }, [searchParams, router])

  async function handleUnlinkAccount(accountId: string) {
    if (!confirm('Отвязать аккаунт?')) return
    try {
      await unlinkAccount(accountId)
      await refreshData()
      toast.success('Аккаунт отвязан')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    }
  }

  function handleLinkAccount(providerId: string) {
    setOauthLinkCookie(providerId)
    signIn(providerId, { redirectTo: '/profile/settings?linked=' + providerId })
  }

  return (
    <div className="space-y-8">
      {/* Внешние аккаунты */}
      <section>
        <h2 className="mb-4 text-xl font-black uppercase">Внешние аккаунты</h2>
        <div className="space-y-2">
          {linkedAccounts.map((account) => {
            const provider = PROVIDERS[account.provider] || { label: account.provider, icon: '?' }
            return (
              <div
                key={account.id}
                className="flex items-center justify-between border border-cf-text-1/10 bg-cf-bg-2 p-4"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center border border-cf-text-1/10 bg-cf-bg text-xs font-black uppercase text-cf-text-2">
                    {provider.icon}
                  </div>
                  <div>
                    <span className="text-sm font-bold text-cf-text-1">{provider.label}</span>
                    {account.display_name && (
                      <span className="ml-2 text-sm text-cf-text-2">({account.display_name})</span>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => handleUnlinkAccount(account.id)}
                  className="h-8 border border-cf-text-1/15 px-3 text-xs font-bold uppercase text-cf-text-3 hover:border-cf-text-1/30 hover:text-cf-text-1"
                >
                  <Unlink className="mr-1 h-3 w-3" />
                  Отвязать
                </Button>
              </div>
            )
          })}

          {linkedAccounts.length === 0 && (
            <p className="border border-cf-text-1/10 bg-cf-bg-2 p-4 text-sm text-cf-text-2">
              Нет привязанных аккаунтов. Войдите через OAuth, чтобы привязать.
            </p>
          )}
        </div>

        {/* Кнопки привязки */}
        <div className="mt-4 flex flex-wrap gap-3">
          {Object.entries(PROVIDERS).map(([providerId, provider]) => {
            const isLinked = linkedAccounts.some((a) => a.provider === providerId)
            if (isLinked) return null
            return (
              <Button
                key={providerId}
                onClick={() => handleLinkAccount(providerId)}
                className="h-10 border border-cf-text-1/18 px-4 text-xs font-bold uppercase text-cf-text-1 hover:bg-cf-text-1/8"
              >
                <Link2 className="mr-2 h-4 w-4" />
                Привязать {provider.label}
              </Button>
            )
          })}
        </div>
      </section>

      {/* Информация */}
      <section className="border border-cf-text-1/10 bg-cf-bg-2 p-4">
        <div className="flex items-start gap-3">
          <Shield className="mt-0.5 h-5 w-5 text-cf-warm" />
          <div className="text-sm text-cf-text-2">
            <p className="font-bold text-cf-text-1">Безопасность</p>
            <p className="mt-1">
              Привязанные аккаунты с публичным профилем (X, GitHub) показываются на вашей странице
              как соцсети.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
