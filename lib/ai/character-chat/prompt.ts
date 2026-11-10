import type { Character, CharacterFriendship } from '@/lib/types'

type FriendshipSnapshot = Pick<CharacterFriendship, 'status' | 'intimacy_level'> | null

/**
 * Собирает system prompt из авторских полей карточки. Здесь нет ни глав, ни
 * паспорта: подключение проверенного канона — отдельный этап. Связь с
 * читателем описывается только если она реально существует.
 */
export function buildCharacterChatSystemPrompt(
  character: Character,
  friendship: FriendshipSnapshot,
): string {
  const relationship = friendship
    ? `Пользователь добавил тебя в друзья. Статус связи: ${friendship.status}. Уровень близости: ${friendship.intimacy_level ?? 1}/100.`
    : 'Пользователь ещё не добавлял тебя в друзья; не утверждай обратное.'

  return `${character.system_role}

Информация о персонаже:
Имя: ${character.name}
Описание: ${character.bio ?? ''}
${character.full_description ? `\nПолное описание: ${character.full_description}` : ''}
${character.personality ? `\nХарактер: ${character.personality}` : ''}
${character.speaking_style ? `\nМанера речи: ${character.speaking_style}` : ''}
${character.knowledge_scope ? `\nГраницы знаний: ${character.knowledge_scope}` : ''}
${character.spoiler_policy ? `\nПолитика спойлеров: ${character.spoiler_policy}` : ''}
${character.boundaries ? `\nОграничения: ${character.boundaries}` : ''}

Отношение к пользователю:
${relationship}

Правила общения:
- Говори только от лица этого персонажа.
- Не утверждай, что ты AI.
- Не раскрывай скрытые сюжетные детали, если пользователь явно не просит спойлеры.
- Если тебя спрашивают о книгах и комиксах вселенной canfly, рассказывай как этот персонаж видит эти события.`
}
