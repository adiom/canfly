import Link from 'next/link'
import Image from 'next/image'
import { Plus, MapPin } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getStudioPlaces } from '@/lib/actions/studio-places'
import type { Place } from '@/lib/types'

export const dynamic = 'force-dynamic'

function pluralize(n: number, forms: [string, string, string]) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return forms[0]
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return forms[1]
  return forms[2]
}

export default async function StudioPlacesPage() {
  const places = await getStudioPlaces()

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 md:px-8 md:py-12">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Места</h1>
          <p className="mt-1 text-gray-500">
            {places.length > 0
              ? `${places.length} ${pluralize(places.length, ['место', 'места', 'мест'])}`
              : 'Создание локаций вселенной'}
          </p>
        </div>
        <Button asChild className="h-11 px-5 bg-gradient-to-r from-emerald-600 to-emerald-500 text-white font-semibold rounded-xl shadow-md shadow-emerald-500/25 hover:shadow-lg hover:shadow-emerald-500/30 hover:from-emerald-700 hover:to-emerald-600">
          <Link href="/studio/places/new">
            <Plus className="mr-2 h-4 w-4" />
            Новое место
          </Link>
        </Button>
      </div>

      {places.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-20">
          <div className="flex items-center justify-center h-16 w-16 rounded-2xl mb-4 bg-gradient-to-br from-emerald-100 to-teal-100">
            <MapPin className="h-8 w-8 text-emerald-400" />
          </div>
          <p className="text-lg font-semibold text-gray-700">Мест пока нет</p>
          <p className="mt-1 text-sm text-gray-400">Создайте первую локацию вашей вселенной</p>
          <Link href="/studio/places/new" className="mt-6">
            <Button className="h-11 px-6 font-semibold rounded-xl shadow-md hover:shadow-lg bg-gradient-to-r from-emerald-600 to-emerald-500 text-white shadow-emerald-500/25 hover:from-emerald-700 hover:to-emerald-600">
              <Plus className="mr-2 h-4 w-4" />
              Создать место
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {places.map((place) => (
            <PlaceCard key={place.id} place={place} />
          ))}
        </div>
      )}
    </div>
  )
}

function PlaceCard({ place }: { place: Place }) {
  return (
    <Link
      href={`/studio/places/${place.id}`}
      className="group block"
    >
      <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 transition-all duration-300 hover:bg-white/80 hover:shadow-md hover:shadow-black/8 hover:-translate-y-0.5 hover:border-white/90 overflow-hidden">
        <div className="relative h-24 bg-gradient-to-br from-emerald-100/80 via-teal-50/60 to-amber-50/40">
          {place.map_image_url ? (
            <div className="relative h-full w-full">
              <Image
                src={place.map_image_url}
                alt={`Карта ${place.name}`}
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
              {place.avatar ? (
                <Image
                  src={place.avatar}
                  alt={place.name}
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
              {place.name}
            </h3>
            <p className="truncate text-xs text-gray-400 tracking-wide">
              @{place.slug}
            </p>

            {place.bio ? (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-500">
                {place.bio}
              </p>
            ) : (
              <p className="mt-2 line-clamp-3 text-sm leading-6 text-gray-300">
                Описание не заполнено
              </p>
            )}

            <div className="mt-3">
              {place.era ? (
                <span className="inline-flex items-center rounded-full bg-emerald-50/50 border border-emerald-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-emerald-600">
                  {place.era}
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </Link>
  )
}
