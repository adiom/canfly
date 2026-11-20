import { test, expect } from '@playwright/test'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import type { FeedItem } from '../../lib/v2-feed'

/**
 * Регрессии публичной ленты /v2 без БД и без браузера: маркер server-only и
 * запросы к lib/db подменяются через require.cache, сама логика ленты
 * тестируется как есть — вместе с SQL и параметрами keyset-пагинации.
 */

type Row = Record<string, unknown>
interface Captured { sql: string; params: unknown[] }

const queries: Captured[] = []
let rowsFor: (sql: string) => Row[] = () => []

function stubModule(filename: string, exports: Record<string, unknown>): void {
  require.cache[filename] = {
    id: filename, filename, loaded: true, exports, children: [], paths: [],
  } as unknown as NodeJS.Module
}

// Тот же приём, что в reader-preview.spec.ts: модули серверного слоя подменяются
// до загрузки ленты, поэтому require идёт через createRequire, а не через import.
const nativeRequire = createRequire(resolve('package.json'))

stubModule(nativeRequire.resolve('server-only'), {})
stubModule(nativeRequire.resolve('./lib/db'), {
  dbQuery: async (sql: string, params: unknown[] = []) => {
    queries.push({ sql, params })
    return rowsFor(sql)
  },
})

const feed = nativeRequire('./lib/server/v2-feed') as typeof import('../../lib/server/v2-feed')

const UUID = '11111111-1111-4111-8111-111111111111'
const STAMP = '2026-11-19T00:00:00.000000Z'

async function runFeed(makeRows: (sql: string) => Row[], cursor?: string) {
  queries.length = 0
  rowsFor = makeRows
  return feed.getV2FeedPage(cursor ?? null)
}

function thoughtQuery(): Captured {
  const query = queries.find((entry) => entry.sql.includes('FROM character_posts post'))
  expect(query, 'запрос записей персонажа должен быть выполнен').toBeDefined()
  return query as Captured
}

function rowsWithThought(content: string) {
  return (sql: string): Row[] => sql.includes('FROM character_posts post')
    ? [{ id: UUID, stamp: STAMP, content, image_url: null, name: 'Соня', slug: 'sonya', avatar: null }]
    : []
}

function encodeCursor(snapshot: string): string {
  return Buffer.from(JSON.stringify({ version: 1, snapshot, turn: 0, after: {} })).toString('base64url')
}

function findKind<K extends FeedItem['kind']>(items: FeedItem[], kind: K) {
  return items.find((item): item is Extract<FeedItem, { kind: K }> => item.kind === kind)
}

test('scheduled posts are visible only after the database clock, not the cursor snapshot', async () => {
  // Допустимое будущее значение: parseFeedCursor разрешает небольшой увод часов,
  // поэтому видимость не может зависеть от этой строки.
  const snapshot = new Date(Date.now() + 59_000).toISOString()
  const cursor = encodeCursor(snapshot)
  expect(feed.parseFeedCursor(cursor).snapshot).toBe(snapshot)

  const page = await runFeed(rowsWithThought('Запланированная запись'), cursor)
  const query = thoughtQuery()

  expect(query.sql).toMatch(/\(post\.scheduled_at IS NULL OR post\.scheduled_at <= NOW\(\)\)/)
  expect(query.sql).not.toMatch(/scheduled_at\s*<=\s*\$\d/)
  // Keyset-пагинация продолжает использовать снимок курсора как верхнюю границу.
  expect(query.sql).toContain('post.created_at <= $1::timestamptz')
  expect(query.params).toEqual([snapshot, null, null, 11])
  expect(findKind(page.items, 'thought')?.text).toBe('Запланированная запись')

  // Первый запрос без курсора должен опираться на часы базы так же.
  await runFeed(rowsWithThought('Запись первого экрана'))
  expect(thoughtQuery().sql).toMatch(/post\.scheduled_at <= NOW\(\)/)
})

test('plain-text post and highlight fields keep literal angle brackets and entities', async () => {
  const post = 'Код в угловых скобках: <main> и <b>жирный</b>, плюс &amp; хвост.'
  const quote = 'Цитата с <main> внутри и знаком 2 < 3.'

  const page = await runFeed((sql) => {
    if (sql.includes('FROM character_posts post')) {
      return [{ id: UUID, stamp: STAMP, content: post, image_url: null, name: 'Соня', slug: 'sonya', avatar: null }]
    }
    if (sql.includes('FROM chapter_highlights h')) {
      return [{ id: UUID, stamp: STAMP, text_content: quote, source: 'Книга' }]
    }
    return []
  })

  expect(findKind(page.items, 'thought')?.text).toBe(post)
  expect(findKind(page.items, 'quote')?.text).toBe(quote)
})

test('chapter excerpts are still extracted from HTML before clipping', async () => {
  const content = '<p>Первый <em>акцент</em> &amp; конец.</p><p>Второй абзац.</p>'
  const page = await runFeed((sql) => sql.includes('FROM chapters ch')
    ? [{ id: UUID, stamp: STAMP, title: 'Глава', content, source: 'Книга', slug: 'kniga' }]
    : [])

  const excerpt = findKind(page.items, 'excerpt')
  expect(excerpt?.paragraphs).toEqual(['Первый акцент & конец.', 'Второй абзац.'])
  expect(feed.excerptParagraphs('<p>Тег <main>метка</main> остаётся текстом</p>')).toEqual(['Тег метка остаётся текстом'])
})
