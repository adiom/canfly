import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Settings, UserRound } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Button } from '@/components/ui/button'
import { fetchReaderProfileSummary } from '@/lib/server/users'
import { getCurrentUser } from '@/lib/server/session'
import {
  fetchCoreWeeks,
  fetchShelf,
  fetchPublicQuotes,
} from '@/lib/server/user-profile'
import { signatureTheme } from '@/lib/user-signature'

import { SignatureBand } from '@/components/user/signature-band'
import { ProfileIdentity } from '@/components/user/profile-identity'
import { ReadingShelf } from '@/components/user/reading-shelf'
import { CoreSample } from '@/components/user/core-sample'
import { VoicesList } from '@/components/user/voices-list'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Мой профиль | canfly',
  description: 'Запись в каталоге canfly: цветовой паспорт, разрез чтения, вынесенные на свет цитаты.',
  robots: { index: false },
}

export default async function UserDashboardPage() {
  const session = await getCurrentUser()
  if (!session) redirect('/login?redirect=/user')

  const theme = signatureTheme(session)
  const [summary, shelf, weeks, publicQuotes] = await Promise.all([
    fetchReaderProfileSummary(session.id),
    fetchShelf(session.id, 6),
    fetchCoreWeeks(session.id),
    fetchPublicQuotes(session.id, 8),
  ])

  const memberSince = new Date(session.created_at).toISOString().slice(0, 10)

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/user" />

      <SignatureBand theme={theme} caption="Главный кадр" />

      <div className="pb-12 pt-10 md:pb-16">
        <ProfileIdentity
          user={{
            display_name: session.display_name,
            handle: session.handle ?? session.id,
            tagline: session.tagline,
            bio: session.bio,
            avatar: session.avatar,
            created_at: memberSince,
          }}
          theme={theme}
          publicRole={session.public_role}
          actions={
            <>
              <Link href={`/user/${session.handle ?? session.id}`}>
                <Button
                  variant="outline"
                  className="border-cf-text-1/15 text-cf-text-2 hover:border-cf-text-1/30 hover:text-cf-text-1"
                >
                  <UserRound className="mr-2 h-4 w-4" />
                  Моя публичная
                </Button>
              </Link>
              <Link href="/user-settings">
                <Button className="bg-cf-accent text-white hover:bg-[#b81e1e]">
                  <Settings className="mr-2 h-4 w-4" />
                  Настройки
                </Button>
              </Link>
            </>
          }
        />

        <section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
          <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
            <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
              Читает сейчас
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
              {shelf.length} изд.
            </span>
          </header>
          <ReadingShelf items={shelf} progressColor={theme.color.hex} />
        </section>

        <section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
          <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
            <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
              Керн · разрез чтения
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
              {summary.highlights.length} цитат · 52 недели
            </span>
          </header>
          <CoreSample weeks={weeks} theme={theme} />
        </section>

        <section className="mx-auto mt-16 grid max-w-7xl gap-12 px-4 md:grid-cols-2 md:px-8">
          <div>
            <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
              <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
                Вынесено на свет
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
                {publicQuotes.length}
              </span>
            </header>
            {publicQuotes.length === 0 ? (
              <p className="text-cf-text-3">Выдели что-нибудь в тексте — это будет видно тут.</p>
            ) : (
              <ul className="space-y-3">
                {publicQuotes.map(quote => (
                  <li
                    key={quote.id}
                    className="border border-cf-text-1/10 bg-cf-bg-2 p-4 font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-1"
                  >
                    «{quote.text}»
                    <p className="mt-2 font-mono text-[9px] not-italic uppercase tracking-[0.2em] text-cf-text-4">
                      {quote.release_slug}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
              <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
                Голоса
              </h2>
              <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
                {summary.conversations.length}
              </span>
            </header>
            <VoicesList voices={summary.conversations} />
          </div>
        </section>
      </div>

      <SiteFooter variant="simple" />
    </main>
  )
}
