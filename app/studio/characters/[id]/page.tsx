import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { ArrowLeft, Edit, Plus, Trash2, ExternalLink, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import {
  deleteCharacterAction,
  getStudioCharacter,
  listStudioCharacterPosts,
  listStudioWallPosts,
  listStudioCharacterRelationships,
  listStudioCharacterReaders,
} from '@/lib/actions/studio-characters'
import { isAuthorOrAdmin } from '@/lib/server/studio-auth'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { CharacterPostsTable } from '@/components/studio/character-posts-table'
import { CharacterWallModeration } from '@/components/studio/character-wall-moderation'
import { PassportEditor } from '@/components/studio/passport-editor'
import { RelationshipsEditor } from '@/app/studio/characters/[id]/_components/relationships-editor'
import { ReadersList } from '@/app/studio/characters/[id]/_components/readers-list'

export const dynamic = 'force-dynamic'

const replyModeBadgeStyles: Record<string, string> = {
  ai_auto: 'bg-violet-50 text-violet-600 border-violet-200/80',
  manual: 'bg-amber-50 text-amber-600 border-amber-200/80',
  hybrid: 'bg-sky-50 text-sky-600 border-sky-200/80',
  disabled: 'bg-gray-100 text-gray-400 border-gray-200/80',
}

const replyModeLabels: Record<string, string> = {
  ai_auto: 'AI авто',
  manual: 'Вручную',
  hybrid: 'AI + проверка',
  disabled: 'Отключено',
}

export default async function StudioCharacterPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireStudioSession()
  if (!session) notFound()

  const showPassport = isAuthorOrAdmin(session)
  const isAdmin = session.isAdmin

  const character = await getStudioCharacter(id)
  if (!character) notFound()

  const isCity = character.character_type === 'city'

  // Параллельная загрузка всего, что нужно странице. Запросы изолированы,
  // ничего не блокирует другое.
  const [posts, wallPosts, relationships, readers] = await Promise.all([
    isAdmin ? listStudioCharacterPosts(id) : Promise.resolve([]),
    isAdmin ? listStudioWallPosts(id) : Promise.resolve([]),
    listStudioCharacterRelationships(id),
    listStudioCharacterReaders(id),
  ])

  const typeBadgeStyle = isCity
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200/80'
    : 'bg-violet-50 text-violet-600 border-violet-200/80'
  const typeLabel = isCity ? 'Город' : 'Персонаж'

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 md:px-8 md:py-12">
      {/* Шапка — общая для всей страницы */}
      <header className="mb-10">
        <Button
          variant="ghost"
          asChild
          className="mb-4 -ml-3 rounded-xl text-gray-500 hover:text-violet-600 hover:bg-violet-50/50"
        >
          <Link href="/studio/characters">
            <ArrowLeft className="mr-2 h-4 w-4" />
            К списку
          </Link>
        </Button>

        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div
              className={`relative h-16 w-16 shrink-0 overflow-hidden rounded-2xl shadow-lg shadow-black/5 ring-2 ring-white/80 ${
                isCity
                  ? 'bg-gradient-to-br from-emerald-50 to-teal-50'
                  : 'bg-gradient-to-br from-violet-50 to-rose-50'
              }`}
            >
              {character.avatar ? (
                <Image
                  src={character.avatar}
                  alt={character.name}
                  fill
                  sizes="64px"
                  className="object-cover"
                />
              ) : (
                <div
                  className={`flex h-full w-full items-center justify-center text-lg font-bold ${
                    isCity ? 'text-emerald-400' : 'text-violet-400'
                  }`}
                >
                  {isCity ? <MapPin className="h-6 w-6" /> : character.name[0]}
                </div>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 tracking-tight">
                {character.name}
              </h1>
              <p className="text-sm text-gray-400">@{character.slug}</p>
              <div className="mt-2 flex gap-2">
                <Badge
                  variant="outline"
                  className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${typeBadgeStyle}`}
                >
                  {typeLabel}
                </Badge>
                {!isCity && (
                  <Badge
                    variant="outline"
                    className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${replyModeBadgeStyles[character.reply_mode]}`}
                  >
                    {replyModeLabels[character.reply_mode]}
                  </Badge>
                )}
                {!isCity && !character.can_receive_messages && (
                  <Badge
                    variant="outline"
                    className="border-gray-200/80 bg-gray-50 text-gray-400 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg"
                  >
                    Сообщения отключены
                  </Badge>
                )}
              </div>
            </div>
          </div>

          <div className="flex gap-2">
            {!isCity && (
              <Button
                asChild
                variant="outline"
                className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
              >
                <Link href={`/characters/${character.slug}`} target="_blank">
                  <ExternalLink className="mr-2 h-4 w-4" />
                  Профиль
                </Link>
              </Button>
            )}
            {isAdmin && (
              <>
                <Button
                  asChild
                  variant="outline"
                  className="rounded-xl border-white/70 bg-white/60 text-gray-600 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200"
                >
                  <Link href={`/studio/characters/${character.id}/edit`}>
                    <Edit className="mr-2 h-4 w-4" />
                    Редактировать
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex h-9 shrink-0 items-center justify-center rounded-xl bg-red-50 text-red-600 border border-red-200/80 transition-colors hover:bg-red-100 hover:text-red-700">
                    <Trash2 className="h-4 w-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white/80 backdrop-blur-xl border-white/70 rounded-2xl shadow-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-gray-900">
                        Удалить {isCity ? 'город' : 'персонажа'}?
                      </AlertDialogTitle>
                      <AlertDialogDescription>
                        Это действие необратимо. Все связи, посты и стена будут удалены.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                      <form action={deleteCharacterAction.bind(null, character.id)}>
                        <AlertDialogAction
                          type="submit"
                          className="rounded-xl bg-red-600 text-white"
                        >
                          Удалить
                        </AlertDialogAction>
                      </form>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Все секции идут друг под другом в одной колонке — без вкладок.
          Каждая секция имеет id, чтобы можно было дать прямую ссылку. */}
      <main className="space-y-10">
        {/* Описание */}
        <section
          id="about"
          aria-labelledby="about-heading"
          className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-5 md:p-6"
        >
          <h2
            id="about-heading"
            className="mb-4 text-[12px] uppercase tracking-[0.28em] text-gray-500"
          >
            {isCity ? 'О городе' : 'О персонаже'}
          </h2>
          <dl className="space-y-4 text-sm">
            <div>
              <dt className="font-semibold text-gray-600">{isCity ? 'Описание' : 'Био'}</dt>
              <dd className="mt-1 whitespace-pre-wrap text-gray-900">{character.bio || '—'}</dd>
            </div>
            {character.full_description ? (
              <div>
                <dt className="font-semibold text-gray-600">Полное описание</dt>
                <dd className="mt-1 whitespace-pre-wrap text-gray-900">
                  {character.full_description}
                </dd>
              </div>
            ) : null}
            {isCity && character.map_image_url ? (
              <div>
                <dt className="font-semibold text-gray-600">Карта</dt>
                <dd className="mt-1">
                  <div className="relative max-w-full">
                    <Image
                      src={character.map_image_url}
                      alt={`Карта ${character.name}`}
                      fill
                      sizes="(max-width: 768px) 100vw, 50vw"
                      className="rounded-xl border border-white/70 shadow-sm object-contain"
                    />
                  </div>
                </dd>
              </div>
            ) : null}
            {!isCity && character.abilities?.length ? (
              <div>
                <dt className="font-semibold text-gray-600">Способности</dt>
                <dd className="mt-1">
                  <ul className="list-disc pl-5 text-gray-700">
                    {character.abilities.map((a, i) => (
                      <li key={i}>{a}</li>
                    ))}
                  </ul>
                </dd>
              </div>
            ) : null}
          </dl>
        </section>

        {/* Посты */}
        {isAdmin && (
          <section id="posts" aria-labelledby="posts-heading" className="space-y-4">
            <div className="flex items-center justify-between">
              <h2
                id="posts-heading"
                className="text-[12px] uppercase tracking-[0.28em] text-gray-500"
              >
                Посты <span className="ml-2 text-gray-400">({posts.length})</span>
              </h2>
              {!isCity && (
                <Button
                  asChild
                  className="rounded-xl bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-md shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600"
                >
                  <Link href={`/studio/characters/${character.id}/posts/new`}>
                    <Plus className="mr-2 h-4 w-4" />
                    Новый пост
                  </Link>
                </Button>
              )}
            </div>
            <CharacterPostsTable characterId={character.id} posts={posts} />
          </section>
        )}

        {/* Стена */}
        {isAdmin && (
          <section id="wall" aria-labelledby="wall-heading">
            <h2
              id="wall-heading"
              className="mb-4 text-[12px] uppercase tracking-[0.28em] text-gray-500"
            >
              Стена <span className="ml-2 text-gray-400">({wallPosts.length})</span>
            </h2>
            <CharacterWallModeration wallPosts={wallPosts} />
          </section>
        )}

        {/* Паспорт (author/admin) */}
        {showPassport && (
          <section id="passport" aria-labelledby="passport-heading">
            <h2
              id="passport-heading"
              className="mb-4 text-[12px] uppercase tracking-[0.28em] text-gray-500"
            >
              Паспорт
            </h2>
            <PassportEditor
              characterId={character.id}
              passport={character.passport}
              characterName={character.name}
              characterType={character.character_type}
            />
          </section>
        )}

        {/* Связи (Character ↔ Character) — новый glass-блок */}
        <section id="relationships" aria-labelledby="relationships-heading">
          <h2
            id="relationships-heading"
            className="mb-4 text-[12px] uppercase tracking-[0.28em] text-gray-500"
          >
            Связи{' '}
            <span className="ml-2 text-gray-400">({relationships.length})</span>
          </h2>
          <RelationshipsEditor characterId={character.id} initial={relationships} />
        </section>

        {/* Читатели (Character ↔ User) — новый glass-блок */}
        <section id="readers" aria-labelledby="readers-heading">
          <h2
            id="readers-heading"
            className="mb-4 text-[12px] uppercase tracking-[0.28em] text-gray-500"
          >
            Читатели{' '}
            <span className="ml-2 text-gray-400">({readers.length})</span>
          </h2>
          <ReadersList characterId={character.id} initial={readers} />
        </section>
      </main>
    </div>
  )
}
