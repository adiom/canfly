'use client'

import { useState } from 'react'
import type { Release, EditionFormat } from '@/lib/releases-types'
import { ReleaseCard } from '@/components/release-card'

type ReleaseWithFormats = Release & { formats: EditionFormat[] }

interface ScrollRowProps {
  title: string
  releases: ReleaseWithFormats[]
}

function ScrollRow({ title, releases }: ScrollRowProps) {
  if (releases.length === 0) return null

  return (
    <section className="py-8 border-b border-cf-text-1/10">
      <h2 className="mb-4 text-xs font-black uppercase tracking-[0.18em] text-cf-text-2">
        {title}
      </h2>
      <div className="flex gap-4 overflow-x-auto pb-2 [&::-webkit-scrollbar]:hidden snap-x snap-mandatory">
        {releases.map((r) => (
          <div key={r.id} className="w-36 flex-shrink-0 snap-start sm:w-44">
            <ReleaseCard release={r} />
          </div>
        ))}
      </div>
    </section>
  )
}

const FILTER_TABS: { label: string; value: EditionFormat | 'all' }[] = [
  { label: 'Все', value: 'all' },
  { label: 'Комиксы', value: 'comic' },
  { label: 'Книги', value: 'book' },
  { label: 'Аудио', value: 'audiobook' },
  { label: 'Журналы', value: 'magazine' },
  { label: 'Цифровые', value: 'digital' },
]

interface ReleaseCatalogProps {
  releases: ReleaseWithFormats[]
}

export function ReleaseCatalog({ releases }: ReleaseCatalogProps) {
  const [activeTab, setActiveTab] = useState<EditionFormat | 'all'>('all')

  const comics = releases.filter((r) => r.formats.includes('comic'))
  const books = releases.filter((r) => r.formats.includes('book'))
  const audio = releases.filter((r) =>
    r.formats.some((f) => f === 'audiobook' || f === 'audiorelease'),
  )

  const filtered =
    activeTab === 'all'
      ? releases
      : activeTab === 'audiobook'
        ? releases.filter((r) => r.formats.some((f) => f === 'audiobook' || f === 'audiorelease'))
        : releases.filter((r) => r.formats.includes(activeTab as EditionFormat))

  return (
    <>
      <ScrollRow title="Комиксы" releases={comics} />
      <ScrollRow title="Книги" releases={books} />
      <ScrollRow title="Аудио" releases={audio} />

      <section className="py-12">
        <div className="mb-6 flex items-center gap-1 border-b border-cf-text-1/10 overflow-x-auto [&::-webkit-scrollbar]:hidden">
          {FILTER_TABS.map((tab) => (
            <button
              key={tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`flex-shrink-0 h-10 px-4 text-xs font-black uppercase tracking-[0.12em] transition-colors border-b-2 -mb-px ${
                activeTab === tab.value
                  ? 'border-cf-accent text-cf-text-heading'
                  : 'border-transparent text-cf-text-3 hover:text-cf-text-2'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {filtered.length > 0 ? (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
            {filtered.map((r, i) => (
              <ReleaseCard key={r.id} release={r} index={i} />
            ))}
          </div>
        ) : (
          <div className="py-16 text-center text-cf-text-3">Ничего не найдено</div>
        )}
      </section>
    </>
  )
}
