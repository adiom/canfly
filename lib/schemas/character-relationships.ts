import { z } from 'zod'

import { DEFAULT_RELATIONSHIP_KEYS } from '@/lib/relationships-kinds'

/**
 * Схема для создания/обновления связи Character↔Character.
 *
 * `relationship_type`:
 *   - если значение входит в DEFAULT_RELATIONSHIP_KEYS — принимается;
 *   - иначе требуется явное `custom: true` (защита от опечаток и мусора);
 *   - длина строки ≤ 60 символов (чтобы не словить «Lorem ipsum…»).
 *
 * `description` опционально, но ≤ 600 символов — мы показываем его
 * как «историю связи» в публичной карточке.
 */
export const characterRelationshipSchema = z
  .object({
    characterId: z.string().uuid(),
    relatedCharacterId: z.string().uuid().refine(
      (val) => val !== undefined,
      { message: 'Выберите персонажа для связи' },
    ),
    relationshipType: z
      .string()
      .min(1, 'Укажите тип связи')
      .max(60, 'Тип связи слишком длинный'),
    description: z
      .string()
      .max(600, 'Описание слишком длинное')
      .nullable()
      .optional(),
    custom: z.boolean().optional().default(false),
  })
  .refine(
    (data) => {
      if (DEFAULT_RELATIONSHIP_KEYS.includes(data.relationshipType as never)) {
        return true
      }
      // Не из дефолтного списка → разрешаем только если автор явно отметил custom
      return data.custom === true
    },
    {
      message:
        'Нестандартный тип связи требует подтверждения (отметьте «свой тип»).',
      path: ['relationshipType'],
    },
  )
  .refine(
    (data) => data.characterId !== data.relatedCharacterId,
    {
      message: 'Персонаж не может быть связан сам с собой',
      path: ['relatedCharacterId'],
    },
  )

export type CharacterRelationshipInput = z.infer<typeof characterRelationshipSchema>

/** Схема удаления связи — нужно знать id строки в БД. */
export const deleteCharacterRelationshipSchema = z.object({
  relationshipId: z.string().uuid(),
  characterId: z.string().uuid(),
})

export type DeleteCharacterRelationshipInput = z.infer<typeof deleteCharacterRelationshipSchema>
