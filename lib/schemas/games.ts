import { z } from 'zod'
import { slugSchema } from './studio'

/**
 * Zod-схема игры для Studio. Игра не загружается в canfly как контент: в БД
 * живут только метаданные и связи, файлы лежат в `public/games/<slug>/`.
 * Slug обязан совпадать с именем папки — это проверяет форма (HEAD-запрос).
 */

export const gameAspectRatioSchema = z.enum(['16:9', '4:3', '1:1', '9:16'])

/** Пустая строка, null или undefined → null, иначе обрезанная строка. */
const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? null : v.trim()))
  .nullable()

const requiredString = z.string().trim().min(1, 'Поле обязательно')

/** Мультиселект приходит либо набором значений, либо одним значением. */
const uuidList = z.preprocess(
  (v) => (Array.isArray(v) ? v : v == null ? [] : [v]),
  z.array(z.string().uuid('Некорректный идентификатор')),
)

export const gameFormSchema = z.object({
  title: requiredString.max(300, 'Слишком длинное название'),
  slug: slugSchema,
  tagline: optionalString,
  description: optionalString,
  cover_image: optionalString,
  aspect_ratio: gameAspectRatioSchema.catch('16:9'),
  display_order: z.preprocess((v) => {
    const n = typeof v === 'string' ? Number.parseInt(v, 10) : Number(v)
    return Number.isFinite(n) ? n : 0
  }, z.number().int().min(0).max(9999)),
  // Чекбокс без галочки в FormData не приходит вовсе.
  is_published: z.preprocess((v) => v === 'on' || v === 'true' || v === true, z.boolean()),
  character_ids: uuidList,
  release_ids: uuidList,
})

export type GameFormInput = z.infer<typeof gameFormSchema>
