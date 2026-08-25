import Link from 'next/link'
import Image from 'next/image'
import { notFound } from 'next/navigation'
import { MapPin, Pencil } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getStudioPlace } from '@/lib/actions/studio-places'
import { fetchPlaceCharacters } from '@/lib/server/places'
import { fetchReleasesByPlace } from '@/lib/server/releases'

export const dynamic = 'force-dynamic'

export default async function StudioPlaceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const place = await getStudioPlace(id)
  if (!place) notFound()

  const [residents, releases] = await Promise.all([
    fetchPlaceCharacters(place.id),
    fetchReleasesByPlace(place.id, { onlyPublished: false }),
  ])

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="relative h-16 w-16 overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-50 to-teal-50">
            {place.avatar ? (
              <Image src={place.avatar} alt={place.name} fill sizes="64px" className="object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <MapPin className="h-8 w-8 text-emerald-400" />
              </div>
            )}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">{place.name}</h1>
            <p className="text-sm text-gray-400">@{place.slug}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/studio/places/${place.id}/edit`}>
              <Pencil className="mr-2 h-4 w-4" />
              Редактировать
            </Link>
          </Button>
          <Button asChild variant="outline" className="rounded-xl">
            <Link href={`/places/${place.slug}`} target="_blank">
              Открыть
            </Link>
          </Button>
        </div>
      </div>

      {place.bio && (
        <div className="mb-8 rounded-2xl bg-white/60 backdrop-blur-md border border-white/70 p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">Описание</h2>
          <p className="text-gray-700">{place.bio}</p>
        </div>
      )}

      {place.full_description && (
        <div className="mb-8 rounded-2xl bg-white/60 backdrop-blur-md border border-white/70 p-5">
          <h2 className="mb-2 text-sm font-semibold text-gray-500">Полное описание</h2>
          <p className="whitespace-pre-line text-gray-700">{place.full_description}</p>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/70 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-500">
            Жители ({residents.length})
          </h2>
          {residents.length === 0 ? (
            <p className="text-sm text-gray-400">Пока нет привязанных персонажей</p>
          ) : (
            <ul className="space-y-2">
              {residents.map(r => (
                <li key={r.character_id}>
                  <Link href={`/characters/${r.character_slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 transition-colors">
                    <div className="relative h-8 w-8 overflow-hidden rounded-lg bg-gradient-to-br from-violet-50 to-rose-50">
                      {r.character_avatar ? (
                        <Image src={r.character_avatar} alt={r.character_name} fill sizes="32px" className="object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs font-bold text-violet-400">
                          {r.character_name[0]}
                        </div>
                      )}
                    </div>
                    <span className="text-sm text-gray-700">{r.character_name}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-2xl bg-white/60 backdrop-blur-md border border-white/70 p-5">
          <h2 className="mb-4 text-sm font-semibold text-gray-500">
            Релизы ({releases.length})
          </h2>
          {releases.length === 0 ? (
            <p className="text-sm text-gray-400">Пока нет привязанных релизов</p>
          ) : (
            <ul className="space-y-2">
              {releases.map(rel => (
                <li key={rel.release_id}>
                  <Link href={`/release/${rel.release_slug}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-gray-50 transition-colors">
                    <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-400" />
                    <span className="text-sm text-gray-700">{rel.release_title}</span>
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
