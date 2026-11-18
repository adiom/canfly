import { z } from 'zod'

export const FEED_KINDS = ['excerpt', 'place', 'relationship', 'thought', 'quote'] as const
export type FeedKind = typeof FEED_KINDS[number]

const person = z.object({ name: z.string(), href: z.string(), avatar: z.string().nullable() })
const base = { id: z.string(), kind: z.enum(FEED_KINDS) }

/** Public, deliberately small DTOs. No character prompts or private notes. */
export const feedItemSchema = z.discriminatedUnion('kind', [
  z.object({ ...base, kind: z.literal('excerpt'), title: z.string(), source: z.string(), href: z.string(), paragraphs: z.array(z.string()).max(4) }),
  z.object({ ...base, kind: z.literal('place'), title: z.string(), href: z.string(), image: z.string().nullable(), illustrated: z.boolean(), description: z.string(), era: z.string().nullable(), residents: z.array(person).max(4) }),
  z.object({ ...base, kind: z.literal('relationship'), label: z.string(), description: z.string(), from: person, to: person }),
  z.object({ ...base, kind: z.literal('thought'), person, text: z.string(), image: z.string().nullable() }),
  z.object({ ...base, kind: z.literal('quote'), text: z.string(), source: z.string(), href: z.string() }),
])

export const feedPageSchema = z.object({
  items: z.array(feedItemSchema).max(10),
  nextCursor: z.string().nullable(),
  startCursor: z.string(),
})
export type FeedItem = z.infer<typeof feedItemSchema>
export type FeedPage = z.infer<typeof feedPageSchema>
