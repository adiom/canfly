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
    actor: { userId, actorKind: 'studio' },
  })
  expect(second).toMatchObject({ ok: false, holder: { userId, actorKind: 'studio' } })

  await expireLease(chapter.id)
  const third = await acquireChapterLease({
    chapterId: chapter.id,
    sessionId: `session-${randomUUID()}`,
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
      actor: { userId, actorKind: 'studio' },
    })
    expect(won.ok).toBe(true)

    await second.query('BEGIN')
    const pending = acquireChapterLeaseOnClient(second, {
      chapterId: chapter.id,
      sessionId: 'race-b-session',
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

test('expired leases are ignored by the status read and by deletes', async ({ sandbox: { chapter, userId, editionId } }) => {
  await leaseFor(userId, chapter.id)
  await expireLease(chapter.id)
  expect(await fetchChapterLease(chapter.id)).toBeNull()
  await expect(deleteEdition(editionId)).resolves.toBeUndefined()
})
