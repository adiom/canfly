import type { Metadata } from 'next'
import Link from 'next/link'
import Image from 'next/image'
import { fetchAllSeriesWithStats } from '@/lib/server/series'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { JsonLd } from '@/components/seo/json-ld'
import { generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata } from '@/lib/seo/metadata'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export async function generateMetadata(): Promise<Metadata> {
  return buildMetadata({
    title: 'Все серии | canfly',
    description:
      'Серии книг, комиксов и аудиокниг вселенной canfly — связанные истории, которые читаются одна за другой.',
    path: '/series',
  })
}

export default async function SeriesListPage() {
  const series = await fetchAllSeriesWithStats()

  const breadcrumbs = [
    { label: 'canfly', url: '/' },
    { label: 'Серии', url: '/series' },
  ]

  return (
    <>
      <JsonLd
        schemas={[
          generateBreadcrumbSchema(
            breadcrumbs.map(item => ({
              label: item.label,
              url: `${BASE_URL}${item.url}`,
            })),
          ),
        ]}
      />
      <main className="min-h-screen bg-cf-bg text-cf-text-1">
        <SiteHeader activePath="/series" />
        <div className="mx-auto max-w-7xl px-4 pt-4 md:px-8">
          <Breadcrumbs items={breadcrumbs} />
        </div>

        <div className="mx-auto max-w-7xl px-4 md:px-8">
          <header className="pt-10 pb-6 md:pt-16 md:pb-8">
            <p className="mb-3 font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">
              библиотека
            </p>
            <h1 className="text-sm font-black uppercase leading-none">
              Серии
            </h1>
            <p className="mt-4 max-w-2xl leading-7 text-cf-text-caption">
              Связанные истории вселенной canfly — каждая серия это цикл книг,
              комиксов или аудиокниг, объединённых общим миром и героями.
            </p>
          </header>

          {series.length > 0 ? (
            <section className="pb-4">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {series.map(s => (
                  <Link
                    key={s.id}
                    href={`/series/${s.slug}`}
                    className="group flex gap-4 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-all hover:border-cf-warm/45"
                  >
                    <div className="relative h-24 w-16 shrink-0 overflow-hidden rounded">
                      {s.cover_image ? (
                        <Image
                          src={s.cover_image}
                          alt={s.title}
                          fill
                          sizes="64px"
                          className="object-cover group-hover:opacity-90"
                        />
                      ) : (
                        <div className="h-full w-full bg-cf-text-1/10 flex items-center justify-center">
                          <span className="text-[10px] text-cf-text-3">нет обложки</span>
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0">
                      <h2 className="text-lg font-black text-cf-text-heading group-hover:text-cf-warm transition-colors">
                        {s.title}
                      </h2>
                      {s.description && (
                        <p className="mt-1 line-clamp-2 text-sm text-cf-text-caption">
                          {s.description}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-cf-text-3">
                        {s.release_count} {s.release_count === 1 ? 'релиз' : s.release_count < 5 ? 'релиза' : 'релизов'}
                      </p>
                    </div>

                    <div className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded border border-cf-text-1/10 bg-cf-bg text-cf-text-2 group-hover:border-cf-accent group-hover:text-cf-accent transition-colors">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="18"
                        height="18"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M5 12h14"></path>
                        <path d="m12 5 7 7-7 7"></path>
                      </svg>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : (
            <div className="py-24 text-center">
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cf-text-3">
                Серий пока нет
              </p>
              <p className="mt-3 text-sm text-cf-text-4">
                Здесь будут 수집аться связанные циклы релизов.
              </p>
            </div>
          )}
        </div>

        <SiteFooter variant="simple" />
      </main>
    </>
  )
}
