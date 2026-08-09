import Link from 'next/link'
import type { Metadata } from 'next'

import { SiteFooter } from '@/components/site-footer'
import { VvvvvSpreadDemo } from '@/components/vvvvv/vvvvv-spread-demo'
import { CANFLY_COLORS } from '@/lib/canfly-colors'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const VOID_COLOR = CANFLY_COLORS.find(color => color.id === 'CF-004')

export const metadata: Metadata = {
  title: 'VVVVV — литературная среда | canfly',
  description:
    'Интернет научился публиковать тексты, но так и не научился их читать. VVVVV — пространство, где текст снова становится местом, а не контентом.',
  openGraph: {
    title: 'VVVVV — литературная среда | canfly',
    description:
      'Пространство, где текст снова становится местом, а не контентом. Дом для литературных миров canfly.',
    url: `${BASE_URL}/vvvvv`,
    siteName: 'canfly',
    locale: 'ru_RU',
    type: 'website',
  },
  twitter: { card: 'summary_large_image' },
  alternates: { canonical: `${BASE_URL}/vvvvv` },
}

/** Три параллельных превращения — не последовательность, поэтому без нумерации. */
const LOSSES = [
  { was: 'Текст', became: 'контент' },
  { was: 'Книга', became: 'карточка' },
  { was: 'Мир', became: 'ссылка' },
]

const VOCABULARY = [
  'литературная среда',
  'пространство для чтения',
  'дом для литературных миров',
]

const label = 'font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--vv-ink-3)]'

export default function VvvvvLandingPage() {
  return (
    <div className="dark vvvvv-scope min-h-screen bg-[var(--vv-void)] text-[var(--vv-ink)]">
      <header className="mx-auto flex max-w-[1200px] items-center justify-between px-6 py-7 md:px-10">
        <p
          className="font-[family-name:var(--font-cormorant)] text-lg tracking-[0.42em]"
          style={{ color: 'var(--vv-ink)' }}
        >
          VVVVV
        </p>
        <Link
          href="/"
          className="font-mono text-[10px] uppercase tracking-[0.24em] text-[var(--vv-ink-3)] transition-colors hover:text-[var(--vv-ochre)] focus-visible:outline focus-visible:outline-1 focus-visible:outline-offset-4 focus-visible:outline-[var(--vv-ochre)]"
        >
          canfly
        </Link>
      </header>

      {/* Герой: страница тратит пространство почти ни на что — это и есть аргумент */}
      <section className="mx-auto flex min-h-[78vh] max-w-[1200px] flex-col justify-center px-6 py-24 md:px-10">
        <h1
          className="vv-rise font-[family-name:var(--font-cormorant)] text-[clamp(3.5rem,13vw,11rem)] leading-[0.85] tracking-[0.06em]"
          style={{ color: 'var(--vv-ink)' }}
        >
          VVVVV
        </h1>
        <p
          className="vv-rise mt-14 max-w-2xl font-[family-name:var(--font-ebgaramond)] text-xl leading-[1.7] md:text-2xl"
          style={{ color: 'var(--vv-ink-2)', '--vv-delay': '220ms' } as React.CSSProperties}
        >
          Интернет научился публиковать тексты.
          <br />
          Но так и не научился их читать.
        </p>
      </section>

      {/* Утрата исполнена типографикой: слева антиква, справа усохшая форма */}
      <section
        aria-label="Что случилось с текстом"
        className="mx-auto max-w-[1200px] px-6 pb-32 md:px-10"
      >
        <p className={label}>что произошло</p>
        <dl className="mt-10 border-t border-[var(--vv-rule)]">
          {LOSSES.map(loss => (
            <div
              key={loss.was}
              className="flex items-baseline justify-between gap-6 border-b border-[var(--vv-rule)] py-7"
            >
              <dt
                className="font-[family-name:var(--font-cormorant)] text-4xl leading-none md:text-6xl"
                style={{ color: 'var(--vv-ink)' }}
              >
                {loss.was}
              </dt>
              <dd
                className="font-mono text-xs lowercase tracking-[0.18em]"
                style={{ color: 'var(--vv-ink-3)' }}
              >
                {loss.became}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-32 md:px-10">
        <p className={label}>присутствие</p>
        <h2
          className="mt-10 max-w-3xl font-[family-name:var(--font-cormorant)] text-3xl leading-[1.15] md:text-5xl"
          style={{ color: 'var(--vv-ink)' }}
        >
          Современный интернет решил проблему публикации. Но не решил проблему присутствия.
        </h2>
        <div
          className="mt-12 max-w-xl space-y-6 font-[family-name:var(--font-ebgaramond)] text-lg leading-[1.75]"
          style={{ color: 'var(--vv-ink-2)' }}
        >
          <p>
            Большинство цифровых платформ превращают текст в поток. Литература работает иначе.
            Литература требует пространства, времени и внимания.
          </p>
          <p>
            VVVVV был создан как место, где текст снова становится местом, а не контентом.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-[1200px] px-6 pb-32 md:px-10">
        <p className={label}>чем это является</p>
        <ul className="mt-10 space-y-4">
          {VOCABULARY.map(term => (
            <li
              key={term}
              className="font-[family-name:var(--font-cormorant)] text-2xl md:text-4xl"
              style={{ color: 'var(--vv-ink)' }}
            >
              {term}
            </li>
          ))}
        </ul>
        <p
          className="mt-12 max-w-lg font-[family-name:var(--font-ebgaramond)] text-base leading-[1.75]"
          style={{ color: 'var(--vv-ink-3)' }}
        >
          Тьма этой страницы называется {VOID_COLOR?.id ?? 'CF-004'} — {VOID_COLOR?.fullName ?? 'before the first photon'}.
        </p>
      </section>

      {/* Сигнатура: не рассказ о среде, а сама среда */}
      <section className="mx-auto max-w-[1200px] px-6 pb-24 md:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <p className={label}>войдите в текст</p>
          <p className={label}>← → листать</p>
        </div>
        <div className="mt-10">
          <VvvvvSpreadDemo />
        </div>
      </section>

      <SiteFooter variant="simple" />
    </div>
  )
}
