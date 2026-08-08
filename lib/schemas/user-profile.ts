import { z } from 'zod'
import { CANFLY_COLORS } from '@/lib/canfly-colors'

const COLOR_IDS = CANFLY_COLORS.map(c => c.id)

export const identitySchema = z.object({
  display_name: z.string().trim().min(1, 'Введите имя').max(60, 'Не больше 60 символов'),
  tagline: z.string().trim().max(90, 'Не больше 90 символов').optional().default(''),
  bio: z.string().trim().max(600, 'Не больше 600 символов').optional().default(''),
})

export const handleSchema = z.object({
  handle: z
    .string()
    .trim()
    .toLowerCase()
    .regex(
      /^[a-z0-9][a-z0-9_-]{2,23}$/,
      'От 3 до 24 символов: латиница, цифры, дефис и подчёркивание',
    ),
})

export const signatureColorSchema = z.object({
  signature_color: z.string().refine(v => COLOR_IDS.includes(v), 'Неизвестный цвет'),
})

export const visibilitySchema = z.object({
  profile_is_public: z.boolean(),
  show_reading: z.boolean(),
})

export type IdentityInput = z.infer<typeof identitySchema>
export type HandleInput = z.infer<typeof handleSchema>
