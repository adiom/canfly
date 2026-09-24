import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { ArrowLeft, Gamepad2 } from 'lucide-react'

import { Breadcrumbs } from '@/components/breadcrumbs'
import { GameEmbed } from '@/components/game-embed'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { fetchGameCharacters, fetchGameReleases, fetchPublishedGameBySlug } from '@/lib/server/games'
import { cn } from '@/lib/utils'
import type { GameAspectRatio } from '@/lib/releases-types'

interface GamePageProps {
  params: Promise<{ slug: string }>
}

/**
 * Ширина кабинета следует за кадром: горизонтальная игра занимает всю колонку,
 * вертикальная упирается в ширину. Без этого 9:16 разворачивалось бы в стену
 * высотой с экран — предмет задаёт габарит, а не страница.
 *
 * `plate` — раскладка шильдика: в широком кабинете метаданные встают в одну
 * строку с названием, в узком (квадрат, вертикаль) они уходят под него, иначе
 * заголовок сжимается в колонку шириной в слово.
 */
const WIDE_PLATE = 'sm:flex-row sm:items-start sm:gap-x-5'

const CABINET: Record<GameAspectRatio, { width: string; plate: string }> = {
  '16:9': { width: '', plate: WIDE_PLATE },
  '4:3': { width: 'mx-auto w-full max-w-3xl', plate: WIDE_PLATE },
  '1:1': { width: 'mx-auto w-full max-w-2xl', plate: '' },
  '9:16': { width: 'mx-auto w-full max-w-md', plate: '' },
}

async function getGameData(slug: string) {
  try {
    return await fetchPublishedGameBySlug(slug)
  } catch (error) {
    console.error('Error fetching game:', error)
    return null
  }
}

export async function generateMetadata({ params }: GamePageProps) {
  const { slug } = await params
  const game = await getGameData(slug)
  if (!game) return notFoundMetadata('Игра не найдена')

  return buildMetadata({
    title: `${game.title} — canfly | культура твоего сознания`,
    description:
      game.tagline ?? game.description ?? `Игра вселенной canfly — ${game.title}.`,
    path: `/games/${game.slug}`,
    generatedImage: true,
    ogType: 'website',
  })
}

