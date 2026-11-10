import type { Character, CharacterMessage } from '@/lib/types'

/**
 * Публичная проекция персонажа для анонимных API. Перечисляем поля явно:
 * `system_role`, `passport` и служебный `map_image_url` наружу не попадают.
 * Добавление новой колонки в `characters` не расширит ответ автоматически.
 */
export interface PublicCharacter {
  id: string
  name: string
  slug: string
  avatar: string | null
  bio: string | null
  full_description: string | null
  abilities: string[]
  speaking_style: string | null
  personality: string | null
  boundaries: string | null
  knowledge_scope: string | null
  spoiler_policy: string | null
  reply_mode: Character['reply_mode']
  can_receive_messages: boolean
  character_type: Character['character_type']
  created_at: string
  updated_at: string
}

/**
 * `abilities` в старых строках могло оказаться JSON-строкой. Возвращаем
 * массив строк; всё неизвестное считаем пустым списком.
 */
export function normalizeAbilities(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === 'string')
      .map((item) => item.trim())
      .filter(Boolean)
  }

  if (typeof value === 'string') {
    try {
      const parsed: unknown = JSON.parse(value)
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
        : []
    } catch {
      return []
    }
  }

  return []
}

export function toPublicCharacter(character: Character): PublicCharacter {
  return {
    id: character.id,
    name: character.name,
    slug: character.slug,
    avatar: character.avatar ?? null,
    bio: character.bio ?? null,
    full_description: character.full_description ?? null,
    abilities: normalizeAbilities(character.abilities),
    speaking_style: character.speaking_style ?? null,
    personality: character.personality ?? null,
    boundaries: character.boundaries ?? null,
    knowledge_scope: character.knowledge_scope ?? null,
    spoiler_policy: character.spoiler_policy ?? null,
    reply_mode: character.reply_mode,
    can_receive_messages: character.can_receive_messages,
    character_type: character.character_type,
    created_at: character.created_at,
    updated_at: character.updated_at,
  }
}

export interface PublicUserSummary {
  id: string
  handle: string | null
  display_name: string
  avatar: string | null
}

/** Минимум о текущем пользователе для ответов чата и дружбы. */
export function toPublicUserSummary(user: {
  id: string
  handle: string | null
  display_name: string
  avatar: string | null
}): PublicUserSummary {
  return {
    id: user.id,
    handle: user.handle,
    display_name: user.display_name,
    avatar: user.avatar,
  }
}

export interface PublicConversationMessage {
  id: string
  role: 'user' | 'character'
  content: string
  created_at: string
}

/**
 * История для клиента: без metadata попыток, модели, usage и служебных
 * `system`-записей. Клиент не должен получать внутренний контракт хода.
 */
export function toPublicConversationMessages(
  messages: CharacterMessage[],
): PublicConversationMessage[] {
  return messages.flatMap((message) => {
    if (message.role !== 'user' && message.role !== 'character') return []
    return [{
      id: message.id,
      role: message.role,
      content: message.content,
      created_at: message.created_at,
    }]
  })
}
