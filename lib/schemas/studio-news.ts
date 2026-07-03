import { z } from 'zod'

export const newsStatusSchema = z.enum(['draft', 'published', 'archived'])

export const newsFormSchema = z.object({
  title: z
    .string()
    .trim()
    .min(1, 'Заголовок обязателен')
    .max(300, 'Слишком длинное название'),
  section: z
    .string()
    .trim()
    .min(1, 'Раздел обязателен')
    .max(100, 'Слишком длинное название раздела'),
  tag: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null || v === '' ? null : v.trim()))
    .nullable(),
  content: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null ? null : v))
    .nullable(),
  cover_image: z
    .union([z.string(), z.null(), z.undefined()])
    .transform((v) => (v == null || v === '' ? null : v.trim()))
    .nullable(),
})
