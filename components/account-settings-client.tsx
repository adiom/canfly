'use client'

import { useState, useEffect, useActionState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { signIn } from 'next-auth/react'
import { Trash2, CheckCircle, Mail, Link2, Unlink, Shield } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import {
  getAccountSettings,
  addEmail,
  verifyEmail,
  setPrimaryEmail,
  removeEmail,
  unlinkAccount,
} from '@/lib/actions/account-settings'
import type { UserEmail, LinkedAccount } from '@/lib/actions/account-settings'

interface AccountSettingsClientProps {
  initialEmails: UserEmail[]
  initialLinkedAccounts: LinkedAccount[]
}

const PROVIDERS: Record<string, { label: string; icon: string }> = {
  yandex: { label: 'Яндекс', icon: 'Я' },
  github: { label: 'GitHub', icon: 'G' },
  google: { label: 'Google', icon: 'G' },
  canfly: { label: 'canfly', icon: 'C' },
}

export function AccountSettingsClient({ initialEmails, initialLinkedAccounts }: AccountSettingsClientProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [emails, setEmails] = useState<UserEmail[]>(initialEmails)
  const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccount[]>(initialLinkedAccounts)
  const [showAddEmail, setShowAddEmail] = useState(false)
  const [verifyingEmailId, setVerifyingEmailId] = useState<string | null>(null)
  const [verificationCode, setVerificationCode] = useState('')

  const [addEmailState, addEmailAction, isAddingEmail] = useActionState(addEmail, { status: 'idle' })
  const [verifyEmailState, verifyEmailAction, isVerifyingEmail] = useActionState(verifyEmail, { status: 'idle' })

  useEffect(() => {
    const linked = searchParams.get('linked')
    if (linked) {
      toast.success(`Аккаунт ${PROVIDERS[linked]?.label ?? linked} привязан`)
      refreshData()
      router.replace('/profile/settings')
    }
  }, [searchParams, router])

  useEffect(() => {
    if (addEmailState.status === 'success') {
      toast.success(addEmailState.message)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI after successful email add
      setShowAddEmail(false)
      refreshData()
    } else if (addEmailState.status === 'error') {
      toast.error(addEmailState.message)
    }
  }, [addEmailState])

  useEffect(() => {
    if (verifyEmailState.status === 'success') {
      toast.success(verifyEmailState.message)
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sync UI after successful email verify
      setVerifyingEmailId(null)
      setVerificationCode('')
      refreshData()
    } else if (verifyEmailState.status === 'error') {
      toast.error(verifyEmailState.message)
    }
  }, [verifyEmailState])

  async function refreshData() {
    const data = await getAccountSettings()
    if (data) {
      setEmails(data.emails)
      setLinkedAccounts(data.linkedAccounts)
    }
  }

  async function handleSetPrimary(emailId: string) {
    try {
      await setPrimaryEmail(emailId)
      await refreshData()
      toast.success('Основной email изменён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    }
  }

  async function handleRemoveEmail(emailId: string) {
    if (!confirm('Удалить этот email?')) return
    try {
      await removeEmail(emailId)
      await refreshData()
      toast.success('Email удалён')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка')
    }
  }

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
    document.cookie = `cf_oauth_link=${providerId}; path=/; max-age=600; samesite=lax${window.location.protocol === 'https:' ? '; secure' : ''}`
    signIn(providerId, { redirectTo: '/profile/settings?linked=' + providerId })
  }

  return (
    <div className="space-y-8">
      {/* Email'ы */}
      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-black uppercase">Email&apos;ы</h2>
          <Button
            onClick={() => setShowAddEmail(true)}
            className="h-10 bg-cf-accent px-4 text-xs font-black uppercase text-white hover:bg-[#b01e1e]"
          >
            <Mail className="mr-2 h-4 w-4" />
            Добавить
          </Button>
        </div>

        <div className="space-y-2">
          {emails.map((email) => (
            <div
              key={email.id}
              className="flex items-center justify-between border border-cf-text-1/10 bg-cf-bg-2 p-4"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm text-cf-text-1">{email.email}</span>
                {email.is_primary && (
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cf-warm">
                    Основной
                  </span>
                )}
                {email.verified ? (
                  <CheckCircle className="h-4 w-4 text-green-500" />
                ) : (
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-cf-accent">
                    Не подтверждён
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {!email.verified && (
                  <Button
                    onClick={() => setVerifyingEmailId(email.id)}
                    className="h-8 border border-cf-text-1/18 px-3 text-xs font-bold uppercase text-cf-text-1 hover:bg-cf-text-1/8"
                  >
                    Подтвердить
                  </Button>
                )}
                {email.verified && !email.is_primary && (
                  <Button
                    onClick={() => handleSetPrimary(email.id)}
                    className="h-8 border border-cf-text-1/18 px-3 text-xs font-bold uppercase text-cf-text-1 hover:bg-cf-text-1/8"
                  >
                    Сделать основным
                  </Button>
                )}
                {!email.is_primary && (
                  <Button
                    onClick={() => handleRemoveEmail(email.id)}
                    className="h-8 border border-cf-text-1/15 px-3 text-xs font-bold uppercase text-cf-text-3 hover:border-cf-text-1/30 hover:text-cf-text-1"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Форма добавления email */}
        {showAddEmail && (
          <div className="mt-4 border border-cf-text-1/10 bg-cf-bg-2 p-4">
            <form action={addEmailAction} className="flex gap-3">
              <Input
                name="email"
                type="email"
                placeholder="new@email.com"
                required
                className="h-10 flex-1 border-cf-text-1/10 bg-cf-bg text-cf-text-1"
              />
              <Button
                type="submit"
                disabled={isAddingEmail}
                className="h-10 bg-cf-accent px-4 text-xs font-black uppercase text-white hover:bg-[#b01e1e]"
              >
                {isAddingEmail ? 'Отправка...' : 'Отправить код'}
              </Button>
              <Button
                type="button"
                onClick={() => setShowAddEmail(false)}
                className="h-10 border border-cf-text-1/18 px-4 text-xs font-bold uppercase text-cf-text-1 hover:bg-cf-text-1/8"
              >
                Отмена
              </Button>
            </form>
          </div>
        )}

        {/* Форма верификации */}
        {verifyingEmailId && (
          <div className="mt-4 border border-cf-text-1/10 bg-cf-bg-2 p-4">
            <form
              action={verifyEmailAction}
              className="flex gap-3"
            >
              <input type="hidden" name="emailId" value={verifyingEmailId} />
              <Input
                name="code"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value)}
                placeholder="6-значный код"
                required
                className="h-10 flex-1 border-cf-text-1/10 bg-cf-bg text-cf-text-1"
              />
              <Button
                type="submit"
                disabled={isVerifyingEmail}
                className="h-10 bg-cf-accent px-4 text-xs font-black uppercase text-white hover:bg-[#b01e1e]"
              >
                {isVerifyingEmail ? 'Проверка...' : 'Подтвердить'}
              </Button>
              <Button
                type="button"
                onClick={() => {
                  setVerifyingEmailId(null)
                  setVerificationCode('')
                }}
                className="h-10 border border-cf-text-1/18 px-4 text-xs font-bold uppercase text-cf-text-1 hover:bg-cf-text-1/8"
              >
                Отмена
              </Button>
            </form>
          </div>
        )}
      </section>

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
              Коды подтверждения отправляются на указанный email и действительны 15 минут.
              Вы можете привязать до 5 email&apos;ов и несколько внешних аккаунтов.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
