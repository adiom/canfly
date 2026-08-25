import { redirect } from 'next/navigation'
import Link from 'next/link'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { AccountSettingsClient } from '@/components/account-settings-client'
import { getAccountSettings } from '@/lib/actions/account-settings'
import { getCurrentUser } from '@/lib/server/session'
import { signatureTheme } from '@/lib/user-signature'

import { UserSettingsClient } from './settings-client'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Настройки профиля | canfly',
  robots: { index: false },
}

export default async function UserSettingsPage() {
  const session = await getCurrentUser()
  if (!session) redirect('/login?redirect=/user-settings')

  const [account, theme] = await Promise.all([getAccountSettings(), Promise.resolve(signatureTheme(session))])

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/user-settings" />

      <div className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <header className="mb-12 border-b border-cf-text-1/10 pb-6">
          <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">Личный кабинет</p>
          <h1 className="mt-2 text-3xl font-black uppercase leading-none text-cf-text-heading md:text-4xl">
            Настройки
          </h1>
          <p className="mt-3 max-w-2xl text-cf-text-3">
            Что увидишь справа — то увидят другие на твоей публичной странице. Изменения видны сразу.
          </p>
        </header>

        <div className="grid gap-12 lg:grid-cols-[260px_1fr_minmax(280px,360px)]">
          <nav className="sticky top-20 self-start font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
            <ul className="space-y-3">
              <li><a href="#identity" className="hover:text-cf-accent">Личность</a></li>
              <li><a href="#passport" className="hover:text-cf-accent">Паспорт</a></li>
              <li><a href="#visibility" className="hover:text-cf-accent">Видимость</a></li>
              <li><a href="#access" className="hover:text-cf-accent">Доступ</a></li>
              <li className="pt-4"><Link href="/user" className="text-cf-text-4 hover:text-cf-accent">← в профиль</Link></li>
            </ul>
          </nav>

          <div className="space-y-12">
            <UserSettingsClient user={session} theme={theme} />
              <section id="access" className="border-t border-cf-text-1/10 pt-8">
                <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
                  Доступ · привязки
                </h2>
                <div className="mt-6">
                  {account ? (
                    <AccountSettingsClient
                      initialLinkedAccounts={account.linkedAccounts}
                    />
                  ) : (
                    <p className="text-cf-text-3">Не удалось загрузить</p>
                  )}
                </div>
              </section>
          </div>

          <aside className="space-y-4 self-start">
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
              Как тебя видят
            </p>
            <div
              className="aspect-[3/4] w-full border border-cf-text-1/10 bg-cf-bg-2 p-6"
              style={{ borderColor: `${theme.color.hex}55` }}
            >
              <div className="flex h-full flex-col">
                <div
                  className="h-12 w-full"
                  style={{ backgroundColor: theme.color.hex }}
                />
                <p className="mt-6 font-[family-name:var(--font-cormorant)] text-2xl italic leading-tight text-cf-text-heading">
                  {session.display_name.toLowerCase()}
                </p>
                <p className="font-mono text-xs text-cf-text-3">@{session.handle ?? session.id}</p>
                {session.tagline && (
                  <p className="mt-2 text-sm italic text-cf-text-caption">{session.tagline}</p>
                )}
              </div>
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter variant="simple" />
    </main>
  )
}