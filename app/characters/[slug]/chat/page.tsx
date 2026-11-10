import { notFound } from 'next/navigation';
import { cache, Suspense } from 'react';
import { fetchCharacterBySlug } from '@/lib/server/characters';
import Link from 'next/link';
import { CharacterChat, type CharacterChatMessage } from '@/components/character-chat';
import { CharacterPresence } from '@/components/character-presence';
import { getCurrentUser } from '@/lib/server/session';
import {
  fetchCharacterConversation,
  fetchConversationMessages,
  fetchCharacterTurnSnapshot,
  getFriendship,
} from '@/lib/server/users';
import {
  resolveCharacterChatAvailability,
  type CharacterChatReason,
} from '@/lib/ai/character-chat/availability';
import { toPublicConversationMessages } from '@/lib/character-public';
import type { CharacterTurnSnapshot } from '@/lib/ai/character-chat/turn-status';
import Image from 'next/image';

export const dynamic = 'force-dynamic';

interface ChatPageProps {
  params: Promise<{ slug: string }>;
}

const getCharacterData = cache(async (slug: string) => {
  try {
    return await fetchCharacterBySlug(slug);
  } catch (error) {
    console.error('Error fetching character:', error);
    return null;
  }
});

/** Ошибка чтения — не пустая история. До успешной загрузки отправка запрещена. */
async function getInitialConversation(
  userId: string,
  characterId: string,
): Promise<{ messages: CharacterChatMessage[]; lastTurn: CharacterTurnSnapshot | null; error: string | null }> {
  try {
    const conversation = await fetchCharacterConversation(userId, characterId);
    if (!conversation) return { messages: [], lastTurn: null, error: null };

    const [stored, lastTurn] = await Promise.all([
      fetchConversationMessages(conversation.id),
      fetchCharacterTurnSnapshot(conversation.id),
    ]);
    return {
      messages: toPublicConversationMessages(stored).map((message) => ({
        id: message.id,
        role: message.role === 'character' ? 'assistant' : 'user',
        content: message.content,
        created_at: new Date(message.created_at).toISOString(),
      })),
      lastTurn,
      error: null,
    };
  } catch (error) {
    console.error('Error fetching character conversation:', error);
    return { messages: [], lastTurn: null, error: 'Не удалось загрузить историю. Повторите загрузку перед отправкой.' };
  }
}

async function InitialCharacterChat({ userId, characterId, characterSlug, characterName, characterAvatar, canGenerate, statusMessage }: {
  userId: string;
  characterId: string;
  characterSlug: string;
  characterName: string;
  characterAvatar: string;
  canGenerate: boolean;
  statusMessage: string;
}) {
  const history = await getInitialConversation(userId, characterId);
  return <CharacterChat
    key={`${userId}:${characterSlug}`}
    viewerId={userId}
    characterSlug={characterSlug}
    characterName={characterName}
    characterAvatar={characterAvatar}
    canGenerate={canGenerate}
    statusMessage={statusMessage}
    initialMessages={history.messages}
    initialTurn={history.lastTurn}
    initialHistoryError={history.error}
  />;
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

  return (
    <div
      data-character-chat-page
      className="mx-auto flex min-h-[100dvh] w-full max-w-3xl flex-col overflow-hidden px-4 sm:px-6"
      style={{ height: 'var(--chat-viewport-height, 100dvh)', minHeight: 'var(--chat-viewport-height, 100dvh)' }}
    >
      <div className="cf-rise flex shrink-0 items-center gap-3 py-4 sm:py-6">
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

      <div className="cf-rise-late flex min-h-0 flex-1 flex-col">
        {!user || availability.reason === 'auth_required' ? (
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
          <Suspense fallback={<p role="status" aria-live="polite" className="py-6 text-sm text-cf-text-3">Загружаем историю разговора…</p>}>
            <InitialCharacterChat
              userId={user.id}
              characterId={character.id}
              characterSlug={character.slug}
              characterName={character.name}
              characterAvatar={character.avatar || ''}
              canGenerate={availability.canGenerate}
              statusMessage={unavailableMessage(availability.reason, character.name)}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
