import { Character } from '@/lib/types';
import Link from 'next/link';
import { Suspense } from 'react';
import type { Metadata } from 'next';
import {
  fetchMainCharacters,
  fetchCharactersByRole,
  fetchCharactersByReleaseSlug,
  fetchCharactersBySeriesSlug,
} from '@/lib/server/characters';
import { CharacterCard } from '@/components/character-card';
import { JsonLd } from '@/components/seo/json-ld';
import { Breadcrumbs } from '@/components/breadcrumbs';
import { generateCollectionSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { cn } from '@/lib/utils';
import type { CharacterListRole } from '@/lib/releases-types';

export const revalidate = 300;

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const CHARACTERS_DESCRIPTION =
  'Персонажи литературной вселенной canfly — люди и сущности, связанные историями, релизами и разговорами с AI.'

const ROLE_OPTIONS: { value: CharacterListRole; label: string }[] = [
  { value: 'main', label: 'Главные' },
  { value: 'all', label: 'Все' },
  { value: 'supporting', label: 'Второстепенные' },
  { value: 'cameo', label: 'Камео' },
]

interface CharactersPageProps {
  searchParams: Promise<{
    role?: string
    release?: string
    series?: string
  }>
}

function parseRole(value: string | undefined): CharacterListRole {
  const v = (value ?? 'main').toLowerCase()
  return v === 'all' || v === 'supporting' || v === 'cameo' ? v : 'main'
}

function buildFilterUrl(opts: {
  role?: CharacterListRole
  release?: string
  series?: string
}): string {
  const params = new URLSearchParams()
  if (opts.release) params.set('release', opts.release)
  if (opts.series) params.set('series', opts.series)
  if (opts.role && opts.role !== 'main') params.set('role', opts.role)
  const qs = params.toString()
  return qs ? `/characters?${qs}` : '/characters'
}

async function resolveCharacters(sp: {
  role?: string
  release?: string
  series?: string
}): Promise<Character[]> {
  const role = parseRole(sp.role)
  const release = sp.release?.trim()
  const series = sp.series?.trim()
  if (release) return fetchCharactersByReleaseSlug(release, role)
  if (series) return fetchCharactersBySeriesSlug(series, role)
  if (role !== 'main') return fetchCharactersByRole(role)
  return fetchMainCharacters()
}

export async function generateMetadata({
  searchParams,
}: CharactersPageProps): Promise<Metadata> {
  const sp = await searchParams
  // Хаб с URL-фильтрами — всегда noindex: ?role / ?release / ?series
  // создают дубли для поисковиков; sitemap отдаёт карточки персонально.
  const title = sp.release || sp.series
    ? 'Персонажи по фильтру | canfly'
    : 'Персонажи | canfly — культура твоего сознания'

  return buildMetadata({
    title,
    description: CHARACTERS_DESCRIPTION,
    path: '/characters',
    noindex: true,
  })
}

async function CharactersContent({
  searchParams,
}: {
  searchParams: { role?: string; release?: string; series?: string }
}) {
  const role = parseRole(searchParams.role)
  const release = searchParams.release?.trim()
  const series = searchParams.series?.trim()
  const characters = await resolveCharacters(searchParams)

  const collectionSchema = generateCollectionSchema({
    name: 'Персонажи canfly',
    description: CHARACTERS_DESCRIPTION,
    path: '/characters',
    items: characters.map((character) => ({
      name: character.name,
      url: `${BASE_URL}/characters/${character.slug}`,
      image: character.avatar,
    })),
  })

  const filterLabel = release
    ? `релиз «${release}»`
    : series
      ? `серия «${series}»`
      : null

  return (
    <section>
      <JsonLd schemas={[collectionSchema]} />
      <Breadcrumbs items={[{ label: 'canfly', url: '/' }, { label: 'Персонажи', url: '/characters' }]} />

      <nav
        aria-label="Фильтр персонажей по роли"
        className="flex flex-wrap gap-2 border-b border-cf-text-1/10 pb-5"
      >
        {ROLE_OPTIONS.map((opt) => {
          const active = opt.value === role
          return (
            <Link
              key={opt.value}
              href={buildFilterUrl({ role: opt.value, release, series })}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'inline-flex h-9 items-center px-4 text-sm font-bold uppercase tracking-[0.1em] transition-colors',
                active
                  ? 'bg-cf-accent text-white'
                  : 'bg-cf-text-1/6 text-cf-text-2 hover:bg-cf-text-1/12 hover:text-cf-text-heading',
              )}
            >
              {opt.label}
            </Link>
          )
        })}
      </nav>

      {filterLabel && (
        <p className="mt-6 text-center text-[13px] text-cf-text-3">
          Показаны персонажи из: {filterLabel}.{' '}
          <Link
            href="/characters"
            className="text-cf-air-accent-ink underline-offset-4 hover:underline"
          >
            Все главные
          </Link>
        </p>
      )}

      {characters.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 md:grid-cols-4 mt-10">
          {characters.map((char, i) => (
            <CharacterCard key={char.id} character={char} priority={i < 4} />
          ))}
        </div>
      ) : (
        <p className="py-16 text-center text-[15px] text-cf-text-3">
          Здесь пока тихо — герои ещё не заселили эту вселенную.
        </p>
      )}
    </section>
  );
}

export default async function CharactersPage({ searchParams }: CharactersPageProps) {
  const sp = await searchParams
  return (
    <main className="relative mx-auto w-full max-w-4xl px-6 pb-32">
      <div className="cf-rise pt-24 text-center md:pt-28">
        <p className="text-[11px] uppercase tracking-[0.34em] text-cf-text-3">
          персонажи вселенной
        </p>
        <h1 className="mt-3 text-[34px] font-light leading-tight tracking-tight text-cf-text-heading md:text-[40px]">
          Герои canfly
        </h1>
        <p className="mx-auto mt-3 max-w-md text-[15px] leading-relaxed text-cf-text-3">
          {CHARACTERS_DESCRIPTION}
        </p>
      </div>

      <div className="cf-rise-late mt-16">
        <Suspense fallback={<p className="py-16 text-center text-[15px] text-cf-text-3">Собираем вселенную...</p>}>
          <CharactersContent searchParams={sp} />
        </Suspense>
      </div>
    </main>
  );
}
