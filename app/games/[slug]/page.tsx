import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Gamepad2 } from 'lucide-react'

import { Breadcrumbs } from '@/components/breadcrumbs'
import { GameEmbed } from '@/components/game-embed'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { fetchGameCharacters, fetchGameReleases, fetchPublishedGameBySlug } from '@/lib/server/games'

interface GamePageProps {
  params: Promise<{ slug: string }>
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

  return (
    <main className="relative mx-auto w-full max-w-3xl px-6 pb-32">
      <div className="pt-4">
        <Breadcrumbs
          items={[
            { label: 'canfly', url: '/' },
            { label: 'Игры', url: '/games' },
            { label: game.title, url: `/games/${game.slug}` },
          ]}
        />
      </div>

      <section className="cf-rise flex flex-col items-center pt-16 md:pt-20">
        <div className="relative h-32 w-56 overflow-hidden rounded-3xl border-4 border-white/80 bg-gradient-to-br from-violet-100/80 via-rose-50/60 to-amber-50/40 shadow-lg shadow-black/10">
          {game.cover_image ? (
            <Image
              src={game.cover_image}
              alt={game.title}
              fill
              sizes="224px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <Gamepad2 className="h-14 w-14 text-violet-300" />
            </div>
          )}
        </div>

        <h1 className="mt-6 text-center text-[34px] font-light leading-tight tracking-tight text-cf-text-heading md:text-[40px]">
          {game.title}
        </h1>

        <p className="mt-3 text-[13px] text-cf-text-3">Игра canfly</p>

        {game.tagline ? (
          <p className="mt-6 max-w-md text-center text-[15px] leading-relaxed text-cf-text-caption">
            {game.tagline}
          </p>
        ) : null}
      </section>

      <GameEmbed slug={game.slug} title={game.title} aspectRatio={game.aspect_ratio} />

      {game.description ? (
        <section className="cf-rise-late mt-16">
          <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
            Об игре
          </h2>
          <div className="cf-glass-2 whitespace-pre-line rounded-3xl p-6 text-[15px] leading-relaxed text-cf-text-2">
            {game.description}
          </div>
        </section>
      ) : null}

      {characters.length > 0 ? (
        <section className="cf-rise-late mt-16">
          <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
            Кто в игре
          </h2>
          <ul className="cf-glass-2 space-y-3 rounded-3xl p-5">
            {characters.map(character => (
              <li key={character.character_id}>
                <Link
                  href={`/characters/${character.character_slug}`}
                  className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-cf-air-surface"
                >
                  <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-xl bg-cf-air-surface-2">
                    {character.character_avatar ? (
                      <Image
                        src={character.character_avatar}
                        alt={character.character_name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center text-sm font-bold text-violet-400">
                        {character.character_name.charAt(0)}
                      </span>
                    )}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[15px] leading-tight text-cf-text-heading transition-colors group-hover:text-violet-700">
                    {character.character_name}
                  </span>
                  <span
                    aria-hidden
                    className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cf-text-2"
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
        <section className="cf-rise-late mt-16">
          <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
            Связанные релизы
          </h2>
          <ul className="cf-glass-2 space-y-3 rounded-3xl p-5">
            {releases.map(release => (
              <li key={release.release_id}>
                <Link
                  href={`/release/${release.release_slug}`}
                  className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-cf-air-surface"
                >
                  <span
                    aria-hidden
                    className="h-1.5 w-1.5 shrink-0 rounded-full bg-cf-air-accent shadow-[0_0_8px_rgba(106,154,184,0.45)]"
                  />
                  <span className="min-w-0 flex-1 truncate text-[15px] leading-tight text-cf-text-heading">
                    {release.release_title}
                  </span>
                  <span
                    aria-hidden
                    className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cf-text-2"
                  >
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-24 text-center">
        <Link
          href="/games"
          className="text-[11px] uppercase tracking-[0.28em] text-cf-text-4 transition-colors hover:text-cf-text-heading"
        >
          все игры
        </Link>
      </div>
    </main>
  )
}
