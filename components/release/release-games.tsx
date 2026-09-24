import Image from 'next/image'
import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'

import type { Game } from '@/lib/releases-types'

/** Блок «Игры» на странице релиза: игры, привязанные к этому релизу в Studio. */
export function ReleaseGames({ games }: { games: Game[] }) {
  if (games.length === 0) return null

  return (
    <section className="border-t border-cf-text-1/10">
      <div className="mx-auto max-w-6xl px-5 py-10 md:px-8 md:py-14">
        <p className="mb-6 text-[10px] font-black uppercase tracking-[0.22em] text-cf-accent">
          игры
        </p>
        <div className="-mx-5 flex gap-4 overflow-x-auto px-5 pb-2 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
          {games.map(game => (
            <Link
              key={game.id}
              href={`/games/${game.slug}`}
              className="group flex w-[240px] shrink-0 flex-col gap-3 rounded-xl border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-all hover:border-cf-warm/45 hover:shadow-lg hover:shadow-cf-warm/5"
            >
              <span className="relative aspect-[16/9] overflow-hidden rounded-lg bg-cf-text-1/8">
                {game.cover_image ? (
                  <Image
                    src={game.cover_image}
                    alt={game.title}
                    fill
                    sizes="240px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Gamepad2 className="h-6 w-6 text-cf-text-4" />
                  </span>
                )}
              </span>
              <span className="text-sm font-bold leading-tight text-cf-text-heading transition-colors group-hover:text-cf-warm">
                {game.title}
              </span>
              {game.tagline ? (
                <span className="line-clamp-2 text-[12px] leading-snug text-cf-text-3">
                  {game.tagline}
                </span>
              ) : null}
            </Link>
          ))}
        </div>
      </div>
    </section>
  )
}