export default async function GamePage({ params }: GamePageProps) {
  const { slug } = await params
  const game = await getGameData(slug)
  if (!game) notFound()

  const [characters, releases] = await Promise.all([
    fetchGameCharacters(game.id),
    fetchGameReleases(game.id),
  ])

  const hasAside = characters.length > 0 || releases.length > 0
  const hasBand = Boolean(game.description) || hasAside

  return (
    <main className="relative mx-auto w-full max-w-5xl px-5 pb-28 pt-6 md:px-6">
      <Breadcrumbs
        items={[
          { label: 'canfly', url: '/' },
          { label: 'Игры', url: '/games' },
          { label: game.title, url: `/games/${game.slug}` },
        ]}
      />

      <article
        aria-labelledby="game-title"
        className={cn('cf-rise mt-9 md:mt-12', CABINET[game.aspect_ratio].width)}
      >
        {/* Марки: шильдик автомата. Бумага и волосяные линии — голос архива,
            моноширинные метки — голос самой машины. */}
        <header
          className={cn(
            'flex flex-col gap-4 border-y border-cf-text-1/10 py-5',
            CABINET[game.aspect_ratio].plate,
          )}
        >
          <div className="flex min-w-0 flex-1 items-start gap-4 sm:gap-5">
            <span className="relative hidden h-11 w-[72px] shrink-0 overflow-hidden rounded-[3px] border border-cf-text-1/10 bg-cf-bg-2 sm:block">
              {game.cover_image ? (
                <Image src={game.cover_image} alt="" fill sizes="72px" className="object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center">
                  <Gamepad2 aria-hidden className="h-4 w-4 text-cf-text-4" />
                </span>
              )}
            </span>

            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.3em] text-cf-text-3">
                canfly · игра
              </p>
              <h1
                id="game-title"
                className="mt-2 text-[26px] font-light leading-[1.15] tracking-tight text-cf-text-heading md:text-[32px]"
              >
                {game.title}
              </h1>
              {game.tagline ? (
                <p className="mt-2 max-w-prose text-[14px] leading-relaxed text-cf-text-3">
                  {game.tagline}
                </p>
              ) : null}
            </div>
          </div>

          <dl className="flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.24em] sm:ml-auto sm:shrink-0">
            <div className="flex items-center gap-2">
              <span aria-hidden className="cf-live-pulse h-1.5 w-1.5 rounded-full bg-cf-live-on" />
              <dt className="sr-only">Статус</dt>
              <dd className="text-cf-text-3">можно играть</dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-cf-text-3">кадр</dt>
              <dd className="text-cf-text-2">{game.aspect_ratio}</dd>
            </div>
          </dl>
        </header>

        <GameEmbed slug={game.slug} title={game.title} aspectRatio={game.aspect_ratio} />
      </article>

      {hasBand ? (
        <div
          className={cn(
            'cf-rise-late mt-14 grid gap-12',
            hasAside && game.description
              ? 'lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-16'
              : null,
          )}
        >
          {game.description ? (
            <section>
              <h2 className="text-[12px] uppercase tracking-[0.28em] text-cf-text-3">Об игре</h2>
              <p className="mt-5 whitespace-pre-line text-[15px] leading-[1.75] text-cf-text-2">
                {game.description}
              </p>
            </section>
          ) : null}

          {hasAside ? (
            <div className="space-y-12">
              {characters.length > 0 ? (
                <section>
                  <h2 className="text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
                    Кто в игре
                  </h2>
                  <ul className="mt-4 border-t border-cf-text-1/10">
                    {characters.map(character => (
                      <li key={character.character_id} className="border-b border-cf-text-1/10">
                        <Link
                          href={`/characters/${character.character_slug}`}
                          className="group flex items-center gap-4 py-3"
                        >
                          <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-xl bg-cf-bg-2">
                            {character.character_avatar ? (
                              <Image
                                src={character.character_avatar}
                                alt=""
                                fill
                                sizes="36px"
                                className="object-cover"
                              />
                            ) : (
                              <span className="flex h-full w-full items-center justify-center text-[13px] font-bold text-cf-air-accent-ink">
                                {character.character_name.charAt(0)}
                              </span>
                            )}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[15px] leading-tight text-cf-text-heading transition-colors group-hover:text-cf-air-accent-ink">
                            {character.character_name}
                          </span>
                          <span
                            aria-hidden
                            className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-cf-text-2"
                          >
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}

              {releases.length > 0 ? (
                <section>
                  <h2 className="text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
                    Связанные релизы
                  </h2>
                  <ul className="mt-4 border-t border-cf-text-1/10">
                    {releases.map(release => (
                      <li key={release.release_id} className="border-b border-cf-text-1/10">
                        <Link
                          href={`/release/${release.release_slug}`}
                          className="group flex items-center gap-4 py-3"
                        >
                          <span
                            aria-hidden
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-cf-air-accent"
                          />
                          <span className="min-w-0 flex-1 truncate text-[15px] leading-tight text-cf-text-heading transition-colors group-hover:text-cf-air-accent-ink">
                            {release.release_title}
                          </span>
                          <span
                            aria-hidden
                            className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-cf-text-2"
                          >
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="mt-16 border-t border-cf-text-1/10 pt-6">
        <Link
          href="/games"
          className="group inline-flex items-center gap-2 rounded-sm font-mono text-[10px] uppercase tracking-[0.3em] text-cf-text-3 transition-colors hover:text-cf-text-heading focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-cf-air-accent-ink"
        >
          <ArrowLeft
            aria-hidden
            className="h-3.5 w-3.5 transition-transform duration-300 group-hover:-translate-x-0.5"
          />
          все игры
        </Link>
      </div>
    </main>
  )
}
