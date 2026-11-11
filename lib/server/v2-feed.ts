import 'server-only'

import { z } from 'zod'
import { dbQuery } from '@/lib/db'
import { chapterPlainText } from '@/lib/server/highlight-source'
import { relationshipLabel } from '@/lib/relationships-kinds'
import { FEED_KINDS, type FeedItem, type FeedKind, type FeedPage } from '@/lib/v2-feed'

const PAGE_SIZE = 10
const positionSchema = z.object({ stamp: z.string().datetime(), id: z.string().uuid() }).strict()
const cursorSchema = z.object({
  version: z.literal(1),
  snapshot: z.string().datetime(),
  turn: z.number().int().min(0).max(4),
  after: z.object({
    excerpt: positionSchema.optional(), place: positionSchema.optional(),
    relationship: positionSchema.optional(), thought: positionSchema.optional(), quote: positionSchema.optional(),
  }).strict(),
}).strict()
type Cursor = z.infer<typeof cursorSchema>
interface Row { id: string; stamp: string }
type Candidate = Row & { item: FeedItem }

export class InvalidFeedCursor extends Error {}

export function parseFeedCursor(value?: string | null): Cursor {
  if (!value) return { version: 1, snapshot: new Date().toISOString(), turn: 0, after: {} }
  try {
    if (value.length > 3000 || !/^[A-Za-z0-9_-]+$/.test(value)) throw new Error()
    const result = cursorSchema.parse(JSON.parse(Buffer.from(value, 'base64url').toString('utf8')))
    if (Date.parse(result.snapshot) > Date.now() + 60_000) throw new Error()
    return result
  } catch {
    throw new InvalidFeedCursor('Некорректный курсор ленты')
  }
}

function encode(cursor: Cursor): string {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url')
}

function plain(value: string | null, max = 650): string {
  const text = chapterPlainText(value ?? '')
  if (text.length <= max) return text
  const cut = text.slice(0, max)
  const space = cut.lastIndexOf(' ')
  return `${cut.slice(0, space > max / 2 ? space : max).trimEnd()}…`
}

export function excerptParagraphs(html: string): string[] {
  const parts = html.split(/<\/(?:p|div|blockquote|h[1-6])\s*>|<br\s*\/?\s*>|\r?\n\s*\r?\n/i)
    .map((part) => plain(part, 650)).filter(Boolean)
  const result: string[] = []
  let length = 0
  for (const part of parts) {
    if (result.length >= 3 || (length > 500 && length + part.length > 1100)) break
    result.push(part)
    length += part.length
  }
  return result
}

/** Each source uses a bounded keyset query, including a UUID tie-breaker.
 * Preserve PostgreSQL microseconds in cursors, rather than rounding via Date.
 */
function paging(kind: FeedKind, cursor: Cursor) {
  const after = cursor.after[kind]
  return [cursor.snapshot, after?.stamp ?? null, after?.id ?? null, PAGE_SIZE + 1]
}

const stamp = (alias: string) => `to_char(${alias}.created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS stamp`
const where = (alias: string) => `${alias}.created_at <= $1::timestamptz
  AND ($2::timestamptz IS NULL OR (${alias}.created_at, ${alias}.id) < ($2::timestamptz, $3::uuid))`
const order = (alias: string) => `ORDER BY ${alias}.created_at DESC, ${alias}.id DESC LIMIT $4`

async function excerpts(cursor: Cursor): Promise<Candidate[]> {
  const rows = await dbQuery<Row & { title: string; content: string; source: string; slug: string }>(`
    SELECT ch.id, ${stamp('ch')}, ch.title, LEFT(ch.content, 16000) AS content,
      r.title AS source, e.slug
    FROM chapters ch JOIN editions e ON e.id=ch.edition_id JOIN releases r ON r.id=e.release_id
    WHERE ch.status='published' AND e.status='published' AND r.status='published'
      AND e.format IN ('book','magazine') AND NULLIF(trim(ch.content),'') IS NOT NULL
      AND e.id=(SELECT candidate.id FROM editions candidate
        WHERE candidate.release_id=e.release_id AND candidate.status='published'
          AND candidate.format IN ('book','magazine') AND candidate.created_at <= $1::timestamptz
          AND EXISTS (SELECT 1 FROM chapters available WHERE available.edition_id=candidate.id
            AND available.status='published' AND NULLIF(trim(available.content),'') IS NOT NULL)
        ORDER BY candidate.is_primary DESC, candidate.created_at, candidate.id LIMIT 1)
      -- Discover a work through its beginning, rather than exposing a late chapter spoiler.
      AND NOT EXISTS (SELECT 1 FROM chapters earlier WHERE earlier.edition_id=ch.edition_id
        AND earlier.status='published' AND NULLIF(trim(earlier.content),'') IS NOT NULL
        AND (earlier.chapter_index, earlier.id)<(ch.chapter_index,ch.id))
      AND ${where('ch')} ${order('ch')}`, paging('excerpt', cursor))
  return rows.map((row) => ({ ...row, item: {
    id: `excerpt:${row.id}`, kind: 'excerpt', title: row.title, source: row.source,
    href: `/vvvvv/${encodeURIComponent(row.slug)}?chapter=${row.id}`, paragraphs: excerptParagraphs(row.content),
  } }))
}

