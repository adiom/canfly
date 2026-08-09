import Link from 'next/link'

import type { CharacterReleaseLink } from '@/lib/server/releases'

interface CharacterReleasesSectionProps {
  /** Все релизы с участием персонажа (отфильтрованные по статусу). */
  releases: CharacterReleaseLink[]
}

const ROLE_LABEL: Record<CharacterReleaseLink['role'], string> = {
  main: 'главный герой',
  supporting: 'второстепенный',
  cameo: 'камео',
}

/**
 * Низ страницы персонажа: релизы, в которых он главный герой (или участник).
 *
 * Главные вынесены выше и крупнее, остальные — компактным списком ниже.
 * Это перекликается с принципом orbital «состояние вместо нумерации»:
 * блок говорит не «сколько», а «как именно» персонаж связан с релизом.
 * Если main-ролей нет — секция не рендерится.
 */
export function CharacterReleasesSection({ releases }: CharacterReleasesSectionProps) {
  const mains = releases.filter((rel) => rel.role === 'main')
  const others = releases.filter((rel) => rel.role !== 'main')

  if (mains.length === 0) return null

  return (
    <section id="releases" className="scroll-mt-24">
      <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
        Главный герой
      </h2>

      <ul className="cf-glass-2 space-y-3 rounded-3xl p-5">
        {mains.map((rel) => (
          <li key={rel.release_id}>
            <ReleaseRow release={rel} />
          </li>
        ))}
      </ul>

      {others.length > 0 ? (
        <div className="mt-10">
          <h3 className="mb-4 text-[10px] uppercase tracking-[0.2em] text-cf-text-3">
            Также появляется
          </h3>
          <ul className="flex flex-wrap gap-2">
            {others.map((rel) => (
              <li key={rel.release_id}>
                <Link
                  href={`/release/${rel.release_slug}`}
                  className="inline-flex items-center gap-2 rounded-full bg-cf-air-surface px-4 py-2 text-[13px] text-cf-text-2 backdrop-blur-xl transition-colors duration-300 hover:bg-cf-air-surface-2"
                >
                  <span className="text-[9px] uppercase tracking-[0.2em] text-cf-text-4">
                    {ROLE_LABEL[rel.role]}
                  </span>
                  <span>{rel.release_title}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  )
}

function ReleaseRow({ release }: { release: CharacterReleaseLink }) {
  const path = release.series_slug
    ? `/series/${release.series_slug}`
    : `/release/${release.release_slug}`

  return (
    <Link
      href={path}
      className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-cf-air-surface"
    >
      <span
        aria-hidden
        className="h-1.5 w-1.5 shrink-0 rounded-full bg-cf-air-accent shadow-[0_0_8px_rgba(106,154,184,0.45)]"
      />

      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] leading-tight text-cf-text-heading">
          {release.release_title}
        </p>
        <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-cf-text-3">
          {release.series_slug ? 'часть серии' : 'отдельный релиз'}
        </p>
      </div>

      <span
        aria-hidden
        className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cf-text-2"
      >
        →
      </span>
    </Link>
  )
}
