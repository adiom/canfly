import Image from 'next/image'
import Link from 'next/link'
import { ArrowUpRight, Gamepad2 } from 'lucide-react'
import type { Game } from '@/lib/releases-types'
import styles from './release.module.css'

export function ReleaseGames({ games }: { games: Game[] }) {
  return (
    <section aria-labelledby="release-games-title">
      <h2 id="release-games-title" className={styles.sectionSubtitle}>Игры</h2>
      <ul className="mt-5 grid gap-x-8 sm:grid-cols-2">
        {games.map(game => (
          <li key={game.id} className="border-t border-cf-text-1/15">
            <Link href={`/games/${game.slug}`} className="group flex items-start gap-3 py-4">
              {game.cover_image ? (
                <span className="relative aspect-video w-24 shrink-0 overflow-hidden bg-cf-bg-2">
                  <Image src={game.cover_image} alt="" fill sizes="96px" className="object-cover" />
                </span>
              ) : (
                <Gamepad2 size={20} aria-hidden="true" className="mt-1 shrink-0 text-cf-warm" />
              )}
              <span className="min-w-0 flex-1 wrap-anywhere">
                <span className={`${styles.editionTitle} block group-hover:underline`}>{game.title}</span>
                <span className={`${styles.caption} block`}>Игра связана с произведением</span>
                {game.tagline ? <span className={`${styles.caption} mt-1 line-clamp-2`}>{game.tagline}</span> : null}
              </span>
              <ArrowUpRight size={16} aria-hidden="true" className="mt-1 shrink-0 text-cf-warm" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  )
}
