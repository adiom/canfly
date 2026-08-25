import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { MapPin } from 'lucide-react'

import { fetchPlaceBySlug, fetchPlaceCharacters } from '@/lib/server/places'
import { fetchReleasesByPlace } from '@/lib/server/releases'
import { generatePlaceSchema } from '@/lib/seo/schema'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { JsonLd } from '@/components/seo/json-ld'
import { Breadcrumbs } from '@/components/breadcrumbs'

interface PlacePageProps {
  params: Promise<{ slug: string }>
}

async function getPlaceData(slug: string) {
  try {
    return await fetchPlaceBySlug(slug)
  } catch (error) {
    console.error('Error fetching place:', error)
    return null
  }
}

export async function generateMetadata({ params }: PlacePageProps) {
  const { slug } = await params
  const place = await getPlaceData(slug)
  if (!place) return notFoundMetadata('Место не найдено')

  return buildMetadata({
    title: `${place.name} — canfly | культура твоего сознания`,
    description:
      place.bio ??
      `Локация литературной вселенной canfly — ${place.name}.`,
    path: `/places/${place.slug}`,
    generatedImage: true,
    ogType: 'website',
  })
}

export default async function PlacePage({ params }: PlacePageProps) {
  const { slug } = await params
  const place = await getPlaceData(slug)
  if (!place) notFound()

  const [residents, releases] = await Promise.all([
    fetchPlaceCharacters(place.id),
    fetchReleasesByPlace(place.id),
  ])

  const subjectOfRefs = releases.map(release => ({
    slug: release.release_slug,
    name: release.release_title,
    type: 'CreativeWork' as const,
  }))

  const placeSchema = generatePlaceSchema(place, {
    residents: residents.map(r => ({
      slug: r.character_slug,
      name: r.character_name,
      avatar: r.character_avatar,
    })),
    subjectOf: subjectOfRefs,
  })

  return (
    <main className="relative mx-auto w-full max-w-3xl px-6 pb-32">
      <JsonLd schemas={[placeSchema]} />
      <div className="pt-4">
        <Breadcrumbs items={[
          { label: 'canfly', url: '/' },
          { label: 'Места', url: '/places' },
          { label: place.name, url: `/places/${place.slug}` },
        ]} />
      </div>

      <section className="cf-rise flex flex-col items-center pt-24 md:pt-28">
        <div className="relative h-32 w-32 overflow-hidden rounded-3xl border-4 border-white/80 shadow-lg shadow-black/10 bg-gradient-to-br from-emerald-50 to-teal-50">
          {place.avatar ? (
            <Image
              src={place.avatar}
              alt={place.name}
              fill
              sizes="128px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <MapPin className="h-16 w-16 text-emerald-300" />
            </div>
          )}
        </div>

        <h1 className="mt-6 text-center text-[34px] font-light leading-tight tracking-tight text-cf-text-heading md:text-[40px]">
          {place.name}
        </h1>

        <p className="mt-3 text-[13px] text-cf-text-3">
          Локация canfly
          {place.era ? ` · ${place.era}` : ''}
        </p>

        {place.bio ? (
          <p className="mt-6 max-w-md text-center text-[15px] leading-relaxed text-cf-text-caption">
            {place.bio}
          </p>
        ) : null}
      </section>

      {place.full_description ? (
        <section className="cf-rise-late mt-16">
          <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
            Атмосфера
          </h2>
          <div className="cf-glass-2 rounded-3xl p-6 text-[15px] leading-relaxed text-cf-text-2 whitespace-pre-line">
            {place.full_description}
          </div>
        </section>
      ) : null}

      {residents.length > 0 ? (
        <section className="cf-rise-late mt-16">
          <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
            Кто здесь
          </h2>
          <ul className="cf-glass-2 space-y-3 rounded-3xl p-5">
            {residents.map(r => (
              <li key={r.character_id}>
                <Link
                  href={`/characters/${r.character_slug}`}
                  className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-cf-air-surface"
                >
                  <div className="relative h-10 w-10 overflow-hidden rounded-xl bg-gradient-to-br from-violet-50 to-rose-50">
                    {r.character_avatar ? (
                      <Image
                        src={r.character_avatar}
                        alt={r.character_name}
                        fill
                        sizes="40px"
                        className="object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm font-bold text-violet-400">
                        {r.character_name[0]}
                      </div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] leading-tight text-cf-text-heading group-hover:text-violet-700 transition-colors">
                      {r.character_name}
                    </p>
                    <p className="mt-0.5 text-[10px] uppercase tracking-[0.2em] text-cf-text-3">
                      {r.role === 'resident' ? 'житель' : r.role}
                    </p>
                  </div>
                  <span aria-hidden className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cf-text-2">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {releases.length > 0 ? (
        <section className="cf-rise-late mt-16">
          <h2 className="mb-6 text-[12px] uppercase tracking-[0.28em] text-cf-text-3">
            Где встречается
          </h2>
          <ul className="cf-glass-2 space-y-3 rounded-3xl p-5">
            {releases.map(rel => (
              <li key={rel.release_id}>
                <Link
                  href={`/release/${rel.release_slug}`}
                  className="group flex items-center gap-4 rounded-2xl px-3 py-3 transition-colors duration-300 hover:bg-cf-air-surface"
                >
                  <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-cf-air-accent shadow-[0_0_8px_rgba(106,154,184,0.45)]" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[15px] leading-tight text-cf-text-heading">
                      {rel.release_title}
                    </p>
                    <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-cf-text-3">
                      {rel.role === 'main' ? 'основной персонаж' : rel.role === 'supporting' ? 'второстепенный' : rel.role === 'cameo' ? 'камео' : rel.role}
                    </p>
                  </div>
                  <span aria-hidden className="text-cf-text-4 transition-transform duration-300 group-hover:translate-x-1 group-hover:text-cf-text-2">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <div className="mt-24 text-center">
        <Link
          href="/places"
          className="text-[11px] uppercase tracking-[0.28em] text-cf-text-4 transition-colors hover:text-cf-text-heading"
        >
          все места
        </Link>
      </div>
    </main>
  )
}
