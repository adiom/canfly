import { requireStudioSession } from '@/lib/server/studio-auth'
import { getMyNews } from '@/lib/actions/studio-news'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { Plus, ExternalLink } from 'lucide-react'
import type { NewsPost } from '@/lib/types'

export const dynamic = 'force-dynamic'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  draft: { label: 'Черновик', className: 'text-cf-text-3 border-cf-text-1/20' },
  published: { label: 'Опубликована', className: 'text-cf-warm border-cf-warm/40' },
  archived: { label: 'Архив', className: 'text-cf-text-4 border-cf-text-1/15' },
}

function NewsRow({ news }: { news: NewsPost }) {
  const status = STATUS_CONFIG[news.status] ?? STATUS_CONFIG.draft
  const date = news.published_at ?? news.updated_at

  return (
    <div className="group flex items-center gap-4 py-4 px-1 transition-colors duration-200 hover:bg-cf-text-1/[0.03]">
      <Link href={`/studio/news/${news.id}`} className="flex-shrink-0">
        <div className="relative h-16 w-16 overflow-hidden border border-cf-text-1/10 bg-cf-footer-bg transition-colors group-hover:border-cf-warm/40">
          {news.cover_image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={news.cover_image} alt={news.title} className="h-full w-full object-cover" />
          ) : (
            <div className="flex h-full items-center justify-center">
              <span className="text-[7px] font-black uppercase tracking-[0.1em] text-cf-text-4">cf</span>
            </div>
          )}
        </div>
      </Link>

      <Link href={`/studio/news/${news.id}`} className="flex min-w-0 flex-1 flex-col gap-1">
        <h3 className="truncate text-sm font-black uppercase leading-none tracking-[0.04em] text-cf-text-heading transition-colors group-hover:text-cf-accent">
          {news.title}
        </h3>
        <p className="font-mono text-[10px] uppercase tracking-[0.12em] text-cf-text-3">
          {news.section}
          {news.tag && ` · ${news.tag}`}
          {date && ` · ${new Date(date).toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' })}`}
        </p>
      </Link>

      <div className="flex flex-shrink-0 items-center gap-2">
        <span className={`border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] ${status.className}`}>
          {status.label}
        </span>
        {news.status === 'published' && (
          <a
            href={`/news/${news.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-7 w-7 items-center justify-center border border-cf-text-1/10 text-cf-text-3 transition-colors hover:border-cf-text-1/30 hover:text-cf-text-1"
          >
            <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
    </div>
  )
}

export default async function StudioNewsPage() {
  const session = await requireStudioSession()
  if (!session) redirect('/login')

  const news = await getMyNews()

  const drafts = news.filter((n) => n.status === 'draft')
  const published = news.filter((n) => n.status === 'published')
  const archived = news.filter((n) => n.status === 'archived')

  return (
    <div className="min-h-screen bg-cf-bg">
      <div className="mx-auto max-w-4xl px-4 py-10 md:px-8 md:py-14">
        <div className="mb-10 flex items-start justify-between border-b border-cf-text-1/10 pb-8">
          <div>
            <p className="mb-2 font-mono text-[9px] uppercase tracking-[0.22em] text-cf-accent">
              Все новости
            </p>
            <h1 className="font-[family-name:var(--font-cormorant)] text-5xl font-bold italic leading-[0.9] text-cf-text-heading md:text-6xl">
              Новости
            </h1>
            <Link
              href="/studio"
              className="mt-3 inline-block text-xs font-black uppercase tracking-[0.12em] text-cf-text-3 hover:text-cf-text-1 transition-colors"
            >
              ← К Studio
            </Link>
          </div>
          <Link
            href="/studio/new"
            className="inline-flex h-11 items-center gap-2 bg-cf-accent px-5 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
          >
            <Plus className="h-4 w-4" />
            Новый
          </Link>
        </div>

        {news.length === 0 ? (
          <div className="flex flex-col items-center justify-center border border-dashed border-cf-text-1/10 py-20">
            <span className="flex h-12 w-20 items-center justify-center bg-cf-accent text-sm font-black uppercase tracking-[-0.04em] text-white">
              canfly
            </span>
            <p className="mt-6 text-sm font-black uppercase tracking-[0.12em] text-cf-text-2">
              Пока нет новостей
            </p>
            <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-3">
              Создайте первую
            </p>
            <Link
              href="/studio/new"
              className="mt-6 inline-flex h-11 items-center gap-2 bg-cf-accent px-6 text-sm font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e]"
            >
              <Plus className="h-4 w-4" />
              Создать новость
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
                  {drafts.map((n) => (
                    <NewsRow key={n.id} news={n} />
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
                  {published.map((n) => (
                    <NewsRow key={n.id} news={n} />
                  ))}
                </div>
              </section>
            )}

            {archived.length > 0 && (
              <section className={published.length > 0 ? 'mt-8' : ''}>
                <p className="mb-1 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-3">
                  Архив — {archived.length}
                </p>
                <div className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
                  {archived.map((n) => (
                    <NewsRow key={n.id} news={n} />
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