import { Character } from '@/lib/types';
import { fetchCharactersList } from '@/lib/server/characters';
import { CharacterCard } from '@/components/character-card';
import { Suspense } from 'react';
import { JsonLd } from '@/components/seo/json-ld';
import { generateCollectionSchema, generateBreadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { CATALOG_PATH } from '@/lib/nav';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const CHARACTERS_DESCRIPTION = 'Встретьте героев вселенной и заговорите с ними'

export const metadata = buildMetadata({
  title: 'Персонажи | canfly — культура твоего сознания',
  description: CHARACTERS_DESCRIPTION,
  path: '/characters',
})

async function CharactersContent() {
  let characters: Character[] = []

  try {
    characters = await fetchCharactersList()
  } catch (error) {
    console.error('Error loading characters:', error)
  }

  const collectionSchema = generateCollectionSchema({
    name: 'Персонажи canfly',
    description: CHARACTERS_DESCRIPTION,
    path: '/characters',
    items: characters.map(character => ({
      name: character.name,
      url: `${BASE_URL}/characters/${character.slug}`,
      image: character.avatar,
    })),
  })

  return (
    <section>
      <JsonLd
        schemas={[
          collectionSchema,
          generateBreadcrumbSchema([
            { label: 'canfly', url: `${BASE_URL}${CATALOG_PATH}` },
            { label: 'Персонажи', url: `${BASE_URL}/characters` },
          ]),
        ]}
      />
      {characters.length > 0 ? (
        <div className="grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 md:grid-cols-4">
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

export default function CharactersPage() {
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
          <CharactersContent />
        </Suspense>
      </div>
    </main>
  );
}
