import { z } from 'zod'

import {
  APPROVED_MODEL_IDS,
  CHARACTER_AI_LIMITS,
  isApprovedModelId,
} from '@/lib/ai/character-chat/config'

const { temperature, maxOutputTokens, totalTimeoutMs, chunkTimeoutMs, userTurnsPerHour } =
  CHARACTER_AI_LIMITS

/**
 * Форма технических настроек персонажа.
 *
 * Здесь нет prompt, `system_role` или `ai_enabled`: авторская инструкция
 * остаётся единственной в `characters.system_role`, а доступность выводится
 * из существующих полей. Схема проверяет только технические пределы.
 */
export const characterAiSettingsSchema = z
  .object({
    characterId: z.string().uuid('Некорректный id персонажа'),
    modelId: z
      .string()
      .refine(isApprovedModelId, `Недопустимая модель. Разрешены: ${APPROVED_MODEL_IDS.join(', ')}`),
    temperature: z.coerce
      .number()
      .min(temperature.min, 'Temperature ниже допустимого')
      .max(temperature.max, 'Temperature выше допустимого'),
    maxOutputTokens: z.coerce
      .number()
      .int('Output должен быть целым числом')
      .min(maxOutputTokens.min, 'Слишком маленький output')
      .max(maxOutputTokens.max, 'Слишком большой output'),
    totalTimeoutMs: z.coerce
      .number()
      .int('Таймаут должен быть целым числом')
      .min(totalTimeoutMs.min, 'Слишком маленький общий таймаут')
      .max(totalTimeoutMs.max, 'Слишком большой общий таймаут'),
    chunkTimeoutMs: z.coerce
      .number()
      .int('Таймаут чанка должен быть целым числом')
      .min(chunkTimeoutMs.min, 'Слишком маленький таймаут чанка')
      .max(chunkTimeoutMs.max, 'Слишком большой таймаут чанка'),
    userTurnsPerHour: z.coerce
      .number()
      .int('Лимит должен быть целым числом')
      .min(userTurnsPerHour.min, 'Слишком маленький лимит')
      .max(userTurnsPerHour.max, 'Слишком большой лимит'),
  })
  .refine((value) => value.chunkTimeoutMs < value.totalTimeoutMs, {
    message: 'Таймаут чанка должен быть меньше общего таймаута',
    path: ['chunkTimeoutMs'],
  })

export type CharacterAiSettingsInput = z.infer<typeof characterAiSettingsSchema>

/** Первое сообщение Zod — для компактного показа в форме. */
export function firstZodMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? 'Некорректные настройки'
}
