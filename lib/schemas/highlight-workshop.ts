import { z } from 'zod'

export const textAnchorSchema = z.object({
  version: z.literal(2), start: z.number().int().min(0), end: z.number().int().min(1),
  exact: z.string().min(3).max(5000), prefix: z.string().max(80), suffix: z.string().max(80), revision: z.string().regex(/^[a-f0-9]{64}$/),
}).refine(a => a.end > a.start && a.end - a.start === a.exact.length)
export const draftSchema = z.object({
  version: z.number().int().positive(), note: z.string().max(2000).nullable(), text: z.string().max(20000),
  requestId: z.string().uuid(), parentId: z.string().uuid().nullable().optional(),
})
export const publicationSchema = z.object({
  version: z.number().int().positive(), published: z.boolean(), includeNote: z.boolean(), materialIds: z.array(z.string().uuid()).max(12),
})
export const generationSchema = z.object({
  highlightId: z.string().uuid(), requestId: z.string().uuid(), instruction: z.string().trim().max(1000).default(''),
  mode: z.enum(['другой-финал', 'другая-эпоха', 'другой-стиль']).default('другой-стиль'),
})
