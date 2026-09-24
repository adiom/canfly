import Link from 'next/link'
import Image from 'next/image'
import { Gamepad2, Plus } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getStudioGames } from '@/lib/actions/studio-games'

export const dynamic = 'force-dynamic'

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

export default async function StudioGamesPage() {
  const games = await getStudioGames()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-900">Игры</h1>
          <p className="mt-1 text-gray-500">
            {games.length > 0
              ? `${games.length} ${pluralize(games.length, ['игра', 'игры', 'игр'])}`
              : 'Небольшие веб-игры вселенной'}
          </p>
        </div>
        <Button
          asChild
          className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-5 font-semibold text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600 hover:shadow-lg"
        >
          <Link href="/studio/games/new">
            <Plus className="mr-2 h-4 w-4" />
            Новая игра
          </Link>
        </Button>
      </div>

      {games.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200/80 bg-white/30 py-20 backdrop-blur-sm">
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-100 to-rose-100">
            <Gamepad2 className="h-8 w-8 text-violet-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700">Игр пока нет</p>
          <p className="mt-1 text-sm text-gray-400">
            Положите папку игры в public/games/&lt;slug&gt;/ и создайте запись
          </p>
          <Link href="/studio/games/new" className="mt-6">
            <Button className="h-11 rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 px-6 font-semibold text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
              <Plus className="mr-2 h-4 w-4" />
              Новая игра
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {games.map(game => (
            <Link
              key={game.id}
              href={`/studio/games/${game.id}`}
              className="group overflow-hidden rounded-2xl border border-white/70 bg-white/60 shadow-sm shadow-black/5 backdrop-blur-md transition-shadow hover:shadow-md"
            >
              <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-violet-100 to-rose-50">
                {game.cover_image ? (
                  <Image
                    src={game.cover_image}
                    alt={game.title}
                    fill
                    sizes="(max-width: 640px) 100vw, 33vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center">
                    <Gamepad2 className="h-10 w-10 text-violet-300" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <h2 className="font-semibold text-gray-900 group-hover:text-violet-700">
                    {game.title}
                  </h2>
                  <span
                    className={
                      game.is_published
                        ? 'rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-emerald-700'
                        : 'rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500'
                    }
                  >
                    {game.is_published ? 'опубликована' : 'черновик'}
                  </span>
                </div>
                <p className="mt-1 text-sm text-gray-400">@{game.slug}</p>
                {game.tagline ? (
                  <p className="mt-2 line-clamp-2 text-sm text-gray-500">{game.tagline}</p>
                ) : null}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
