import Link from 'next/link'
import Image from 'next/image'
import { Plus, MessageSquareOff, Users, MapPin, Lock } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getStudioAllCharacters } from '@/lib/actions/studio-characters'
import type { Character, CharacterReplyMode, CharacterType } from '@/lib/types'

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
  const allCharacters = await getStudioAllCharacters()
  const persons = allCharacters.filter(c => c.character_type === 'person')
  const cities = allCharacters.filter(c => c.character_type === 'city')

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Персонажи и города</h1>
          <p className="mt-1 text-gray-500">
            {allCharacters.length > 0
              ? `${persons.length} ${pluralize(persons.length, ['персонаж', 'персонажа', 'персонажей'])}, ${cities.length} ${pluralize(cities.length, ['город', 'города', 'городов'])}`
              : 'Создание персонажей и городов вселенной'}
          </p>
        </div>
        <Button asChild className="h-11 px-5 bg-gradient-to-r from-violet-600 to-violet-500 text-white font-semibold rounded-xl shadow-md shadow-violet-500/25 hover:shadow-lg hover:shadow-violet-500/30 hover:from-violet-700 hover:to-violet-600">
          <Link href="/studio/characters/new">
            <Plus className="mr-2 h-4 w-4" />
            Новый
          </Link>
        </Button>
      </div>

      <Tabs defaultValue="persons" className="space-y-6">
        <TabsList className="bg-white/60 backdrop-blur-md border border-white/70 rounded-xl shadow-sm">
          <TabsTrigger value="persons" className="rounded-lg data-[state=active]:bg-violet-100/80 data-[state=active]:text-violet-700 data-[state=active]:shadow-sm text-gray-500">
            <Users className="mr-1.5 h-3.5 w-3.5" />
            Персонажи ({persons.length})
          </TabsTrigger>
          <TabsTrigger value="cities" className="rounded-lg data-[state=active]:bg-emerald-100/80 data-[state=active]:text-emerald-700 data-[state=active]:shadow-sm text-gray-500">
            <MapPin className="mr-1.5 h-3.5 w-3.5" />
            Города ({cities.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="persons">
          {persons.length === 0 ? (
            <EmptyState type="person" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {persons.map((char) => (
                <CharacterCard key={char.id} character={char} />
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="cities">
          {cities.length === 0 ? (
            <EmptyState type="city" />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {cities.map((char) => (
                <CityCard key={char.id} character={char} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  )
}

function EmptyState({ type }: { type: CharacterType }) {
  const isCity = type === 'city'
  return (
    <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-20">
      <div className={`flex items-center justify-center h-16 w-16 rounded-2xl mb-4 ${isCity ? 'bg-gradient-to-br from-emerald-100 to-teal-100' : 'bg-gradient-to-br from-violet-100 to-rose-100'}`}>
        {isCity ? <MapPin className="h-8 w-8 text-emerald-400" /> : <Users className="h-8 w-8 text-violet-400" />}
      </div>
      <p className="text-lg font-semibold text-gray-700">{isCity ? 'Городов пока нет' : 'Персонажей пока нет'}</p>
      <p className="mt-1 text-sm text-gray-400">{isCity ? 'Создайте первый город вашей вселенной' : 'Создайте первого героя вашей вселенной'}</p>
      <Link href={`/studio/characters/new?type=${type}`} className="mt-6">
        <Button className={`h-11 px-6 font-semibold rounded-xl shadow-md hover:shadow-lg ${isCity ? 'bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600' : 'bg-gradient-to-r from-violet-600 to-violet-500 text-white shadow-violet-500/25 hover:from-violet-700 hover:to-violet-600'}`}>
          <Plus className="mr-2 h-4 w-4" />
          {isCity ? 'Создать город' : 'Создать первого'}
        </Button>
      </Link>
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

function CityCard({
  character,
}: {
  character: Character
}) {
  return (
    <Link
      href={`/studio/characters/${character.id}`}
      className="group block"
    >
      <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 transition-all duration-300 hover:bg-white/80 hover:shadow-md hover:shadow-black/8 hover:-translate-y-0.5 hover:border-white/90 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-br from-emerald-100/80 via-teal-50/60 to-amber-50/40">
          {character.passport ? (
            <div className="absolute left-3 top-3 flex items-center gap-1 bg-red-50/80 backdrop-blur-sm rounded-lg px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-red-500 shadow-sm">
              <Lock className="h-3 w-3" />
              Паспорт
            </div>
          ) : null}
          {character.map_image_url ? (
            <div className="relative h-full w-full">
              <Image
                src={character.map_image_url}
                alt={`Карта ${character.name}`}
                fill
                sizes="(max-width: 768px) 100vw, 50vw"
                className="object-cover opacity-60"
              />
            </div>
          ) : null}
        </div>

        <div className="relative px-5 pb-5 pt-0">
          <div className="absolute -top-10 left-5">
            <div className="relative h-20 w-20 overflow-hidden rounded-2xl border-4 border-white/80 shadow-lg shadow-black/10 bg-gradient-to-br from-emerald-50 to-teal-50">
              {character.avatar ? (
                <Image
                  src={character.avatar}
                  alt={character.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center">
                  <MapPin className="h-8 w-8 text-emerald-400" />
                </div>
              )}
            </div>
          </div>

          <div className="pt-12">
            <h3 className="truncate text-lg font-bold text-gray-900 group-hover:text-emerald-700 transition-colors">
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

            <div className="mt-3">
              <Badge
                variant="outline"
                className="border-emerald-200/80 bg-emerald-50/50 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600 rounded-lg"
              >
                Город
              </Badge>
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
