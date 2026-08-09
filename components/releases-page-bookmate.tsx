import Link from 'next/link'
import type { EditionFormat } from '@/lib/releases-types'
import { ReleaseCardBookmate } from '@/components/release-card-bookmate'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Pagination } from '@/components/ui/pagination'
import type { ReleasesPage } from '@/lib/server/releases'
import { cn } from '@/lib/utils'

type CategoryValue = EditionFormat | 'all'

const CATEGORY_PILLS: { label: string; value: CategoryValue }[] = [
  { label: 'Всё', value: 'all' },
  { label: 'Комиксы', value: 'comic' },
  { label: 'Книги', value: 'book' },
  { label: 'Аудиокниги', value: 'audiobook' },
  { label: 'Журналы', value: 'magazine' },
  { label: 'Альбомы', value: 'album' },
  { label: 'Цифровые', value: 'digital' },
]

interface ReleasesPageBookmateProps {
  data: ReleasesPage
  category: CategoryValue
  page: number
}

function categoryHref(value: CategoryValue) {
  const params = new URLSearchParams()
  if (value !== 'all') params.set('category', value)
  return params.toString() ? `/releases?${params}` : '/releases'
}

export function ReleasesPageBookmate({
  data,
  category,
  page,
}: ReleasesPageBookmateProps) {
  const { items, total, totalPages } = data
  const from = total === 0 ? 0 : (page - 1) * 24 + 1
  const to = Math.min(page * 24, total)

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/releases" />

      <div className="mx-auto max-w-7xl px-4 md:px-8">
        <header className="pt-10 pb-6 md:pt-16 md:pb-8">
          <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">
            каталог
          </p>
          <h1 className="text-4xl font-black uppercase leading-none text-cf-text-heading md:text-6xl">
            Релизы
          </h1>
          <p className="mt-4 max-w-2xl leading-7 text-cf-text-caption">
            Комиксы, книги, аудиокниги и альбомы вселенной canfly — единая
            библиотека релизов.
          </p>
        </header>

        <nav className="flex flex-wrap gap-2 border-b border-cf-text-1/10 pb-5">
          {CATEGORY_PILLS.map((pill) => {
            const active = category === pill.value
            return (
              <Link
                key={pill.value}
                href={categoryHref(pill.value)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'h-9 px-4 inline-flex items-center text-sm font-bold uppercase tracking-[0.1em] transition-colors',
                  active
                    ? 'bg-cf-accent text-white'
                    : 'bg-cf-text-1/6 text-cf-text-2 hover:bg-cf-text-1/12 hover:text-cf-text-heading',
                )}
              >
                {pill.label}
              </Link>
            )
          })}
        </nav>

        {items.length > 0 ? (
          <>
            <div className="flex items-center justify-between py-5">
              <p className="text-xs font-mono uppercase tracking-[0.14em] text-cf-text-3">
                {from}–{to} из {total}
              </p>
            </div>

            <section className="pb-4">
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 lg:gap-x-5">
                {items.map((r, i) => (
                  <div
                    key={r.id}
                    className="relative pb-4 border-b border-cf-text-1/10"
                  >
                    <span className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-gradient-to-t from-cf-text-1/8 to-transparent" />
                    <ReleaseCardBookmate release={r} priority={i < 4} />
                  </div>
                ))}
              </div>
            </section>

            <div className="flex justify-center py-10">
              <Pagination
                page={page}
                totalPages={totalPages}
                basePath="/releases"
                query={{ category: category !== 'all' ? category : undefined }}
              />
            </div>
          </>
        ) : (
          <div className="py-24 text-center">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-cf-text-3">
              Ничего не найдено
            </p>
            <p className="mt-3 text-sm text-cf-text-4">
              В этой категории пока нет релизов.
            </p>
          </div>
        )}
      </div>

      <SiteFooter variant="simple" />
    </main>
  )
}
