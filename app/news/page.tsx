import Link from 'next/link'
import Image from 'next/image'
import { ChevronLeft } from 'lucide-react'

import { fetchNewsPosts } from '@/lib/server/news'
import { ThemeToggle } from '@/components/theme-toggle'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Новости | canfly',
  description: 'Новости, заметки и маршруты из вселенной canfly.',
  openGraph: {
    title: 'Новости | canfly',
    description: 'Новости, заметки и маршруты из вселенной canfly.',
    url: `${BASE_URL}/news`,
    type: 'website',
    locale: 'ru_RU',
    siteName: 'canfly',
  },
  alternates: { canonical: `${BASE_URL}/news` },
}

export default async function NewsPage() {
  const news = await fetchNewsPosts(100)

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <header className="sticky top-0 z-50 border-b border-cf-text-1/10 bg-cf-bg/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 hover:text-cf-text-heading">
            <ChevronLeft className="h-4 w-4" />
            На главную
          </Link>
          <h1 className="text-lg font-black uppercase tracking-[0.12em] text-cf-text-heading">Новости</h1>
          <ThemeToggle />
        </div>
      </header>

      <section className="border-b border-cf-text-1/10 px-4 py-12 md:px-8 md:py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-12">
            <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">
              canfly dispatch
            </p>
            <h2 className="text-4xl font-black uppercase leading-none text-cf-text-heading md:text-5xl">
              Новости, заметки, маршруты
            </h2>
          </div>

          {news.length > 0 ? (
            <div className="space-y-8">
              {news.map((item) => {
                const date = item.published_at ?? item.created_at
                return (
                  <article
                    key={item.id}
                    className="border-b border-cf-text-1/10 pb-8 last:border-b-0"
                  >
                    <div className="mb-3 flex items-center gap-3">
                      <span className="text-xs font-black uppercase tracking-[0.18em] text-cf-accent">
                        {item.section}
                      </span>
                      {item.tag && (
                        <span className="text-xs uppercase tracking-[0.14em] text-cf-text-4">
                          {item.tag}
                        </span>
                      )}
                    </div>
                    <Link href={`/news/${item.id}`} className="group block">
                      {item.cover_image && (
                        <div className="relative mb-4 h-48 w-full overflow-hidden border border-cf-text-1/10 sm:h-64">
                          <Image
                            src={item.cover_image}
                            alt={item.title}
                            fill
                            sizes="(max-width: 768px) 100vw, 768px"
                            className="object-cover transition-transform duration-500 group-hover:scale-[1.02]"
                          />
                        </div>
                      )}
                      <h3 className="mb-4 text-2xl font-bold leading-tight text-cf-text-1 group-hover:text-cf-accent transition-colors">
                        {item.title}
                      </h3>
                    </Link>
                    {item.content && (
                      <p className="leading-7 text-cf-text-caption line-clamp-3">
                        {item.content.replace(/<[^>]+>/g, '').slice(0, 300)}
                        {item.content.length > 300 ? '…' : ''}
                      </p>
                    )}
                    <p className="mt-4 text-xs uppercase tracking-[0.14em] text-cf-text-4">
                      {new Date(date).toLocaleDateString('ru-RU', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </p>
                  </article>
                )
              })}
            </div>
          ) : (
            <div className="rounded border border-cf-text-1/10 bg-cf-bg-2 px-6 py-8 text-center text-cf-text-caption">
              Новостей пока нет
            </div>
          )}
        </div>
      </section>

      <footer className="border-t border-cf-text-1/10 bg-cf-footer-bg px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl text-center text-sm text-cf-text-4">
          © 2005-2026 canfly | культура твоего сознания.
        </div>
      </footer>
    </main>
  )
}
