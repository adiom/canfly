import { Place } from '@/lib/types'
import { fetchPublicPlaces } from '@/lib/server/places'
import { Suspense } from 'react'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'
import { generateCollectionSchema } from '@/lib/seo/schema'
import { buildMetadata } from '@/lib/seo/metadata'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'

export const revalidate = 300

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const PLACES_DESCRIPTION =
  'Локации литературной вселенной canfly — города и места, где живут персонажи и разворачиваются истории.'

export const metadata = buildMetadata({
  title: 'Места | canfly — культура твоего сознания',
  description: PLACES_DESCRIPTION,
  path: '/places',
  // Навигационный хаб без уникального контента: не конкурирует с карточками
  // мест в выдаче и не даёт сигнала «тонкий контент».
  noindex: true,
})

async function PlacesContent() {
  const places: Place[] = await fetchPublicPlaces()

  const collectionSchema = generateCollectionSchema({
    name: 'Места canfly',
    description: PLACES_DESCRIPTION,
    path: '/places',
    items: places.map(place => ({
      name: place.name,
      url: `${BASE_URL}/places/${place.slug}`,
      image: place.avatar,
    })),
  })

  return (
    <section>
      <JsonLd schemas={[collectionSchema]} />
      <Breadcrumbs items={[{ label: 'canfly', url: '/' }, { label: 'Места', url: '/places' }]} />
      {places.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 md:grid-cols-4">
          {places.map((place, i) => (
            <PlaceCard key={place.id} place={place} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-[15px] text-cf-text-3">
          Здесь пока тихо — места ещё не заселили эту вселенную.
        </p>
      )}
    </section>
  )
}

function PlaceCard({ place, priority }: { place: Place; priority?: boolean }) {
  return (
    <Link href={`/places/${place.slug}`} className="group block">
      <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-100/80 via-teal-50/60 to-amber-50/40">
        {place.avatar ? (
          <Image
            src={place.avatar}
            alt={place.name}
            fill
            sizes="(max-width: 640px) 50vw, (max-width: 768px) 33vw, 25vw"
            className="object-cover transition-transform duration-500 group-hover:scale-105"
            priority={priority}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <MapPin className="h-12 w-12 text-emerald-300" />
          </div>
        )}
      </div>
      <h3 className="mt-3 text-[15px] font-medium text-cf-text-heading group-hover:text-emerald-700 transition-colors">
        {place.name}
      </h3>
      {place.bio ? (
        <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-cf-text-3">
          {place.bio}
        </p>
      ) : null}
    </Link>
  )
}

export default function PlacesPage() {
  return (
    <main className="relative mx-auto w-full max-w-4xl px-6 pb-32">
      <div className="cf-rise pt-24 text-center md:pt-28">
        <p className="text-[11px] uppercase tracking-[0.34em] text-cf-text-3">
          локации вселенной
        </p>
        <h1 className="mt-3 text-[34px] font-light leading-tight tracking-tight text-cf-text-heading md:text-[40px]">
          Места canfly
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-cf-text-3">
          {PLACES_DESCRIPTION}
        </p>
      </div>

      <div className="cf-rise-late mt-16">
        <Suspense fallback={<p className="py-16 text-center text-[15px] text-cf-text-3">Собираем вселенную...</p>}>
          <PlacesContent />
        </Suspense>
      </div>
    </main>
  )
}
