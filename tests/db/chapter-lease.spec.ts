import { randomUUID } from 'node:crypto'
import { expect, test as base } from '@playwright/test'
import { createDedicatedDatabaseClient, dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import type { Chapter } from '@/lib/releases-types'
import { ChapterWriteError } from '@/lib/studio/chapter-write'
import {
  acquireChapterLease,
  acquireChapterLeaseOnClient,
  fetchChapterLease,
  releaseChapterLease,
  renewChapterLease,
  withChapterLease,
  type ChapterLease,
  type ChapterLeaseGrant,
} from '@/lib/server/chapter-leases'
import {
  createChapter,
  deleteChapter,
  fetchChapterById,
  fetchChapterVersions,
  publishChapter,
  reorderChapters,
  restoreChapterVersion,
  updateChapter,
} from '@/lib/server/chapters'
import { createEdition, deleteEdition } from '@/lib/server/editions'
import { createRelease, deleteRelease } from '@/lib/server/releases'
import { advisoryLockKey } from '@/lib/server/advisory-locks'

const original = '<p>Original chapter</p>'
const edited = '<p>Edited chapter</p>'

interface LeaseFixture {
  chapter: Chapter
  userId: string
  releaseId: string
  editionId: string
}

const test = base.extend<{ sandbox: LeaseFixture }>({
  sandbox: async ({}, applyFixture) => {
    const slug = `lease-${randomUUID()}`
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const release = await createRelease({ title: 'Lease release', slug, status: 'draft' })
    let userId: string | null = null
    try {
      const edition = await createEdition({ release_id: release.id, slug, status: 'draft' })
      const chapter = await createChapter({
        edition_id: edition.id,
        chapter_index: 1,
        title: 'Lease chapter',
        content: original,
        status: 'draft',
        word_count: 2,
      })
      const user = await dbQueryOne<{ id: string }>(
        `INSERT INTO users (login, email, handle, display_name, public_role, is_admin)
         VALUES ($1, $2, $1, 'Lease Tester', 'author', TRUE) RETURNING id`,
        [`lease_${suffix}`, `lease-${suffix}@canfly.test`],
      )
      if (!chapter || !user) throw new Error('Expected lease fixture')
      userId = user.id
      await applyFixture({ chapter, userId: user.id, releaseId: release.id, editionId: edition.id })
    } finally {
      await dbQuery('DELETE FROM releases WHERE id = $1', [release.id])
      if (userId) await dbQuery('DELETE FROM users WHERE id = $1', [userId])
    }
  },
})

function sessionGrant(userId: string, lease: ChapterLease): ChapterLeaseGrant {
  return {
    mode: 'session',
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  }
}

function implicitGrant(userId: string, sessionId = 'mcp-session'): ChapterLeaseGrant {
  return { mode: 'implicit', actor: { userId, actorKind: 'mcp' }, sessionId }
}

async function leaseFor(userId: string, chapterId: string) {
  const acquired = await acquireChapterLease({
    chapterId,
    sessionId: `session-${randomUUID()}`,
    documentId: `doc-${randomUUID()}`,
    actor: { userId, actorKind: 'studio' },
  })
  if (!acquired.ok) throw new Error('Expected a free chapter lease')
  return acquired.lease
}

async function expireLease(chapterId: string) {
  await dbQuery(
    `UPDATE chapter_edit_leases
     SET acquired_at = now() - INTERVAL '2 minutes', expires_at = now() - INTERVAL '1 minute'
     WHERE chapter_id = $1`,
    [chapterId],
  )
}

test('acquires, reports, renews and releases a lease', async ({ sandbox: { chapter, userId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  expect(lease).toMatchObject({ chapterId: chapter.id, userId, actorKind: 'studio', generation: 1 })
  expect(Date.parse(lease.expiresAt)).toBeGreaterThan(Date.now())

  const holder = await fetchChapterLease(chapter.id)
  expect(holder).toMatchObject({ userId, actorKind: 'studio', displayName: 'Lease Tester' })

  const renewed = await renewChapterLease({
    chapterId: chapter.id,
    sessionId: lease.sessionId,
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  })
  expect(renewed.ok).toBe(true)

  expect(await releaseChapterLease({
    chapterId: chapter.id,
    sessionId: lease.sessionId,
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  })).toBe(true)
  expect(await fetchChapterLease(chapter.id)).toBeNull()
})

test('keeps the same chapter locked for a second session and frees it after TTL', async ({ sandbox: { chapter, userId } }) => {
  const first = await leaseFor(userId, chapter.id)
  const second = await acquireChapterLease({
    chapterId: chapter.id,
    sessionId: `session-${randomUUID()}`,
    documentId: `doc-${randomUUID()}`,
    actor: { userId, actorKind: 'studio' },
  })
  expect(second).toMatchObject({ ok: false, holder: { userId, actorKind: 'studio' } })

  await expireLease(chapter.id)
  const third = await acquireChapterLease({
    chapterId: chapter.id,
    sessionId: `session-${randomUUID()}`,
    documentId: `doc-${randomUUID()}`,
    actor: { userId, actorKind: 'studio' },
  })
  expect(third.ok).toBe(true)
  if (!third.ok) return
  expect(third.lease.generation).toBe(first.generation + 1)

  const renewed = await renewChapterLease({
    chapterId: chapter.id,
    sessionId: first.sessionId,
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: first.sessionId, token: first.token, generation: first.generation },
  })
  expect(renewed.ok).toBe(false)
})

test('H4: та же сессия с другим документом не перехватывает активный lease', async ({ sandbox: { chapter, userId } }) => {
  const sessionId = `session-${randomUUID()}`
  const documentId = `doc-${randomUUID()}`
  const first = await acquireChapterLease({
    chapterId: chapter.id,
    sessionId,
    documentId,
    actor: { userId, actorKind: 'studio' },
  })
  expect(first.ok).toBe(true)
  if (!first.ok) return

  const duplicate = await acquireChapterLease({
    chapterId: chapter.id,
    sessionId,
    documentId: `doc-${randomUUID()}`,
    actor: { userId, actorKind: 'studio' },
  })
  expect(duplicate).toMatchObject({ ok: false, holder: { userId, actorKind: 'studio' } })

  const sameDocument = await acquireChapterLease({
    chapterId: chapter.id,
    sessionId,
    documentId,
    actor: { userId, actorKind: 'studio' },
  })
  expect(sameDocument.ok).toBe(true)
  if (!sameDocument.ok) return
  expect(sameDocument.lease.generation).toBe(first.lease.generation + 1)

  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, first.lease),
  })).rejects.toMatchObject({ code: 'lease-lost' })
})

