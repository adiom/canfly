import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ExternalLink, Gamepad2, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DeleteGameButton } from '@/components/studio/delete-game-button'
import { getStudioGame } from '@/lib/actions/studio-games'

export const dynamic = 'force-dynamic'

export default async function StudioGameDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getStudioGame(id)
  if (!data) notFound()

  const { game, allCharacters, allReleases, linkedCharacterIds, linkedReleaseIds } = data
  const linkedCharacters = allCharacters.filter(character => linkedCharacterIds.includes(character.id))
  const linkedReleases = allReleases.filter(release => linkedReleaseIds.includes(release.id))

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-28 overflow-hidden rounded-2xl bg-gradient-to-br from-violet-50 to-rose-50">
            {game.cover_image ? (
              <Image src={game.cover_image} alt={game.title} fill sizes="112px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Gamepad2 className="h-8 w-8 text-violet-400" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-gray-900">{game.title}</h1>
            <p className="text-sm text-gray-400">
              @{game.slug}
              <span className="mx-2" aria-hidden>
                ·
              </span>
              {game.is_published ? 'опубликована' : 'черновик'}
              <span className="mx-2" aria-hidden>
                ·
              </span>
              {game.aspect_ratio}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/studio/games/${game.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Редактировать
            </Link>
          </Button>
          {game.is_published ? (
            <Button asChild variant="outline" className="rounded-xl">
              <Link href={`/games/${game.slug}`} target="_blank">
                <ExternalLink className="mr-2 h-4 w-4" />
                Открыть на сайте
              </Link>
            </Button>
          ) : null}
          <DeleteGameButton id={game.id} title={game.title} />
        </div>
      </div>

      <div className="mb-8 rounded-2xl border border-white/70 bg-white/60 p-5 backdrop-blur-md">
        <h2 className="mb-2 text-sm font-semibold text-gray-500">Файлы игры</h2>
        <p className="text-sm text-gray-500">
          Ожидаемый путь:{' '}
          <code className="text-gray-700">public/games/{game.slug}/index.html</code>
        </p>
        <Button asChild variant="outline" className="mt-3 rounded-xl">
          <Link href={`/games/${game.slug}/index.html`} target="_blank">
            Проверить файл
          </Link>
        </Button>
      </div>

      {game.tagline || game.description ? (
        <div className="mb-8 rounded-2xl border border-white/70 bg-white/60 p-5 backdrop-blur-md">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">Описание</h2>
          {game.tagline ? <p className="font-medium text-gray-700">{game.tagline}</p> : null}
          {game.description ? (
            <p className="mt-2 whitespace-pre-line text-gray-700">{game.description}</p>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-white/70 bg-white/60 p-5 backdrop-blur-md">
          <h2 className="mb-4 text-sm font-semibold text-gray-500">
            Персонажи ({linkedCharacters.length})
          </h2>
          {linkedCharacters.length === 0 ? (
            <p className="text-sm text-gray-400">Пока нет привязанных персонажей</p>
          ) : (
            <ul className="space-y-2">
              {linkedCharacters.map(character => (
                <li key={character.id}>
                  <Link
                    href={`/characters/${character.slug}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-gray-50"
                  >
                    <span className="relative h-8 w-8 overflow-hidden rounded-lg bg-gradient-to-br from-violet-50 to-rose-50">
                      {character.avatar ? (
                        <Image src={character.avatar} alt={character.name} fill sizes="32px" className="object-cover" />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-xs font-bold text-violet-400">
                          {character.name.charAt(0)}
                        </span>
                      )}
                    </span>
                    <span className="text-sm text-gray-700">{character.name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl border border-white/70 bg-white/60 p-5 backdrop-blur-md">
          <h2 className="mb-4 text-sm font-semibold text-gray-500">
            Релизы ({linkedReleases.length})
          </h2>
          {linkedReleases.length === 0 ? (
            <p className="text-sm text-gray-400">Пока нет привязанных релизов</p>
          ) : (
            <ul className="space-y-2">
              {linkedReleases.map(release => (
                <li key={release.id}>
                  <Link
                    href={`/release/${release.slug}`}
                    className="flex items-center gap-3 rounded-xl p-2 transition-colors hover:bg-gray-50"
                  >
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="text-sm text-gray-700">{release.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}
