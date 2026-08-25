import Link from 'next/link'
import Image from 'next/image'
import { Plus, MessageSquareOff, Users, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getStudioCharacters } from '@/lib/actions/studio-characters'
import type { Character, CharacterReplyMode } from '@/lib/types'

export const dynamic = 'force-dynamic'

const REPLY_MODE_LABELS: Record<CharacterReplyMode, { label: string; tone: string }> = {
  ai_auto: { label: 'AI авто', tone: 'bg-violet-50 text-violet-600 border-violet-200/80' },
  manual: { label: 'Вручную', tone: 'bg-amber-50 text-amber-600 border-amber-200/80' },
  hybrid: { label: 'AI + проверка', tone: 'bg-sky-50 text-sky-600 border-sky-200/80' },
  disabled: { label: 'Отключено', tone: 'bg-gray-100 text-gray-400 border-gray-200/80' },
}

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

export default async function StudioCharactersPage() {
  const characters = await getStudioCharacters()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Персонажи</h1>
          <p className="mt-1 text-gray-500">
            {characters.length > 0
              ? `${characters.length} ${pluralize(characters.length, ['персонаж', 'персонажа', 'персонажей'])}`
              : 'Создание персонажей вселенной'}
          </p>
        </div>
        <Button asChild className="h-11 px-5 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-xl shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/30 hover:from-violet-700 hover:to-violet-600">
          <Link href="/studio/characters/new">
            <Plus className="mr-2 h-4 w-4" />
            Новый
          </Link>
        </Button>
      </div>

      {characters.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-20">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl mb-4 bg-gradient-to-br from-violet-100 to-rose-100">
            <Users className="h-8 w-8 text-violet-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700">Персонажей пока нет</p>
          <p className="mt-1 text-sm text-gray-400">Создайте первого героя вашей вселенной</p>
          <Link href="/studio/characters/new" className="mt-6">
            <Button className="h-11 px-6 font-semibold rounded-xl shadow-md hover:shadow-lg bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600">
              <Plus className="mr-2 h-4 w-4" />
              Создать первого
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {characters.map((char) => (
            <CharacterCard key={char.id} character={char} />
          ))}
        </div>
      )}
    </div>
  )
}

function CharacterCard({
  character,
}: {
  character: Character
}) {
  const reply = REPLY_MODE_LABELS[character.reply_mode]
  return (
    <Link
      href={`/studio/characters/${character.id}`}
      className="group block"
    >
      <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 transition-all duration-300 hover:bg-white/80 hover:shadow-md hover:shadow-black/8 hover:-translate-y-0.5 hover:border-white/90 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-br from-violet-100/80 via-rose-50/60 to-amber-50/40">
          {!character.can_receive_messages ? (
            <div className="absolute right-3 top-3 flex items-center gap-1 bg-white/80 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-500 shadow-sm">
              <MessageSquareOff className="h-3 w-3" />
              Тихий
            </div>
          ) : null}
          {character.passport ? (
            <div className="absolute left-3 top-3 flex items-center gap-1 bg-red-50/80 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-500 shadow-sm">
              <Lock className="h-3 w-3" />
              Паспорт
            </div>
          ) : null}
        </div>

        <div className="relative px-5 pb-5 pt-0">
          <div className="absolute -top-10 left-5">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-4 border-white/80 shadow-lg shadow-black/10 bg-gradient-to-br from-violet-50 to-rose-50">
              {character.avatar ? (
                <Image
                  src={character.avatar}
                  alt={character.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-2xl font-bold text-violet-400">
                  {character.name[0]}
                </div>
              )}
            </div>
          </div>

          <div className="pt-12">
            <h3 className="truncate text-lg font-bold text-gray-900 group-hover:text-violet-700 transition-colors">
              {character.name}
            </h3>
            <p className="truncate text-xs text-gray-400 tracking-wide">
              @{character.slug}
            </p>

            {character.bio ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                {character.bio}
              </p>
            ) : (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-300">
                Описание не заполнено
              </p>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              <Badge
                variant="outline"
                className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${reply.tone}`}
              >
                {reply.label}
              </Badge>
              {character.abilities && character.abilities.length > 0 ? (
                <Badge
                  variant="outline"
                  className="border-violet-200/80 bg-violet-50/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-500 rounded-lg"
                >
                  {character.abilities.length} способностей
                </Badge>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
