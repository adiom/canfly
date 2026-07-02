import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Settings } from 'lucide-react'
import { getCurrentUser } from '@/lib/server/session'
import { getAccountSettings } from '@/lib/actions/account-settings'
import { AccountSettingsClient } from '@/components/account-settings-client'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Настройки аккаунта | canfly',
  description: 'Управление email адресами и привязанными внешними аккаунтами.',
  robots: { index: false, follow: false },
}

export default async function ProfileSettingsPage() {
  const user = await getCurrentUser()
  if (!user) redirect('/login')

  const settings = await getAccountSettings()

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <header className="border-b border-cf-text-1/10 bg-cf-bg/95 sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
            canfly
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/profile" className="text-xs font-black uppercase tracking-[0.18em] text-cf-text-2 hover:text-cf-text-heading transition-colors">
              Профиль
            </Link>
            <Link href="/characters" className="text-xs font-black uppercase tracking-[0.18em] text-cf-text-2 hover:text-cf-text-heading transition-colors">
              Персонажи
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-16">
        <div className="mb-8 flex items-center gap-4">
          <Settings className="h-6 w-6 text-cf-warm" />
          <h1 className="text-3xl font-black uppercase md:text-4xl">Настройки аккаунта</h1>
        </div>

        <AccountSettingsClient
          initialEmails={settings?.emails ?? []}
          initialLinkedAccounts={settings?.linkedAccounts ?? []}
        />
      </section>
    </main>
  )
}
