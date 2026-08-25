import Image from 'next/image'
import Link from 'next/link'
import type { Release, EditionFormat } from '@/lib/releases-types'

interface ReleaseCardBookmateProps {
  release: Release & { formats: EditionFormat[] }
  priority?: boolean
}

const FORMAT_LABELS: Partial<Record<EditionFormat, string>> = {
  book: 'Книга',
  comic: 'Комикс',
  audiobook: 'Аудио',
  audiorelease: 'Аудио',
  album: 'Альбом',
  magazine: 'Журнал',
}

export function ReleaseCardBookmate({ release, priority = false }: ReleaseCardBookmateProps) {
  const authorName = release.authors?.[0]?.name ?? null
  const primaryFormat = release.formats[0] ?? null
  const formatLabel = primaryFormat ? FORMAT_LABELS[primaryFormat] : null

  return (
    <Link
      href={`/release/${release.slug}`}
      className="group block transition-transform duration-200 hover:-translate-y-1"
    >
      <div className="relative w-full aspect-[3/4] bg-cf-bg-2 overflow-hidden ring-1 ring-cf-text-1/8 transition-all group-hover:ring-2 group-hover:ring-cf-warm/45">
        {release.cover_image ? (
          <Image
            src={release.cover_image}
            alt={release.title}
            fill
            sizes="(min-width:1024px) 240px, (min-width:640px) 33vw, 50vw"
            className="object-cover"
            priority={priority}
          />
        ) : (
          <div className="flex h-full items-center justify-center">
            <span className="text-sm font-black uppercase tracking-[-0.04em] text-cf-text-4">
              canfly
            </span>
          </div>
        )}
        {formatLabel && (
          <span className="absolute left-2 top-2 bg-cf-bg/85 px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.18em] text-cf-warm backdrop-blur-sm">
            {formatLabel}
          </span>
        )}
      </div>
      {authorName && (
        <p className="mt-2 text-sm leading-5 text-cf-text-3 truncate">
          {authorName}
        </p>
      )}
      <p className="text-sm font-bold leading-5 text-cf-text-heading line-clamp-2 group-hover:text-cf-accent transition-colors">
        {release.title}
      </p>
    </Link>
  )
}
