import { z } from 'zod'

import { CHARACTER_CHAT_CONFIG } from '@/lib/ai/character-chat/config'

/**
 * Slug допускает буквы (включая кириллицу), цифры, точку, дефис и подчёркивание.
 * Длина ограничена, чтобы не тащить произвольную строку в БД.
 */
const characterSlugSchema = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .regex(/^[\p{L}\p{N}][\p{L}\p{N}._-]*$/u, 'Некорректный slug персонажа')

/**
 * Новый контракт: `{ characterSlug, message, requestId }`.
 *
 * Устаревший `messages` принимается только ради совместимости и служит лишь
 * источником последней пользовательской реплики. Модель, userId, system prompt
 * и готовая история из браузера не принимаются как настройки — zod отбрасывает
 * неизвестные ключи.
 */
export const characterChatRequestSchema = z.object({
  characterSlug: characterSlugSchema,
  requestId: z.string().uuid().optional(),
  message: z
    .string()
    .trim()
    .min(1)
    .max(CHARACTER_CHAT_CONFIG.maxQuestionChars)
    .optional(),
  messages: z.array(z.unknown()).max(CHARACTER_CHAT_CONFIG.maxLegacyMessages).optional(),
})

export type CharacterChatRequest = z.infer<typeof characterChatRequestSchema>