test('rejects stale tokens and generations after a new holder appears', async ({ sandbox: { chapter, userId } }) => {
  const first = await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)
  const second = await leaseFor(userId, chapter.id)

  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, first),
  })).rejects.toMatchObject({ code: 'lease-lost' })

  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, second),
  })).resolves.toMatchObject({ content: edited })
})

test('rejects writes without a live lease and keeps history untouched', async ({ sandbox: { chapter, userId } }) => {
  const lease = await leaseFor(userId, chapter.id)

  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, {
      ...lease,
      userId: null,
      sessionId: 'another-session',
    }),
  })).rejects.toMatchObject({ code: 'lease-lost' })
  expect(await fetchChapterById(chapter.id)).toEqual(chapter)
  expect(await fetchChapterVersions(chapter.id)).toEqual([])

  await expect(releaseChapterLease({
    chapterId: chapter.id,
    sessionId: lease.sessionId,
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  })).resolves.toBe(true)
  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, lease),
  })).rejects.toMatchObject({ code: 'lease-lost' })
})

test('implicit MCP lease writes only a free chapter and releases in the same transaction', async ({ sandbox: { chapter, userId } }) => {
  const saved = await updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: implicitGrant(userId),
  })
  expect(saved).toMatchObject({ content: edited, revision: chapter.revision + 1 })
  expect(await fetchChapterLease(chapter.id)).toBeNull()
  expect(await fetchChapterVersions(chapter.id)).toMatchObject([{ content: original }])
})

test('implicit MCP lease cannot evict an active Studio session', async ({ sandbox: { chapter, userId } }) => {
  await leaseFor(userId, chapter.id)

  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: implicitGrant(userId),
  })).rejects.toMatchObject({ code: 'lease-held' })
  expect(await fetchChapterById(chapter.id)).toEqual(chapter)
  expect(await fetchChapterVersions(chapter.id)).toEqual([])
  expect(await fetchChapterLease(chapter.id)).toMatchObject({ userId })

  await expect(publishChapter(chapter.id, {
    expectedRevision: chapter.revision,
    lease: implicitGrant(userId),
  })).rejects.toMatchObject({ code: 'lease-held' })
})