async function places(cursor: Cursor): Promise<Candidate[]> {
  const rows = await dbQuery<Row & {
    name: string; slug: string; image: string | null; description: string | null; era: string | null;
    residents: { name: string; href: string; avatar: string | null }[];
  }>(`SELECT p.id, ${stamp('p')}, p.name, p.slug, COALESCE(p.avatar,p.map_image_url) AS image,
    LEFT(COALESCE(NULLIF(p.full_description,''),p.bio),3000) AS description, p.era,
    COALESCE((SELECT json_agg(person) FROM (
      SELECT c.name, '/characters/' || c.slug AS href, c.avatar
      FROM character_places cp JOIN characters c ON c.id=cp.character_id
      WHERE cp.place_id=p.id AND c.character_type='person' ORDER BY c.name, c.id LIMIT 4
    ) person),'[]'::json) AS residents
    FROM places p WHERE ${where('p')} ${order('p')}`, paging('place', cursor))
  return rows.map((row) => ({ ...row, item: {
    id: `place:${row.id}`, kind: 'place', title: row.name, href: `/places/${encodeURIComponent(row.slug)}`,
    image: row.image ?? (row.slug === 'N' ? '/images/v2/city-n.webp' : null),
    illustrated: !row.image && row.slug === 'N', description: plain(row.description, 560), era: row.era,
    residents: row.residents,
  } }))
}

async function relationships(cursor: Cursor): Promise<Candidate[]> {
  const rows = await dbQuery<Row & {
    relationship_type: string; description: string | null;
    from_name: string; from_slug: string; from_avatar: string | null;
    to_name: string; to_slug: string; to_avatar: string | null;
  }>(`SELECT rel.id, ${stamp('rel')}, rel.relationship_type, LEFT(rel.description,2000) AS description,
    a.name AS from_name, a.slug AS from_slug, a.avatar AS from_avatar,
    b.name AS to_name, b.slug AS to_slug, b.avatar AS to_avatar
    FROM character_relationships rel JOIN characters a ON a.id=rel.character_id
    JOIN characters b ON b.id=rel.related_character_id
    WHERE a.character_type='person' AND b.character_type='person' AND a.id<>b.id
      AND ${where('rel')}
      AND NOT EXISTS (SELECT 1 FROM character_relationships inverse
        WHERE inverse.character_id=rel.related_character_id AND inverse.related_character_id=rel.character_id
          AND inverse.relationship_type=rel.relationship_type AND inverse.id<rel.id)
    ${order('rel')}`, paging('relationship', cursor))
  return rows.map((row) => ({ ...row, item: {
    id: `relationship:${row.id}`, kind: 'relationship', label: relationshipLabel(row.relationship_type),
    description: plain(row.description, 500),
    from: { name: row.from_name, href: `/characters/${encodeURIComponent(row.from_slug)}`, avatar: row.from_avatar },
    to: { name: row.to_name, href: `/characters/${encodeURIComponent(row.to_slug)}`, avatar: row.to_avatar },
  } }))
}

async function thoughts(cursor: Cursor): Promise<Candidate[]> {
  const rows = await dbQuery<Row & { content: string; image_url: string | null; name: string; slug: string; avatar: string | null }>(`
    SELECT post.id, ${stamp('post')}, LEFT(post.content,2400) AS content, post.image_url, c.name, c.slug, c.avatar
    FROM character_posts post JOIN characters c ON c.id=post.character_id
    WHERE c.character_type='person' AND (post.scheduled_at IS NULL OR post.scheduled_at <= $1::timestamptz)
      AND NULLIF(trim(post.content),'') IS NOT NULL AND ${where('post')} ${order('post')}`, paging('thought', cursor))
  return rows.map((row) => ({ ...row, item: {
    id: `thought:${row.id}`, kind: 'thought', text: plain(row.content, 1200), image: row.image_url,
    person: { name: row.name, href: `/characters/${encodeURIComponent(row.slug)}`, avatar: row.avatar },
  } }))
}

async function quotes(cursor: Cursor): Promise<Candidate[]> {
  const rows = await dbQuery<Row & { text_content: string; source: string }>(`
    SELECT h.id, ${stamp('h')}, LEFT(h.text_content,1500) AS text_content, r.title AS source
    FROM chapter_highlights h JOIN chapters ch ON ch.id=h.chapter_id
    JOIN editions e ON e.id=ch.edition_id JOIN releases r ON r.id=e.release_id
    WHERE h.is_public AND h.publication IS NOT NULL AND ch.status='published'
      AND e.status='published' AND r.status='published' AND NULLIF(trim(h.text_content),'') IS NOT NULL
      AND ${where('h')} ${order('h')}`, paging('quote', cursor))
  return rows.map((row) => ({ ...row, item: {
    id: `quote:${row.id}`, kind: 'quote', text: plain(row.text_content, 650), source: row.source, href: `/highlight/${row.id}`,
  } }))
}

export async function getV2FeedPage(value?: string | null): Promise<FeedPage> {
  const cursor = parseFeedCursor(value)
  const startCursor = encode(cursor)
  const sources = await Promise.all([excerpts(cursor), places(cursor), relationships(cursor), thoughts(cursor), quotes(cursor)])
  const consumed = [0, 0, 0, 0, 0]
  const items: FeedItem[] = []
  let misses = 0
  while (items.length < PAGE_SIZE && misses < FEED_KINDS.length) {
    const index = cursor.turn
    cursor.turn = (index + 1) % FEED_KINDS.length
    const row = sources[index][consumed[index]]
    if (!row) { misses++; continue }
    misses = 0
    consumed[index]++
    cursor.after[FEED_KINDS[index]] = { stamp: row.stamp, id: row.id }
    // HTML-only/empty excerpts must advance the cursor without producing blank cards.
    if (row.item.kind !== 'excerpt' || row.item.paragraphs.length) items.push(row.item)
  }
  const hasMore = sources.some((rows, index) => rows.length > consumed[index] || rows.length === PAGE_SIZE + 1)
  return { items, nextCursor: hasMore ? encode(cursor) : null, startCursor }
}
