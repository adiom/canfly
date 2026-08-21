import Link from 'next/link'
import { fetchNewsPosts } from '@/lib/server/news'

export async function HomeNewsSection() {
  const news = await fetchNewsPosts(3)

  return (
    <section id="news" className="border-b border-cf-text-1/10 bg-cf-bg px-4 py-12 md:px-8 md:py-16">
      <div className="mx-auto grid max-w-7xl gap-10 lg:grid-cols-[0.7fr_1.3fr]">
        <div>
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">
            canfly dispatch
          </p>
          <h2 className="text-2xl font-black uppercase leading-none text-cf-text-heading sm:text-3xl md:text-5xl">
            Новости, заметки, маршруты
          </h2>
          <Link
            href="/news"
            className="mt-6 inline-block text-sm font-black uppercase tracking-[0.12em] text-cf-accent hover:text-[#a81919]"
          >
            Все новости →
          </Link>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {news.map((item) => (
            <article key={item.id} className="border-t border-cf-text-1/18 pt-5">
              <p className="mb-3 text-xs font-black uppercase tracking-[0.18em] text-cf-blue">
                {item.section}
              </p>
              <Link href={`/news/${item.slug}`} className="group">
                <h3 className="text-xl font-bold leading-tight text-cf-text-1 group-hover:text-cf-accent transition-colors">{item.title}</h3>
              </Link>
              <p className="mt-5 text-xs uppercase tracking-[0.14em] text-cf-text-4">{item.tag}</p>
              <Link
                href={`/news/${item.slug}`}
                className="mt-4 inline-block text-xs font-black uppercase tracking-[0.14em] text-cf-accent hover:text-[#a81919]"
              >
                Читать →
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
