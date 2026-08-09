import { Character } from '@/lib/types';
import { fetchCharactersList } from '@/lib/server/characters';
import { CharacterCard } from '@/components/character-card';
import { Suspense } from 'react';
import { SiteHeader } from '@/components/site-header';
import { SiteFooter } from '@/components/site-footer';
import { JsonLd } from '@/components/seo/json-ld';
import { generateCollectionSchema, generateBreadcrumbSchema } from '@/lib/seo/schema';
import { buildMetadata } from '@/lib/seo/metadata';
import { CATALOG_PATH } from '@/lib/nav';

export const dynamic = 'force-dynamic';

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const CHARACTERS_DESCRIPTION = 'Встретьте героев вселенной и откройте их взаимосвязи'

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
        <div className="mb-8">
          <p className="mb-2 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">профили</p>
          <h2 className="text-3xl font-black uppercase text-cf-text-heading mb-2">Персонажи</h2>
          <p className="text-cf-text-caption">Исследуйте героев, их посты и историю</p>
        </div>

        {characters.length > 0 ? (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {characters.map((char, i) => (
            <CharacterCard key={char.id} character={char} priority={i < 3} />
          ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <p className="text-cf-text-3">Персонажей не найдено</p>
          </div>
        )}
      </section>
    );
}

export default function CharactersPage() {
  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <SiteHeader activePath="/characters" />

      <section className="max-w-7xl mx-auto px-4 md:px-8 py-16">
        <div className="mb-12">
          <p className="mb-3 text-xs font-black uppercase tracking-[0.22em] text-cf-accent">персонажи вселенной</p>
          <h1 className="text-4xl font-black uppercase leading-none text-cf-text-heading md:text-6xl">Герои canfly</h1>
        </div>
        <Suspense fallback={<div className="text-center text-cf-text-3 py-12">Загрузка персонажей...</div>}>
          <CharactersContent />
        </Suspense>
      </section>

      <SiteFooter />
    </main>
  );
}
