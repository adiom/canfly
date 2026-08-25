import Image from 'next/image'
import Link from 'next/link'
import type { AuthorSeries, AuthorWork } from '@/lib/server/author-profile'
import type { SignatureTheme } from '@/lib/user-signature'
import type { NewsPost } from '@/lib/types'
import type { EditionFormat } from '@/lib/releases-types'

const FORMAT_LABELS: Record<EditionFormat, string> = {
  book: 'Книга',
  comic: 'Комикс',
  audiobook: 'Аудиокнига',
  audiorelease: 'Аудиорелиз',
  album: 'Альбом',
  magazine: 'Журнал',
  digital: 'Цифровой релиз',
}

function formatYear(date: string | null | undefined): string | null {
  if (!date) return null
  const year = new Date(date).getUTCFullYear()
  return Number.isNaN(year) ? null : String(year)
}

function SectionHeading({ label, meta }: { label: string; meta?: string }) {
  return (
    <header className="mb-6 flex items-baseline justify-between border-b border-cf-text-1/10 pb-3">
      <h2 className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent">{label}</h2>
      {meta && (
        <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">{meta}</span>
      )}
    </header>
  )
}

/**
 * Витрина автора: публичная страница превращается из читательской полки
 * в хронологическую библиографию работ. Корешок-полоса (signature-цвет)
 * на левом краю строки и порядковый номер — номер несёт информацию
 * (позиция в хронике публикаций), а не украшает.
 */
export function AuthorShowcase({
  works,
  series,
  latest,
  theme,
}: {
  works: AuthorWork[]
  series: AuthorSeries[]
  latest: NewsPost[]
  theme: SignatureTheme
}) {
  return (
    <div className="mx-auto max-w-5xl px-4 md:px-8">
      {/* ── Книги ─────────────────────────────────────────────────────── */}
      <section className="mt-16">
        <SectionHeading label="Книги" meta={`${works.length} ${works.length === 1 ? 'работа' : works.length < 5 ? 'работы' : 'работ'}`} />

        {works.length === 0 ? (
          <p className="border border-dashed border-cf-text-1/15 p-8 text-center text-cf-text-3">
            Ещё не опубликовано ни одной работы
          </p>
        ) : (
          <ol className="space-y-1">
            {works.map((work, index) => {
              const year = formatYear(work.release_date ?? work.created_at)
              const formats = work.formats?.filter(Boolean) ?? []
              const primaryFormat = formats[0]
              const formatLabel = primaryFormat ? FORMAT_LABELS[primaryFormat] : null

              return (
                <li key={work.id} className="group relative">
                  {/* Корешок: тянется из полосы в полноразмерный блок на hover */}
                  <div
                    aria-hidden
                    className="absolute inset-y-0 left-0 w-1 transition-all duration-300 group-hover:inset-y-1 group-hover:left-1 group-hover:w-1.5"
                    style={{ backgroundColor: theme.color.hex, opacity: 0.55 }}
                  />
                  <Link
                    href={`/release/${work.slug}`}
                    className="grid grid-cols-[auto_1fr] items-start gap-4 py-5 pl-5 md:gap-6 md:pl-6"
                  >
                    <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-4">
                      {String(index + 1).padStart(2, '0')}
                    </span>

                    <div className="grid grid-cols-[64px_1fr] gap-4 md:grid-cols-[88px_1fr] md:gap-6">
                      <div className="relative aspect-[2/3] overflow-hidden border border-cf-text-1/10 bg-cf-footer-bg">
                        {work.cover_image ? (
                          <Image
                            src={work.cover_image}
                            alt={work.title}
                            fill
                            sizes="(max-width: 640px) 64px, 88px"
                            className="object-cover"
                          />
                        ) : (
                          <span className="flex h-full items-center justify-center p-1 text-center text-[8px] font-black uppercase tracking-[0.14em] text-cf-text-4">
                            canfly
                          </span>
                        )}
                      </div>

                      <div className="min-w-0">
                        <h3 className="font-[family-name:var(--font-cormorant)] text-2xl font-light leading-tight text-cf-text-heading md:text-3xl">
                          {work.title}
                        </h3>
                        <p className="mt-1.5 font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-3">
                          {[formatLabel, work.genre, year].filter(Boolean).join(' · ')}
                        </p>
                        {work.annotation && (
                          <p className="mt-3 max-w-2xl font-[family-name:var(--font-ebgaramond)] text-base italic leading-relaxed text-cf-text-caption line-clamp-2">
                            {work.annotation}
                          </p>
                        )}
                        <span className="mt-3 inline-block font-mono text-[9px] uppercase tracking-[0.16em] text-cf-accent">
                          Читать →
                        </span>
                      </div>
                    </div>
                  </Link>
                </li>
              )
            })}
          </ol>
        )}
      </section>

      {/* ── Серии и издания ───────────────────────────────────────────── */}
      {series.length > 0 && (
        <section className="mt-16">
          <SectionHeading label="Серии и издания" meta={`${series.length} ${series.length === 1 ? 'серия' : series.length < 5 ? 'серии' : 'серий'}`} />
          <ul className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
            {series.map(s => (
              <li key={s.id}>
                <Link
                  href={`/series/${s.slug}`}
                  className="group flex items-baseline justify-between gap-4 py-4 transition-colors hover:bg-cf-text-1/[0.03]"
                >
                  <div className="min-w-0">
                    <span className="font-[family-name:var(--font-cormorant)] text-xl italic leading-snug text-cf-text-heading group-hover:text-cf-text-1">
                      {s.title}
                    </span>
                    {s.description && (
                      <p className="mt-0.5 line-clamp-1 text-xs text-cf-text-3">{s.description}</p>
                    )}
                  </div>
                  <span className="shrink-0 font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-4">
                    {s.release_count} {s.release_count === 1 ? 'том' : s.release_count < 5 ? 'тома' : 'томов'}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Последнее ─────────────────────────────────────────────────── */}
      {latest.length > 0 && (
        <section className="mt-16">
          <SectionHeading label="Последнее" />
          <ul className="space-y-3">
            {latest.map(post => (
              <li key={post.id}>
                <Link
                  href={`/news/${post.slug}`}
                  className="group block border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-colors hover:border-cf-warm/45"
                >
                  <span className="font-[family-name:var(--font-cormorant)] text-lg italic leading-snug text-cf-text-heading group-hover:text-cf-text-1">
                    {post.title}
                  </span>
                  <span className="mt-1 block font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-4">
                    {post.section}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
