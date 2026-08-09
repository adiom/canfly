import Link from 'next/link'
import Image from 'next/image'
import type { ShelfItem } from '@/lib/server/user-profile'
import { getChapterUrl } from '@/lib/utils/editions'
import { CATALOG_PATH } from '@/lib/nav'

const CHAPTER_LABELS: Record<string, string> = {
  book: 'Глава',
  comic: 'Глава',
  magazine: 'Статья',
  audiobook: 'Трек',
  audiorelease: 'Трек',
  album: 'Трек',
}

export function ReadingShelf({ items, progressColor }: { items: ShelfItem[]; progressColor?: string }) {
  if (items.length === 0) {
    return (
      <div className="border border-dashed border-cf-text-1/15 p-8 text-center">
        <p className="text-cf-text-3">Полка пуста</p>
        <Link
          href={CATALOG_PATH}
          className="mt-3 inline-block font-mono text-[9px] uppercase tracking-[0.2em] text-cf-accent hover:underline"
        >
          Выбрать, с чего начать
        </Link>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-cf-text-1/10 border-y border-cf-text-1/10">
      {items.map(item => {
        const label = CHAPTER_LABELS[item.format] ?? 'Глава'
        const percent = Math.round(item.progress_percent)
        return (
          <li key={item.edition_id}>
            <Link
              href={getChapterUrl(item.release_slug, { ...item, slug: item.edition_slug }, item.chapter_number)}
              className="group flex items-center gap-4 py-4 transition-colors hover:bg-cf-text-1/[0.03]"
            >
              {item.cover_image ? (
                <Image
                  src={item.cover_image}
                  alt=""
                  width={40}
                  height={56}
                  className="h-14 w-10 shrink-0 object-cover"
                />
              ) : (
                <span className="h-14 w-10 shrink-0 bg-cf-text-1/8" />
              )}

              <span className="min-w-0 flex-1">
                <span className="block truncate text-cf-text-1 group-hover:text-cf-text-heading">
                  {item.release_title}
                </span>
                <span className="mt-0.5 block truncate font-mono text-[9px] uppercase tracking-[0.18em] text-cf-text-4">
                  {label} {item.chapter_number} · {item.chapter_title}
                </span>
              </span>

              <span className="flex shrink-0 items-center gap-3">
                <span className="hidden h-1 w-24 bg-cf-text-1/10 sm:block">
                  <span
                    className="block h-full"
                    style={{ width: `${percent}%`, backgroundColor: progressColor ?? 'var(--cf-accent)' }}
                  />
                </span>
                <span className="w-9 text-right font-mono text-[10px] tabular-nums text-cf-text-3">
                  {percent}%
                </span>
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