test('restore, publish and delete require the active lease and revision', async ({ sandbox: { chapter, userId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  const first = await updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, lease),
  })
  const history = await fetchChapterVersions(chapter.id)
  expect(history).toMatchObject([{ content: original }])
  expect(first).toMatchObject({ revision: chapter.revision + 1 })

  await expect(restoreChapterVersion(chapter.id, history[0].id, {
    expectedRevision: chapter.revision + 1,
    lease: {
      mode: 'session',
      actor: { userId, actorKind: 'studio' },
      proof: { sessionId: 'other-session', token: '0'.repeat(64), generation: lease.generation },
    },
  })).rejects.toMatchObject({ code: 'lease-lost' })

  await expect(restoreChapterVersion(chapter.id, history[0].id, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, lease),
  })).rejects.toMatchObject({ code: 'conflict' })

  await expect(publishChapter(chapter.id, {
    expectedRevision: chapter.revision + 1,
    lease: sessionGrant(userId, lease),
  })).resolves.toMatchObject({ status: 'published' })

  await expect(deleteChapter(chapter.id, {
    expectedRevision: chapter.revision + 1,
    lease: implicitGrant(userId),
  })).rejects.toMatchObject({ code: 'lease-held' })
})

test('the lease still requires the expected revision', async ({ sandbox: { chapter, userId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  await updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, lease),
  })
  await expect(updateChapter(chapter.id, { content: original }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, lease),
  })).rejects.toMatchObject({ code: 'conflict' })
  expect(await fetchChapterVersions(chapter.id)).toHaveLength(1)
})

