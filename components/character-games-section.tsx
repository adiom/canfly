import Image from 'next/image'
import Link from 'next/link'
import { Gamepad2 } from 'lucide-react'

import type { Game } from '@/lib/releases-types'

interface CharacterGamesSectionProps {
  games: Game[]
}

/**
 * Игры с участием персонажа. Блок живёт рядом с релизами и рендерится только
 * когда связи есть: пустая секция «Игры» на странице ничего не сообщает.
 */
export function CharacterGamesSection({ games }: CharacterGamesSectionProps) {
  if (games.length === 0) return null

  return (
    <section id="games" className="scroll-mt-24">
      <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">Игры</h2>

      <ul className="cf-glass-2 space-y-3 rounded-3xl p-5">
        {games.map((game) => (
          <li key={game.id}>
            <Link
              href={`/games/${game.slug}`}
              className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-cf-air-surface"
            >
              <span className="relative h-12 w-20 shrink-0 overflow-hidden rounded-xl bg-cf-air-surface-2">
                {game.cover_image ? (
                  <Image
                    src={game.cover_image}
                    alt={game.title}
                    fill
                    sizes="80px"
                    className="object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center">
                    <Gamepad2 className="h-5 w-5 text-cf-text-4" />
                  </span>
                )}
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] leading-tight text-cf-text-heading">
                  {game.title}
                </span>
                {game.tagline ? (
                  <span className="mt-1 line-clamp-1 block text-[11px] leading-snug text-cf-text-3">
                    {game.tagline}
                  </span>
                ) : null}
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
  )
}
