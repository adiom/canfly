import { z } from 'zod'

const uuid = z.string().uuid()
const nullableText = (max: number) => z.string().trim().max(max).nullable().optional()

export const createHighlightSchema = z.object({
  chapter_id: uuid,
  client_request_id: uuid.optional(),
  text_content: z.string().trim().min(3).max(5000),
  paragraph_index: z.number().int().min(0).nullable().optional(),
  start_offset: z.number().int().min(0).nullable().optional(),
  end_offset: z.number().int().min(0).nullable().optional(),
  context_before: nullableText(120),
  context_after: nullableText(120),
  note: nullableText(2000),
  is_public: z.boolean().default(false),
}).refine(data => data.start_offset == null || data.end_offset == null || data.end_offset >= data.start_offset, {
  message: 'end_offset must be greater than or equal to start_offset',
  path: ['end_offset'],
})

export const updateHighlightSchema = z.object({
  note: nullableText(2000),
  is_public: z.boolean().optional(),
}).refine(data => data.note !== undefined || data.is_public !== undefined, {
  message: 'No fields to update',
})

export const createEditorialNoteSchema = z.object({
  chapter_id: uuid,
  client_request_id: uuid.optional(),
  text_content: z.string().trim().min(1).max(5000),
  paragraph_index: z.number().int().min(0).nullable().optional(),
  start_offset: z.number().int().min(0).nullable().optional(),
  end_offset: z.number().int().min(0).nullable().optional(),
  context_before: nullableText(120),
  context_after: nullableText(120),
  note: z.string().trim().min(1).max(2000),
}).refine(data => data.start_offset == null || data.end_offset == null || data.end_offset >= data.start_offset, {
  message: 'end_offset must be greater than or equal to start_offset',
  path: ['end_offset'],
})

export const editorialStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'ignored']),
})

export const setHighlightLikeSchema = z.object({ liked: z.boolean() })
