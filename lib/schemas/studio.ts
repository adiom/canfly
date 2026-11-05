import { z } from 'zod'
import { RELEASE_BLOCKS, RELEASE_HERO_ART } from '@/lib/release-design'

/**
 * Zod-схемы для Studio server actions (release / edition / chapter / series).
 * Валидируют FormData (всё string/null), приводят к нужным типам и проверяют
 * enum'ы, соответствующие postgres-типам (см. postgres/002_release_system.sql).
 *
 * Ранее actions передавали formData.get(...) в БД напрямую без какой-либо
 * валидации — теперь статус/формат проверяются против enum.
 */

// --- Enum'ы, синхронизированные с postgres types ---

export const releaseStatusSchema = z.enum(['draft', 'published', 'archived'])
export const editionStatusSchema = z.enum(['draft', 'published', 'archived'])
export const editionFormatSchema = z.enum(['book', 'comic', 'audiobook', 'audiorelease', 'album', 'magazine', 'digital', 'artwork'])
export const chapterStatusSchema = z.enum(['draft', 'published'])
export const qualityTierSchema = z.enum(['draft', 'standard', 'premium'])
export const artworkUrlSchema = z.union([
  z.string().trim().url().max(2048).refine((value) => {
    try {
      return new URL(value).protocol === 'https:'
    } catch {
      return false
    }
  }, 'Ссылка на изображение должна использовать HTTPS'),
  z.null(),
])

// --- Общие хелперы для FormData (значения приходят строкой или null) ---

/** Пустая строка, null или undefined → null, иначе обрезанная строка. */
const optionalString = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v == null || v === '' ? null : v.trim()))
  .nullable()

/** Строка-обязательная; trim, минимум 1 символ. */
const requiredString = z
  .string()
  .trim()
  .min(1, 'Поле обязательно')

/** Slug: латиница/цифры/дефис. Общий для всех Studio-сущностей (в т.ч. игр). */
export const slugSchema = z
  .string()
  .trim()
  .min(1, 'Slug обязателен')
  .regex(
    /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
    'Slug: только латиница, цифры и дефисы',
  )

// --- Release ---

const designColor = z.string().regex(/^#[a-f\d]{6}$/i)
const releaseBlocks = z.array(z.enum(RELEASE_BLOCKS)).max(RELEASE_BLOCKS.length)
  .refine(blocks => new Set(blocks).size === blocks.length)

export const releaseDesignSchema = z.object({
  block_order: releaseBlocks,
  hidden_blocks: releaseBlocks,
  cover_fit: z.enum(['cover', 'contain']),
  accent_color: designColor,
  bg_color: designColor,
  text_color: designColor,
  hero_style: z.enum(['full', 'centered', 'minimal']),
  hero_overlay: z.enum(['dark', 'gradient', 'none']),
  hero_art: z.enum(RELEASE_HERO_ART),
  layout: z.enum(['wide', 'narrow', 'sidebar']),
  show_toc: z.boolean(),
  show_characters: z.boolean(),
  show_series: z.boolean(),
}).partial()

export const releaseWorldLinkSchema = z.object({
  id: z.string().uuid(),
  kind: z.enum(['game', 'place']),
  linked: z.boolean(),
})

export const releaseFormSchema = z.object({
  title: requiredString.max(300, 'Слишком длинное название'),
  slug: slugSchema,
  description: optionalString,
  cover_image: optionalString,
  genre: optionalString,
  release_date: optionalString,
  isbn: optionalString,
  authors: z.preprocess(
    (v) => {
      if (typeof v === 'string') {
        try { return JSON.parse(v) } catch { return [] }
      }
      return Array.isArray(v) ? v : []
    },
    z.array(z.any()),
  ),
  annotation: optionalString,
  editor_notes: optionalString,
  status: releaseStatusSchema.default('draft'),
  // Флаг листинга /releases. Опционален без default: отсутствующий ключ в
  // updateReleaseAction означает «не менять» (dbUpdatePartial пропускает
  // undefined), иначе апдейт без поля сбрасывал бы флаг — старый баг
  // is_primary у изданий. '' и null вместо булева означают false.
  show_in_catalog: z
    .union([z.literal('true'), z.literal('false'), z.literal(''), z.null()])
    .transform((v) => v === 'true')
    .optional(),
})

// --- Edition ---

export const editionFormSchema = z.object({
  release_id: requiredString,
  format: editionFormatSchema.default('book'),
  platform: optionalString,
  external_url: optionalString,
  // Слаг собирает сервер из слага релиза — форма его не присылает. Поле
  // оставлено опциональным для импорта и ручных сценариев.
  slug: slugSchema.optional(),
  quality_tier: qualityTierSchema.default('standard'),
  is_primary: z
  .union([z.literal('true'), z.literal('false'), z.literal(''), z.null(), z.undefined()])
  .transform((v) => v === 'true')
  .default('false'),
})

// --- Chapter ---

export const chapterFormSchema = z.object({
  edition_id: requiredString,
  title: optionalString,
})

export const lyricLineSchema = z.object({
  text: z.string().min(1),
  time: z.number().nonnegative().optional(),
})

export const lyricsSchema = z.object({
  format: z.enum(['synced', 'plain']),
  lines: z.array(lyricLineSchema).min(1),
})

export const chapterUpdateSchema = z.object({
  title: optionalString.optional(),
  content: optionalString.optional(),
  audio_url: optionalString.optional(),
  audio_blob_path: optionalString.optional(),
  duration_seconds: z.number().int().nonnegative().nullable().optional(),
  audio_metadata: z.record(z.unknown()).nullable().optional(),
  audio_content_type: optionalString.optional(),
  audio_file_size_bytes: z.number().int().nonnegative().nullable().optional(),
  audio_uploaded_at: optionalString.optional(),
  chapter_index: z.number().int().min(1).optional(),
})

// --- Series ---

export const seriesFormSchema = z.object({
  title: requiredString.max(200, 'Слишком длинное название'),
  slug: slugSchema,
  description: optionalString,
})

/** Достаёт первое человекочитаемое сообщение об ошибке из ZodError. */
export function formatZodError(error: z.ZodError): string {
  const first = error.issues[0]
  if (!first) return 'Ошибка валидации'
  return first.message
}
