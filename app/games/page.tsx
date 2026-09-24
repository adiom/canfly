import { Suspense } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { Gamepad2 } from 'lucide-react'

import { Breadcrumbs } from '@/components/breadcrumbs'
import { JsonLd } from '@/components/seo/json-ld'
import { generateCollectionSchema } from '@/lib/seo/schema'
import { buildMetadata } from '@/lib/seo/metadata'
import { fetchPublishedGames } from '@/lib/server/games'
import type { Game } from '@/lib/releases-types'

export const revalidate = 300

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const GAMES_DESCRIPTION =
  'Небольшие веб-игры вселенной canfly — про персонажей, места и правила этого мира. Играются прямо в браузере.'

export const metadata = buildMetadata({
  title: 'Игры | canfly — культура твоего сознания',
  description: GAMES_DESCRIPTION,
  path: '/games',
  // Навигационный хаб без уникального контента: не конкурирует с карточками
  // игр в выдаче (у них свои страницы и sitemap-записи).
  noindex: true,
})

async function GamesContent() {
  const games: Game[] = await fetchPublishedGames()

  const collectionSchema = generateCollectionSchema({
    name: 'Игры canfly',
    description: GAMES_DESCRIPTION,
    path: '/games',
    items: games.map(game => ({
      name: game.title,
      url: `${BASE_URL}/games/${game.slug}`,
      image: game.cover_image,
    })),
  })

  return (
    <section>
      <JsonLd schemas={[collectionSchema]} />
      <Breadcrumbs items={[{ label: 'canfly', url: '/' }, { label: 'Игры', url: '/games' }]} />
      {games.length > 0 ? (
        <div className="grid grid-cols-1 gap-x-6 gap-y-12 sm:grid-cols-2 md:grid-cols-3">
          {games.map((game, i) => (
            <GameCard key={game.id} game={game} priority={i < 3} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-[15px] text-cf-text-3">
          Здесь пока тихо — первая игра ещё собирается.
        </p>
      )}
    </section>
  )
}

function GameCard({ game, priority }: { game: Game; priority?: boolean }) {
  return (
    <Link href={`/games/${game.slug}`} className="group block">
      <div className="relative aspect-[16/9] overflow-hidden rounded-2xl border border-cf-text-1/10 bg-cf-bg-2">
        {game.cover_image ? (
          <Image
            src={game.cover_image}
            alt={game.title}
            fill
            sizes="(max-width: 640px) 100vw, (max-width: 768px) 50vw, 33vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <Gamepad2 aria-hidden className="h-12 w-12 text-cf-text-4" />
          </div>
        )}
      </div>
      <h3 className="mt-3 text-[15px] font-medium text-cf-text-heading transition-colors group-hover:text-cf-air-accent-ink">
        {game.title}
      </h3>
      {game.tagline ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-cf-text-3">
          {game.tagline}
        </p>
      ) : null}
    </Link>
  )
}

export default function GamesPage() {
  return (
    <main className="relative mx-auto w-full max-w-4xl px-6 pb-32">
      <div className="cf-rise pt-24 text-center md:pt-28">
        <p className="text-[11px] uppercase tracking-[0.34em] text-cf-text-3">
          играть во вселенной
        </p>
        <h1 className="mt-3 text-[34px] font-light leading-tight tracking-tight text-cf-text-heading md:text-[40px]">
          Игры canfly
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-cf-text-3">
          {GAMES_DESCRIPTION}
        </p>
      </div>

      <div className="cf-rise-late mt-16">
        <Suspense
          fallback={
            <p className="py-16 text-center text-[15px] text-cf-text-3">Загружаем игры...</p>
          }
        >
          <GamesContent />
        </Suspense>
      </div>
    </main>
  )
}
