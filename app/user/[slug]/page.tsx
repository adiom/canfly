import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { UserRound } from 'lucide-react'

import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { Button } from '@/components/ui/button'
import { fetchChapterHighlights } from '@/lib/server/chapter-highlights'
import {
  fetchShelf,
  fetchCoreWeeks,
  fetchUserByHandle,
  fetchUserSocialLinks,
} from '@/lib/server/user-profile'
import {
  fetchPublicAuthorWorks,
  fetchAuthorSeries,
  fetchAuthorLatest,
} from '@/lib/server/author-profile'
import { getCurrentUser, getSystemRoles } from '@/lib/server/session'
import { signatureTheme } from '@/lib/user-signature'
import type { ShelfItem } from '@/lib/server/user-profile'

import { SignatureBand } from '@/components/user/signature-band'
import { ProfileIdentity } from '@/components/user/profile-identity'
import { ReadingShelf } from '@/components/user/reading-shelf'
import { CoreSample } from '@/components/user/core-sample'
import { AuthorShowcase } from '@/components/user/author-showcase'
import {
  generateProfilePageSchema,
  generateAuthorProfileSchema,
} from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'

export const dynamic = 'force-dynamic'

interface PublicPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: PublicPageProps) {
  const { slug } = await params
  const user = await fetchUserByHandle(slug)
  if (!user) return notFoundMetadata()

  const [viewer, systemRoles] = await Promise.all([getCurrentUser(), getSystemRoles(user.id)])
  const isOwner = viewer?.id === user.id

  // Editor публичного профиля не имеет: страницу видит только владелец,
  // чужим — 404, поисковикам — noindex.
  if (systemRoles.includes('editor') && !isOwner) {
    return notFoundMetadata('Профиль не публичный')
  }

  const isAuthor = user.public_role === 'author'
  const indexable = isAuthor && user.profile_is_public && systemRoles.length === 0

  const description =
    user.tagline ??
    user.bio ??
    (isAuthor ? 'Автор на canfly' : 'Профиль читателя canfly.')

  return buildMetadata({
    title: isAuthor
      ? `${user.display_name} — писатель | canfly`
      : `${user.display_name} (@${user.handle}) | canfly`,
    description,
    path: `/user/${user.handle}`,
    // og:image — из opengraph-image.tsx рядом.
    generatedImage: true,
    ogType: 'profile',
    // Закрытый профиль, reader-витрина и editor-страница не должны попадать в индекс.
    noindex: !indexable,
  })
}

