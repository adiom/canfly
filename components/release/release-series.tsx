import Image from 'next/image'
import Link from 'next/link'
import { BookOpen, ChevronRight } from 'lucide-react'
import type { Series } from '@/lib/releases-types'
import type { OtherSeriesRelease } from './types'

export function ReleaseSeries({
  series,
  releases,
}: {
  series: Series
  releases: OtherSeriesRelease[]
}) {
  if (releases.length === 0) return null

  return (
    <section className="border-t border-cf-text-1/10">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <div className="mb-6">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
            серия
          </p>
          <Link
            href={`/series/${series.slug}`}
            className="mt-1 inline-flex items-center gap-1 text-lg font-bold text-cf-text-heading transition-colors hover:text-cf-warm"
          >
            {series.title}
            <ChevronRight className="h-4 w-4 opacity-40" />
          </Link>
          {series.description && (
            <p className="mt-2 max-w-2xl text-sm text-cf-text-caption">{series.description}</p>
          )}
        </div>

        <div className="space-y-3">
          {releases.map(release => (
            <Link
              key={release.id}
              href={`/release/${release.slug}`}
              className="group flex items-start gap-4 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-all hover:border-cf-warm/45"
            >
              <div className="relative h-16 w-12 shrink-0 overflow-hidden rounded bg-cf-text-1/8">
                {release.cover_image ? (
                  <Image
                    src={release.cover_image}
                    alt={release.title}
                    fill
                    sizes="48px"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <BookOpen className="h-4 w-4 text-cf-text-3 opacity-30" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                {release.phase_number !== null && (
                  <span className="text-xs font-black uppercase tracking-[0.12em] text-cf-accent">
                    Том {release.phase_number}
                  </span>
                )}
                <h3 className="mt-0.5 truncate text-base font-bold text-cf-text-heading transition-colors group-hover:text-cf-warm">
                  {release.title}
                </h3>
                {release.annotation && (
                  <p className="mt-1 line-clamp-1 text-xs text-cf-text-3">{release.annotation}</p>
                )}
              </div>
              <div className="ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded border border-cf-text-1/10 bg-cf-bg text-cf-text-2 transition-colors group-hover:border-cf-accent group-hover:text-cf-accent">
                <ChevronRight className="h-4 w-4" />
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
