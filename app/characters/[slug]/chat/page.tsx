import { notFound } from 'next/navigation';
import { fetchCharacterBySlug } from '@/lib/server/characters';
import Link from 'next/link';
import { CharacterChat } from '@/components/character-chat';
import { CharacterPresence } from '@/components/character-presence';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

interface ChatPageProps {
  params: Promise<{ slug: string }>;
}

async function getCharacterData(slug: string) {
  try {
    return await fetchCharacterBySlug(slug);
  } catch (error) {
    console.error('Error fetching character:', error);
    return null;
  }
}

export async function generateMetadata({ params }: ChatPageProps) {
  const { slug } = await params;
  const data = await getCharacterData(slug);

  if (!data?.character) {
    return { title: 'Персонаж не найден - canfly', robots: { index: false, follow: false } };
  }

  return {
    title: `Чат с ${data.character.name} - canfly | культура твоего сознания`,
    description: `Поговори с ${data.character.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function CharacterChatPage({ params }: ChatPageProps) {
  const { slug } = await params;
  const data = await getCharacterData(slug);

  if (!data?.character) notFound();

  const character = data.character;

  return (
    <div className="mx-auto flex min-h-screen w-full max-w-3xl flex-col px-6">
      <div className="cf-rise flex items-center gap-3 py-6">
        <Link
          href={`/characters/${character.slug}`}
          className="flex items-center gap-3 text-left transition-opacity hover:opacity-70"
        >
          <span className="relative block h-10 w-10 shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2 ring-1 ring-cf-air-line">
            {character.avatar ? (
              <Image src={character.avatar} alt={character.name} fill sizes="40px" className="object-cover" />
            ) : (
              <span className="flex h-full w-full items-center justify-center text-sm font-light text-cf-text-3">
                {character.name.trim()[0]}
              </span>
            )}
          </span>
          <span className="block">
            <span className="block text-[15px] text-cf-text-heading">{character.name}</span>
            <CharacterPresence character={character} />
          </span>
        </Link>
      </div>

      <div className="cf-rise-late flex flex-1 flex-col pb-6">
        {character.can_receive_messages !== false && character.reply_mode !== 'disabled' ? (
          <CharacterChat
            characterSlug={character.slug}
            characterName={character.name}
            characterAvatar={character.avatar || ''}
          />
        ) : (
          <p className="text-[15px] leading-relaxed text-cf-text-3">
            {character.name} сейчас молчит. Загляни в профиль — там остались его записи.
          </p>
        )}
      </div>
    </div>
  );
}
