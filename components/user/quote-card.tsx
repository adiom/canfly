import Link from 'next/link'
import type { ProfileQuote } from '@/lib/server/user-profile'

const DATE = new Intl.DateTimeFormat('ru-RU', { day: '2-digit', month: '2-digit', year: 'numeric' })

export function QuoteCard({
  quote,
  action,
}: {
  quote: ProfileQuote
  /** Переключатель публичности — только в приватном виде */
  action?: React.ReactNode
}) {
  const body = (
    <>
      <p className="font-[family-name:var(--font-cormorant)] text-lg italic leading-8 text-cf-text-1 md:text-xl">
        «{quote.text_content}»
      </p>
      {quote.note && <p className="mt-3 text-sm text-cf-text-3">{quote.note}</p>}
      <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
        {quote.chapter_title && <span>{quote.chapter_title}</span>}
        <span>{DATE.format(new Date(quote.created_at))}</span>
        {quote.likes_count > 0 && <span className="text-cf-accent">♥ {quote.likes_count}</span>}
      </div>
    </>
  )

  return (
    <article className="border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-colors hover:border-cf-warm/45 sm:p-6">
      {quote.release_slug ? (
        <Link href={`/release/${quote.release_slug}`} className="block">
          {body}
        </Link>
      ) : (
        body
      )}
      {action && <div className="mt-4 border-t border-cf-text-1/10 pt-3">{action}</div>}
    </article>
  )
}