export default async function PublicProfilePage({ params }: PublicPageProps) {
  const { slug } = await params
  const user = await fetchUserByHandle(slug)
  if (!user) notFound()

  // Канонический URL: иначе /user/Adiom и /user/adiom отдавали бы разные страницы
  if (user.handle !== slug) redirect(`/user/${user.handle}`)

  const [viewer, systemRoles] = await Promise.all([getCurrentUser(), getSystemRoles(user.id)])
  const isOwner = viewer?.id === user.id
  const isPublic = user.profile_is_public || isOwner

  if (!isPublic) notFound()

  // Editor публичного профиля не получает: только владелец видит свою страницу.
  if (systemRoles.includes('editor') && !isOwner) notFound()

  const theme = signatureTheme(user)
  const socialLinks = await fetchUserSocialLinks(user.id)

  const isAuthor = user.public_role === 'author'

  // ── Author: витрина творчества ──────────────────────────────────────
  if (isAuthor) {
    const [works, series, latest] = await Promise.all([
      fetchPublicAuthorWorks(user.id),
      fetchAuthorSeries(user.id),
      fetchAuthorLatest(user.id),
    ])

    const authorSchema = generateAuthorProfileSchema(user, works, socialLinks)

    return (
      <main className="min-h-screen bg-cf-bg text-cf-text-1">
        <JsonLd schemas={[authorSchema]} />
        <SiteHeader activePath="/characters" />
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
          <Breadcrumbs items={[
            { label: 'canfly', url: '/' },
            { label: `@${user.handle}`, url: `/user/${user.handle}` },
          ]} />
        </div>

        <SignatureBand theme={theme} caption={`Автор · @${user.handle}`} />

        <div className="pb-12 pt-10 md:pb-16">
          <ProfileIdentity
            user={{
              display_name: user.display_name,
              handle: user.handle,
              tagline: user.tagline,
              bio: user.bio,
              avatar: user.avatar,
              created_at: user.created_at,
            }}
            theme={theme}
            publicRole={user.public_role}
            socialLinks={socialLinks}
            actions={
              isOwner ? (
                <Link href="/user">
                  <Button variant="outline" className="border-cf-text-1/15 text-cf-text-2">
                    <UserRound className="mr-2 h-4 w-4" />
                    Вернуться в свой профиль
                  </Button>
                </Link>
              ) : undefined
            }
          />

          <AuthorShowcase works={works} series={series} latest={latest} theme={theme} />
        </div>

        <SiteFooter variant="simple" />
      </main>
    )
  }

  // ── Reader: читательский мир ────────────────────────────────────────
  const [quotes, shelf, weeks] = isPublic
    ? await Promise.all([
        fetchChapterHighlights({
          userId: user.id,
          publicOnly: true,
          currentUserId: viewer?.id ?? null,
          limit: 24,
        }),
        user.show_reading && !isOwner ? fetchShelf(user.id, 6) : Promise.resolve([] as ShelfItem[]),
        user.show_reading ? fetchCoreWeeks(user.id) : Promise.resolve([]),
      ])
    : [[], [] as ShelfItem[], []]

  const publicQuotes = quotes
    .filter(quote => quote.is_public)
    .map(quote => ({
      id: quote.id,
      text: quote.text_content,
      release_slug: quote.release_slug,
      chapter_title: quote.chapter_title,
      created_at: quote.created_at,
    }))

  const profileSchema = generateProfilePageSchema(user, { quotes: publicQuotes.length }, socialLinks)

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <JsonLd schemas={[profileSchema]} />
      <SiteHeader activePath="/characters" />
      <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
        <Breadcrumbs items={[
          { label: 'canfly', url: '/' },
          { label: `@${user.handle}`, url: `/user/${user.handle}` },
        ]} />
      </div>

      <SignatureBand theme={theme} caption={`Читатель · @${user.handle}`} />

      <div className="pb-12 pt-10 md:pb-16">
        <ProfileIdentity
          user={{
            display_name: user.display_name,
            handle: user.handle,
            tagline: user.tagline,
            bio: user.bio,
            avatar: user.avatar,
            created_at: user.created_at,
          }}
          theme={theme}
          publicRole={user.public_role}
          socialLinks={socialLinks}
          actions={
            isOwner ? (
              <Link href="/user">
                <Button variant="outline" className="border-cf-text-1/15 text-cf-text-2">
                  <UserRound className="mr-2 h-4 w-4" />
                  Вернуться в свой профиль
                </Button>
              </Link>
            ) : undefined
          }
        />

        {user.show_reading && (
          <>
            {shelf.length > 0 && (
              <section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
                <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
                  <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
                    Читает
                  </h2>
                </header>
                <ReadingShelf items={shelf} progressColor={theme.color.hex} />
              </section>
            )}

            <section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
              <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
                <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
                  Керн · разрез чтения
                </h2>
                <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
                  {publicQuotes.length} цитат · 52 недели
                </span>
              </header>
              <CoreSample weeks={weeks} theme={theme} />
            </section>
          </>
        )}

        <section className="mx-auto mt-16 max-w-7xl px-4 md:px-8">
          <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
            <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
              Вынесено на свет
            </h2>
            <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
              {publicQuotes.length}
            </span>
          </header>
          {publicQuotes.length === 0 ? (
            <p className="text-cf-text-3">Пока нет публичных цитат.</p>
          ) : (
            <ul className="space-y-3">
              {publicQuotes.map(quote => (
                <li
                  key={quote.id}
                  className="border border-cf-text-1/10 bg-cf-bg-2 p-4 font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-1"
                >
                  «{quote.text}»
                  {quote.chapter_title && (
                    <p className="mt-2 font-mono text-[9px] not-italic uppercase tracking-[0.2em] text-cf-text-4">
                      «{quote.chapter_title}»
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <SiteFooter variant="simple" />
    </main>
  )
}