test('two PostgreSQL connections acquire exactly one lease', async ({ sandbox: { chapter, userId } }) => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const first = createDedicatedDatabaseClient({ connectionString: url })
  const second = createDedicatedDatabaseClient({ connectionString: url })
  await first.connect()
  await second.connect()
  try {
    await first.query('BEGIN')
    const won = await acquireChapterLeaseOnClient(first, {
      chapterId: chapter.id,
      sessionId: 'race-a-session',
      documentId: 'race-a-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(won.ok).toBe(true)

    await second.query('BEGIN')
    const pending = acquireChapterLeaseOnClient(second, {
      chapterId: chapter.id,
      sessionId: 'race-b-session',
      documentId: 'race-b-document',
      actor: { userId, actorKind: 'studio' },
    })
    await first.query('COMMIT')
    await expect(pending).resolves.toMatchObject({ ok: false })
    await second.query('COMMIT')
  } finally {
    await first.end()
    await second.end()
  }
})

test('withChapterLease releases an implicit lease even when the write fails', async ({ sandbox: { chapter, userId } }) => {
  await expect(withTransaction(client => withChapterLease(
    client,
    chapter.id,
    implicitGrant(userId),
    async () => { throw new ChapterWriteError('validation') },
  ))).rejects.toMatchObject({ code: 'validation' })
  expect(await fetchChapterLease(chapter.id)).toBeNull()
})

test('reorder refuses chapters with a live lease and verifies revisions', async ({ sandbox: { chapter, userId, editionId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  await expect(reorderChapters(editionId, [{ id: chapter.id, revision: chapter.revision }]))
    .rejects.toMatchObject({ code: 'lease-held' })

  await releaseChapterLease({
    chapterId: chapter.id,
    sessionId: lease.sessionId,
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  })
  await expect(reorderChapters(editionId, [{ id: chapter.id, revision: chapter.revision + 1 }]))
    .rejects.toMatchObject({ code: 'conflict' })
  await expect(reorderChapters(editionId, [{ id: chapter.id, revision: chapter.revision }])).resolves.toBeUndefined()
})

test('deleting an edition or release is blocked by a live chapter lease', async ({ sandbox: { chapter, userId, editionId, releaseId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  await expect(deleteEdition(editionId)).rejects.toMatchObject({ code: 'lease-held' })
  await expect(deleteRelease(releaseId)).rejects.toMatchObject({ code: 'lease-held' })

  await releaseChapterLease({
    chapterId: chapter.id,
    sessionId: lease.sessionId,
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  })
  await expect(deleteEdition(editionId)).resolves.toBeUndefined()
})

test('two different chapters are edited at the same time', async ({ sandbox: { chapter, userId } }) => {
  const second = await createChapter({
    edition_id: chapter.edition_id,
    chapter_index: 2,
    title: 'Second chapter',
    content: original,
  })
  if (!second) throw new Error('Expected persisted chapter')

  const firstLease = await leaseFor(userId, chapter.id)
  const secondLease = await leaseFor(userId, second.id)

  await expect(updateChapter(chapter.id, { content: edited }, {
    expectedRevision: chapter.revision,
    lease: sessionGrant(userId, firstLease),
  })).resolves.toMatchObject({ content: edited })
  await expect(updateChapter(second.id, { content: edited }, {
    expectedRevision: second.revision,
    lease: sessionGrant(userId, secondLease),
  })).resolves.toMatchObject({ content: edited })
})

test('a session lease cannot write without release access', async ({ sandbox: { chapter } }) => {
  const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
  const outsider = await dbQueryOne<{ id: string }>(
    `INSERT INTO users (login, email, handle, display_name, public_role)
     VALUES ($1, $2, $1, 'Outsider', 'author') RETURNING id`,
    [`outsider_${suffix}`, `outsider-${suffix}@canfly.test`],
  )
  if (!outsider) throw new Error('Expected outsider user')
  try {
    const lease = await leaseFor(outsider.id, chapter.id)
    await expect(updateChapter(chapter.id, { content: edited }, {
      expectedRevision: chapter.revision,
      lease: sessionGrant(outsider.id, lease),
    })).rejects.toMatchObject({ code: 'lease-required' })
    expect(await fetchChapterById(chapter.id)).toEqual(chapter)
  } finally {
    await dbQuery('DELETE FROM users WHERE id = $1', [outsider.id])
  }
})

test('expired leases are ignored by the status read and by deletes', async ({ sandbox: { chapter, userId, editionId } }) => {
  await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)
  expect(await fetchChapterLease(chapter.id)).toBeNull()
  await expect(deleteEdition(editionId)).resolves.toBeUndefined()
})

async function directClient() {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const client = createDedicatedDatabaseClient({ connectionString: url })
  await client.connect()
  return client
}

function settled<T>(promise: Promise<T>) {
  return promise.then(
    value => ({ status: 'fulfilled' as const, value }),
    reason => ({ status: 'rejected' as const, reason }),
  )
}

async function stillPending(promise: Promise<unknown>) {
  return Promise.race([
    settled(promise),
    new Promise<'pending'>(resolve => setTimeout(() => resolve('pending'), 300)),
  ])
}

test('reorder waits for an in-flight acquisition over an expired lease row', async ({ sandbox: { chapter, userId, editionId } }) => {
  await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)
  const client = await directClient()
  try {
    await client.query('BEGIN')
    const acquired = await acquireChapterLeaseOnClient(client, {
      chapterId: chapter.id,
      sessionId: 'late-acquire-session',
      documentId: 'late-acquire-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(acquired.ok).toBe(true)

    const reorder = reorderChapters(editionId, [{ id: chapter.id, revision: chapter.revision }])
    expect(await stillPending(reorder)).toBe('pending')

    await client.query('COMMIT')
    await expect(reorder).rejects.toMatchObject({ code: 'lease-held' })
  } finally {
    await client.end()
  }
})

test('deleteEdition waits for an in-flight acquisition over an expired lease row', async ({ sandbox: { chapter, userId, editionId } }) => {
  await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)
  const client = await directClient()
  try {
    await client.query('BEGIN')
    const acquired = await acquireChapterLeaseOnClient(client, {
      chapterId: chapter.id,
      sessionId: 'late-delete-edition-session',
      documentId: 'late-delete-edition-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(acquired.ok).toBe(true)

    const deletion = deleteEdition(editionId)
    expect(await stillPending(deletion)).toBe('pending')

    await client.query('COMMIT')
    await expect(deletion).rejects.toMatchObject({ code: 'lease-held' })
    expect(await fetchChapterById(chapter.id)).not.toBeNull()
  } finally {
    await client.end()
  }
})

test('deleteRelease waits for an in-flight acquisition over an expired lease row', async ({ sandbox: { chapter, userId, releaseId } }) => {
  await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)
  const client = await directClient()
  try {
    await client.query('BEGIN')
    const acquired = await acquireChapterLeaseOnClient(client, {
      chapterId: chapter.id,
      sessionId: 'late-delete-release-session',
      documentId: 'late-delete-release-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(acquired.ok).toBe(true)

    const deletion = deleteRelease(releaseId)
    expect(await stillPending(deletion)).toBe('pending')

    await client.query('COMMIT')
    await expect(deletion).rejects.toMatchObject({ code: 'lease-held' })
    expect(await fetchChapterById(chapter.id)).not.toBeNull()
  } finally {
    await client.end()
  }
})

test('reorder and a writer with a live lease do not deadlock', async ({ sandbox: { chapter, userId, editionId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  const [write, reorder] = await Promise.all([
    settled(updateChapter(chapter.id, { content: edited }, {
      expectedRevision: chapter.revision,
      lease: sessionGrant(userId, lease),
    })),
    settled(reorderChapters(editionId, [{ id: chapter.id, revision: chapter.revision }])),
  ])
  expect(write.status).toBe('fulfilled')
  expect(reorder.status).toBe('rejected')
  if (reorder.status === 'rejected') {
    expect(['lease-held', 'conflict']).toContain(reorder.reason.code)
  }
})

async function waitForBlockedPid(holderPid: number): Promise<number> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const row = await dbQueryOne<{ pid: number }>(
      'SELECT pid FROM pg_stat_activity WHERE $1 = ANY(pg_blocking_pids(pid)) LIMIT 1',
      [holderPid],
    )
    if (row) return row.pid
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  throw new Error('Не дождались заблокированного соединения')
}

async function chapterRowLocks(pid: number): Promise<number> {
  const row = await dbQueryOne<{ count: number }>(
    `SELECT COUNT(*)::integer AS count
     FROM pg_locks l
     JOIN pg_class c ON c.oid = l.relation
     WHERE l.pid = $1 AND l.granted
       AND c.relname = 'chapters' AND l.mode = 'RowShareLock'`,
    [pid],
  )
  return row?.count ?? 0
}

test('M1: каскадное удаление издания блокирует lease-строки раньше строк глав', async ({ sandbox: { chapter, userId, editionId } }) => {
  await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)

  const client = await directClient()
  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT chapter_id FROM chapter_edit_leases WHERE chapter_id = $1 FOR UPDATE',
      [chapter.id],
    )
    const { rows: [self] } = await client.query<{ pid: number }>('SELECT pg_backend_pid() AS pid')

    const deletion = deleteEdition(editionId)
    const blockedPid = await waitForBlockedPid(self.pid)
    expect(await chapterRowLocks(blockedPid)).toBe(0)

    await client.query('COMMIT')
    await expect(deletion).resolves.toBeUndefined()
  } finally {
    await client.end()
  }
})

test('M1: Studio writer и удаление издания завершаются без deadlock', async ({ sandbox: { chapter, userId, editionId } }) => {
  const lease = await leaseFor(userId, chapter.id)
  const [write, deletion] = await Promise.all([
    settled(updateChapter(chapter.id, { content: edited }, {
      expectedRevision: chapter.revision,
      lease: sessionGrant(userId, lease),
    })),
    settled(deleteEdition(editionId)),
  ])
  expect(write.status).toBe('fulfilled')
  expect(deletion.status).toBe('rejected')
  if (deletion.status === 'rejected') {
    expect(deletion.reason.code).not.toBe('40P01')
    expect(deletion.reason.code).toBe('lease-held')
  }
})

test('M2: два одновременных создания получают разные chapter_index', async ({ sandbox: { chapter } }) => {
  const editionId = chapter.edition_id
  const [first, second] = await Promise.all([
    createChapter({ edition_id: editionId, title: 'Первая', content: null }),
    createChapter({ edition_id: editionId, title: 'Вторая', content: null }),
  ])
  expect(first).not.toBeNull()
  expect(second).not.toBeNull()
  expect([first!.chapter_index, second!.chapter_index].sort()).toEqual([2, 3])
})

test('M3: deleteRelease фиксирует состав релиза и блокирует createEdition', async ({ sandbox: { releaseId } }) => {
  const client = await directClient()
  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [advisoryLockKey('release-composition', releaseId)],
    )

    const deletion = deleteRelease(releaseId)
    const creation = createEdition({
      release_id: releaseId,
      slug: `late-edition-${randomUUID()}`,
      status: 'draft',
    })

    expect(await stillPending(deletion)).toBe('pending')
    expect(await stillPending(creation)).toBe('pending')

    await client.query('COMMIT')
    const deleted = await settled(deletion)
    const created = await settled(creation)
    expect(deleted.status).toBe('fulfilled')
    if (created.status === 'rejected') expect(created.reason.code).toBe('23503')
    const editions = await dbQuery<{ id: string }>(
      'SELECT id FROM editions WHERE release_id = $1',
      [releaseId],
    )
    expect(editions).toEqual([])
  } finally {
    await client.end()
  }
})

test('M3: deleteRelease блокирует создание главы в существующем издании', async ({ sandbox: { editionId, releaseId } }) => {
  const client = await directClient()
  try {
    await client.query('BEGIN')
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [advisoryLockKey('release-composition', releaseId)],
    )

    const deletion = deleteRelease(releaseId)
    const creation = createChapter({ edition_id: editionId, title: 'Поздняя глава', content: null })

    expect(await stillPending(deletion)).toBe('pending')
    expect(await stillPending(creation)).toBe('pending')

    await client.query('COMMIT')
    const deleted = await settled(deletion)
    const created = await settled(creation)
    expect(deleted.status).toBe('fulfilled')
    if (created.status === 'rejected') expect(created.reason.code).toBe('23503')
    const chapters = await dbQuery<{ id: string }>(
      `SELECT c.id FROM chapters c
       JOIN editions e ON e.id = c.edition_id
       WHERE e.release_id = $1`,
      [releaseId],
    )
    expect(chapters).toEqual([])
  } finally {
    await client.end()
  }
})

test('UUID в верхнем и нижнем регистре даёт один advisory lock', async ({ sandbox: { chapter } }) => {
  const first = await directClient()
  const second = await directClient()
  try {
    await first.query('BEGIN')
    const upper = advisoryLockKey('chapter-lease', chapter.id.toUpperCase())
    const lower = advisoryLockKey('chapter-lease', chapter.id)
    expect(upper).toBe(lower)

    await first.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [upper])
    const blocked = await second.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [lower],
    )
    expect(blocked.rows[0]?.acquired).toBe(false)

    await first.query('COMMIT')
    const free = await second.query<{ acquired: boolean }>(
      'SELECT pg_try_advisory_xact_lock(hashtextextended($1, 0)) AS acquired',
      [upper],
    )
    expect(free.rows[0]?.acquired).toBe(true)
    await second.query('ROLLBACK')
  } finally {
    await first.end()
    await second.end()
  }
})

