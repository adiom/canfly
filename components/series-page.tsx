import Link from 'next/link'
import Image from 'next/image'
import { SiteHeader } from '@/components/site-header'
import { SiteFooter } from '@/components/site-footer'
import type { SeriesRelease } from '@/lib/server/series'

interface SeriesPageProps {
  series: {
    id: string
    title: string
    slug: string
    description: string | null
    created_at: string
    updated_at: string
  }
  releases: SeriesRelease[]
}

function formatDate(date: string | null): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export function SeriesPage({ series, releases }: SeriesPageProps) {
  const firstRelease = releases.find(r => r.phase_number === 1) ?? releases[0]
  const lastRelease = releases[releases.length - 1]

  const phaseLabel = (phase: number | null) =>
    phase !== null ? `Том ${phase}` : ''

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath={`/series/${series.slug}`} />

      <div className="mx-auto max-w-7xl px-4 md:px-8 py-12 space-y-10">
        <header className="space-y-6">
          <div>
            <p className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">
              Серия · {releases.length} релиз{releases.length === 1 ? 'а' : 'ов'}
            </p>
            <h1 className="font-[family-name:var(--font-cormorant)] text-4xl font-black uppercase leading-tight text-cf-text-heading md:text-5xl lg:text-6xl">
              {series.title}
            </h1>
          </div>

          {series.description && (
            <p className="max-w-2xl text-lg italic leading-relaxed text-cf-text-caption">
              {series.description}
            </p>
          )}

          <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-cf-text-3">
            {firstRelease && (
              <span>
                Первый том: {formatDate(firstRelease.release_date)}
                {firstRelease.phase_number !== null && ` — Том ${firstRelease.phase_number}`}
              </span>
            )}
            {lastRelease && releases.length > 1 && (
              <span>
                Последний том: {formatDate(lastRelease.release_date)}
                {lastRelease.phase_number !== null && ` — Том ${lastRelease.phase_number}`}
              </span>
            )}
          </div>
        </header>

        {releases.length === 0 ? (
          <div className="text-center py-16 text-cf-text-3">
            <p>В серии пока нет опубликованных релизов.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {releases.map(release => {
              const phase = phaseLabel(release.phase_number)
              const isFirst = release.phase_number === 1

              return (
                <Link
                  key={release.id}
                  href={`/release/${release.slug}`}
                  className={`
                    group flex items-start gap-4 rounded-xl border border-cf-text-1/10
                    bg-cf-bg-2 p-4 transition-all
                    hover:border-cf-warm/45 hover:bg-cf-bg-2
                    ${isFirst ? 'border-l-4 border-cf-accent' : ''}
                  `}
                >
                  <div className="relative h-20 w-14 shrink-0 overflow-hidden rounded">
                    {release.cover_image ? (
                      <Image
                        src={release.cover_image}
                        alt={release.title}
                        fill
                        sizes="56px"
                        className="object-cover group-hover:opacity-90"
                      />
                    ) : (
                      <div className="h-full w-full bg-cf-text-1/10 flex items-center justify-center">
                        <span className="text-[10px] text-cf-text-3">нет обложки</span>
                      </div>
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs font-black uppercase tracking-[0.12em] text-cf-accent">
                        {phase || 'без номера'}
                      </span>
                      
                    </div>
                    <h3 className="mt-0.5 text-lg font-black text-cf-text-heading group-hover:text-cf-warm transition-colors">
                      {release.title}
                    </h3>
                    {release.release_date && (
                      <p className="mt-1 text-sm text-cf-text-3">
                        {formatDate(release.release_date)}
                      </p>
                    )}
                    {release.annotation && (
                      <p className="mt-1.5 line-clamp-2 text-sm text-cf-text-caption">
                        {release.annotation}
                      </p>
                    )}
                  </div>

                  <div className="ml-auto flex h-12 w-12 shrink-0 items-center justify-center rounded border border-cf-text-1/10 bg-cf-bg text-cf-text-2 group-hover:border-cf-accent group-hover:text-cf-accent transition-colors">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="20"
                      height="20"
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
              )
            })}
          </div>
        )}
      </div>

      <SiteFooter variant="simple" />
    </main>
  )
}
