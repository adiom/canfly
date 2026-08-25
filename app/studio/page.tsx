import Link from 'next/link'
import { getMyReleasesWithEditions } from '@/lib/actions/studio'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { ReleaseCard } from '@/components/studio/release-card'
import { Plus, Newspaper } from 'lucide-react'

export default async function StudioDashboard() {
  const session = await requireStudioSession()
  const isAdmin = session?.isAdmin ?? false
  const releases = await getMyReleasesWithEditions()

  const published = releases.filter((r) => r.status === 'published')
  const drafts = releases.filter((r) => r.status === 'draft')
  const totalViews = releases.reduce((sum, r) => sum + r.view_count, 0)

  return (
    <div className="min-h-screen bg-cf-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">

        {/* Header */}
        <div className="mb-10 flex items-start justify-between border-b border-cf-text-1/10 pb-8">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">
              {isAdmin ? 'Все релизы' : 'Мои релизы'}
            </p>
            <h1 className="font-[family-name:var(--font-cormorant)] text-5xl font-bold italic leading-[0.9] text-cf-text-heading md:text-6xl">
              Студия
            </h1>
          </div>
          <Link
            href="/studio/new"
            className="inline-flex h-11 items-center gap-2 bg-cf-accent px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
          >
            <Plus className="h-4 w-4" />
            Новый
          </Link>
        </div>

        {/* Stats */}
        {releases.length > 0 && (
          <div className="mb-10 grid grid-cols-3 divide-x divide-cf-text-1/10 border border-cf-text-1/10">
            {[
              { value: releases.length, label: 'Релизов' },
              { value: published.length, label: 'Опубликовано' },
              { value: totalViews.toLocaleString('ru-RU'), label: 'Просмотров' },
            ].map(({ value, label }) => (
              <div key={label} className="flex flex-col items-center py-6">
                <span className="font-[family-name:var(--font-cormorant)] text-5xl font-bold leading-none text-cf-text-heading md:text-6xl">
                  {value}
                </span>
                <span className="mt-2 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
                  {label}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Quick nav */}
        <div className="mb-10 flex gap-3">
          <Link
            href="/studio/news"
            className="inline-flex h-11 items-center gap-2 border border-cf-text-1/12 bg-cf-bg-2 px-4 text-xs font-black uppercase tracking-[0.08em] text-cf-text-2 transition-colors hover:border-cf-warm/45 hover:text-cf-text-heading"
          >
            <Newspaper className="h-4 w-4" />
            Новости
          </Link>
        </div>

        {/* Release list */}
        {releases.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-cf-text-1/10 py-20">
            <span className="flex h-12 w-20 items-center justify-center bg-cf-accent text-sm font-black uppercase tracking-[-0.04em] text-white">
              canfly
            </span>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-cf-text-2">
              Пока нет релизов
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-3">
              Создайте первый
            </p>
            <Link
              href="/studio/new"
              className="mt-6 inline-flex h-11 items-center gap-2 bg-cf-accent px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
            >
              <Plus className="h-4 w-4" />
              Создать релиз
            </Link>
          </div>
        ) : (
          <div>
            {drafts.length > 0 && (
              <section className="mb-2">
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
                  В работе — {drafts.length}
                </p>
                <div className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
                  {drafts.map((r) => (
                    <ReleaseCard key={r.id} release={r} />
                  ))}
                </div>
              </section>
            )}

            {published.length > 0 && (
              <section className={drafts.length > 0 ? 'mt-8' : ''}>
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
                  Опубликовано — {published.length}
                </p>
                <div className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
                  {published.map((r) => (
                    <ReleaseCard key={r.id} release={r} />
                  ))}
                </div>
              </section>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