test('acquireChapterLease и deleteEdition конкурируют при разном регистре UUID', async ({ sandbox: { chapter, userId, editionId } }) => {
  const client = await directClient()
  try {
    await client.query('BEGIN')
    const acquired = await acquireChapterLeaseOnClient(client, {
      chapterId: chapter.id,
      sessionId: 'mixed-case-delete-edition-session',
      documentId: 'mixed-case-delete-edition-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(acquired.ok).toBe(true)

    const deletion = deleteEdition(editionId.toUpperCase())
    expect(await stillPending(deletion)).toBe('pending')

    await client.query('COMMIT')
    await expect(deletion).rejects.toMatchObject({ code: 'lease-held' })
    expect(await fetchChapterById(chapter.id)).not.toBeNull()
    expect(await fetchChapterVersions(chapter.id)).toEqual([])
  } finally {
    await client.end()
  }
})

test('acquireChapterLease и deleteRelease конкурируют при разном регистре UUID', async ({ sandbox: { chapter, userId, releaseId } }) => {
  const client = await directClient()
  try {
    await client.query('BEGIN')
    const acquired = await acquireChapterLeaseOnClient(client, {
      chapterId: chapter.id,
      sessionId: 'mixed-case-delete-release-session',
      documentId: 'mixed-case-delete-release-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(acquired.ok).toBe(true)

    const deletion = deleteRelease(releaseId.toUpperCase())
    expect(await stillPending(deletion)).toBe('pending')

    await client.query('COMMIT')
    await expect(deletion).rejects.toMatchObject({ code: 'lease-held' })
    expect(await fetchChapterById(chapter.id)).not.toBeNull()
    expect(await fetchChapterVersions(chapter.id)).toEqual([])
  } finally {
    await client.end()
  }
})

test('reorderChapters не обходит lease при другом регистре UUID', async ({ sandbox: { chapter, userId, editionId } }) => {
  const client = await directClient()
  try {
    await client.query('BEGIN')
    const acquired = await acquireChapterLeaseOnClient(client, {
      chapterId: chapter.id,
      sessionId: 'mixed-case-reorder-session',
      documentId: 'mixed-case-reorder-document',
      actor: { userId, actorKind: 'studio' },
    })
    expect(acquired.ok).toBe(true)

    const reorder = reorderChapters(editionId.toUpperCase(), [{
      id: chapter.id.toUpperCase(),
      revision: chapter.revision,
    }])
    expect(await stillPending(reorder)).toBe('pending')

    await client.query('COMMIT')
    await expect(reorder).rejects.toMatchObject({ code: 'lease-held' })
    expect(await fetchChapterById(chapter.id)).not.toBeNull()
    expect(await fetchChapterVersions(chapter.id)).toEqual([])
  } finally {
    await client.end()
  }
})
