import { notFound } from 'next/navigation';
import { fetchCharacterBySlug } from '@/lib/server/characters';
import Link from 'next/link';
import { CharacterChat, type CharacterChatMessage } from '@/components/character-chat';
import { CharacterPresence } from '@/components/character-presence';
import { getCurrentUser } from '@/lib/server/session';
import {
  fetchCharacterConversation,
  fetchConversationMessages,
  getFriendship,
} from '@/lib/server/users';
import {
  resolveCharacterChatAvailability,
  type CharacterChatReason,
} from '@/lib/ai/character-chat/availability';
import { toPublicConversationMessages } from '@/lib/character-public';
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

/** История читается только на сервере: GET не создаёт разговор. */
async function getInitialMessages(
  userId: string,
  characterId: string,
): Promise<CharacterChatMessage[]> {
  try {
    const conversation = await fetchCharacterConversation(userId, characterId);
    if (!conversation) return [];

    const stored = await fetchConversationMessages(conversation.id);
    return toPublicConversationMessages(stored).map((message) => ({
      id: message.id,
      role: message.role === 'character' ? 'assistant' : 'user',
      content: message.content,
    }));
  } catch (error) {
    console.error('Error fetching character conversation:', error);
    return [];
  }
}

function unavailableMessage(reason: CharacterChatReason, name: string): string {
  switch (reason) {
    case 'disabled':
      return `${name} сейчас молчит. История переписки остаётся доступной.`;
    case 'blocked':
      return `${name} больше не отвечает. История переписки остаётся доступной.`;
    case 'mode_unavailable':
      return `${name} отвечает вручную, поэтому автоматический ответ сейчас недоступен. История переписки остаётся доступной.`;
    case 'unconfigured':
      return `${name} ещё не заговорил — автор не настроил его речь. История переписки остаётся доступной.`;
    case 'auth_required':
      return `Войдите, чтобы написать ${name}.`;
    default:
      return `${name} сейчас не отвечает на сообщения.`;
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
  const user = await getCurrentUser();
  const friendship = user ? await getFriendship(user.id, character.id) : null;

  // Один резолвер для страницы, API и карточек: UI не обещает разговор,
  // который API всё равно отклонит.
  const availability = resolveCharacterChatAvailability({
    character,
    friendshipStatus: friendship?.status ?? null,
    authenticated: Boolean(user),
  });

  const initialMessages = user ? await getInitialMessages(user.id, character.id) : [];

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
            <CharacterPresence
              character={character}
              friendshipStatus={friendship?.status ?? null}
            />
          </span>
        </Link>
      </div>

      <div className="cf-rise-late flex flex-1 flex-col pb-6">
        {availability.reason === 'auth_required' ? (
          <div className="rounded-2xl border border-cf-air-line bg-cf-air-surface px-5 py-6">
            <p className="text-[15px] leading-relaxed text-cf-text-2">
              {unavailableMessage(availability.reason, character.name)}
            </p>
            <Link
              href={`/login?redirect=${encodeURIComponent(`/characters/${character.slug}/chat`)}`}
              className="mt-4 inline-flex text-sm font-medium text-cf-air-accent-ink underline-offset-4 hover:underline"
            >
              Войти в canfly
            </Link>
          </div>
        ) : (
          <CharacterChat
            characterSlug={character.slug}
            characterName={character.name}
            characterAvatar={character.avatar || ''}
            canGenerate={availability.canGenerate}
            statusMessage={unavailableMessage(availability.reason, character.name)}
            initialMessages={initialMessages}
          />
        )}
      </div>
    </div>
  );
}
