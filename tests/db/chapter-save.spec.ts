import { randomUUID } from 'node:crypto'
import { expect, test as base } from '@playwright/test'
import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import type { Chapter } from '@/lib/releases-types'
import { chapterUpdateSchema } from '@/lib/schemas/studio'
import { callChapterMcp } from '@/e2e/setup/chapter-mcp'
import {
  acquireChapterLease,
  releaseChapterLease,
  type ChapterLeaseGrant,
} from '@/lib/server/chapter-leases'
import {
  createChapter,
  fetchChapterById,
  fetchChapterVersions,
  restoreChapterVersion,
  updateChapter,
} from '@/lib/server/chapters'
import { createEdition } from '@/lib/server/editions'
import { createRelease } from '@/lib/server/releases'

const original = '<p>Original chapter</p>'
const edited = '<p>Second chapter draft</p>'
const audioUrl = 'https://example.test/chapter.mp3'

interface Sandbox {
  chapter: Chapter
  userId: string
}

const test = base.extend<{ sandbox: Sandbox }>({
  sandbox: async ({}, applyFixture) => {
    const slug = `fixture-${randomUUID()}`
    const suffix = randomUUID().replaceAll('-', '').slice(0, 12)
    const release = await createRelease({ title: 'Synthetic release', slug, status: 'draft' })
    let userId: string | null = null
    try {
      const edition = await createEdition({ release_id: release.id, slug, status: 'draft' })
      const chapter = await createChapter({
        edition_id: edition.id,
        chapter_index: 1,
        title: 'Synthetic chapter',
        content: original,
        status: 'published',
        word_count: 2,
        audio_url: audioUrl,
        duration_seconds: 42,
      })
      const user = await dbQueryOne<{ id: string }>(
        `INSERT INTO users (login, email, handle, display_name, public_role)
         VALUES ($1, $2, $1, 'Chapter Tester', 'author') RETURNING id`,
        [`chapter_${suffix}`, `chapter-${suffix}@canfly.test`],
      )
      if (!chapter || !user) throw new Error('Expected persisted chapter')
      await dbQuery(
        "INSERT INTO release_collaborators (release_id, user_id, role) VALUES ($1, $2, 'owner')",
        [release.id, user.id],
      )
      userId = user.id
      await applyFixture({ chapter, userId: user.id })
    } finally {
      await dbQuery('DELETE FROM releases WHERE id = $1', [release.id])
      if (userId) await dbQuery('DELETE FROM users WHERE id = $1', [userId])
    }
  },
})

/** MCP-путь: lease захватывается и освобождается внутри одной транзакции. */
function implicit(userId: string): ChapterLeaseGrant {
  return { mode: 'implicit', actor: { userId, actorKind: 'mcp' }, sessionId: `mcp-${randomUUID()}` }
}

function session(userId: string, lease: { sessionId: string; token: string; generation: number }): ChapterLeaseGrant {
  return {
    mode: 'session',
    actor: { userId, actorKind: 'studio' },
    proof: { sessionId: lease.sessionId, token: lease.token, generation: lease.generation },
  }
}

test('sanitizes before comparison and saves only supplied fields, including empty content', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const { id } = chapter
  let revision = chapter.revision
  const save = async (data: Record<string, unknown>) => {
    const saved = await updateChapter(id, data, { expectedRevision: revision, lease })
    revision = saved.revision
    return saved
  }

  expect(await save({ title: 'Renamed' })).toMatchObject({ title: 'Renamed', revision: 1 })
  expect(await save({ content: '<p style="color:red">Original chapter</p>' }))
    .toMatchObject({ content: original, word_count: 2, revision: 1 })
  expect(await fetchChapterVersions(id)).toEqual([])

  const { title, ...patch } = chapterUpdateSchema.parse({ content: '' })
  expect(await save({ ...patch, title: title ?? undefined })).toMatchObject({
    content: '', word_count: 0, title: 'Renamed', status: 'published', audio_url: audioUrl, duration_seconds: 42,
  })
  expect(await fetchChapterVersions(id)).toMatchObject([{ version_number: 1, content: original }])
  expect(await save({ audio_url: null })).toMatchObject({
    audio_url: null, duration_seconds: 42, content: '', word_count: 0,
  })
  expect(await fetchChapterVersions(id)).toHaveLength(1)
})

test('rolls back the snapshot when updating the chapter fails', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const { id } = chapter
  await expect(updateChapter(id, { title: null, content: edited }, {
    expectedRevision: chapter.revision,
    lease,
  })).rejects.toMatchObject({ code: '23502', column: 'title' })
  expect(await fetchChapterById(id)).toEqual(chapter)
  expect(await fetchChapterVersions(id)).toEqual([])
  await updateChapter(id, { content: edited }, { expectedRevision: chapter.revision, lease })
  expect(await fetchChapterVersions(id)).toMatchObject([{ version_number: 1, content: original }])
})

test('rolls back the chapter write when inserting a snapshot fails', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const { id } = chapter
  await dbQuery(
    'INSERT INTO chapter_versions (chapter_id, content, version_number) VALUES ($1, $2, $3)',
    [id, original, 2147483647],
  )
  const history = await fetchChapterVersions(id)
  await expect(updateChapter(id, { content: edited, title: 'Renamed' }, {
    expectedRevision: chapter.revision,
    lease,
  })).rejects.toMatchObject({ code: '22003' })
  expect(await fetchChapterById(id)).toEqual(chapter)
  expect(await fetchChapterVersions(id)).toEqual(history)
})

test('serializes competing saves and restores under the chapter lock', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const { id } = chapter

  async function race<T, U>(first: () => Promise<T>, second: () => Promise<U>) {
    let results: Promise<[PromiseSettledResult<T>, PromiseSettledResult<U>]> | undefined
    try {
      await withTransaction(async (client) => {
        await client.query('SELECT id FROM chapters WHERE id = $1 FOR UPDATE', [id])
        let firstFinished = false
        let secondFinished = false
        const firstOperation = first().finally(() => { firstFinished = true })
        const secondOperation = second().finally(() => { secondFinished = true })
        results = Promise.allSettled([firstOperation, secondOperation])
        await new Promise((resolve) => setTimeout(resolve, 100))
        expect(firstFinished).toBe(false)
        expect(secondFinished).toBe(false)
      })
    } finally {
      const settled = await results
      const fulfilled = (settled ?? []).filter(result => result.status === 'fulfilled')
      const rejected = (settled ?? []).filter(result => result.status === 'rejected')
      expect(fulfilled).toHaveLength(1)
      expect(rejected).toHaveLength(1)
      expect(rejected[0]).toMatchObject({ reason: { code: 'conflict' } })
    }
  }

  const latest = '<p>Third draft</p>'
  await race(
    () => updateChapter(id, { content: edited, title: 'Renamed' }, { expectedRevision: chapter.revision, lease }),
    () => updateChapter(id, { content: latest, audio_url: null }, { expectedRevision: chapter.revision, lease }),
  )
  const afterSave = await fetchChapterById(id)
  expect(afterSave).toMatchObject({ revision: chapter.revision + 1, status: 'published' })
  const history = await fetchChapterVersions(id)
  expect(history).toMatchObject([{ version_number: 1, content: original }])

  const incoming = '<p>Another draft</p>'
  await race(
    () => updateChapter(id, { content: incoming }, { expectedRevision: afterSave!.revision, lease }),
    () => restoreChapterVersion(id, history[0].id, { expectedRevision: afterSave!.revision, lease }),
  )
  const afterRestore = await fetchChapterById(id)
  expect(afterRestore).toMatchObject({ revision: chapter.revision + 2 })
  expect(await fetchChapterVersions(id)).toHaveLength(2)
})

test('preserves comic pages and can restore the empty first revision once', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const comic = await createChapter({
    edition_id: chapter.edition_id,
    chapter_index: 2,
    title: 'Synthetic comic',
  })
  if (!comic) throw new Error('Expected persisted comic')

  const pages = JSON.stringify(['https://example.test/1.png', 'https://example.test/2.png'])
  const patch = { content: pages, word_count: 0 }
  const saved = await updateChapter(comic.id, patch, {
    archiveEmptyContent: true, expectedRevision: comic.revision, lease,
  })
  expect(saved).toMatchObject(patch)
  await updateChapter(comic.id, patch, {
    archiveEmptyContent: true, expectedRevision: saved.revision, lease,
  })
  const versions = await fetchChapterVersions(comic.id)
  expect(versions).toMatchObject([{ content: '', version_number: 1 }])
  expect(await restoreChapterVersion(chapter.id, versions[0].id, {
    expectedRevision: chapter.revision, lease,
  })).toBeNull()
  expect(await fetchChapterVersions(chapter.id)).toEqual([])
  const empty = await restoreChapterVersion(comic.id, versions[0].id, {
    expectedRevision: saved.revision, lease,
  })
  expect(empty).toMatchObject({ content: '', word_count: 0 })
  await restoreChapterVersion(comic.id, versions[0].id, {
    expectedRevision: empty!.revision, lease,
  })
  expect(await fetchChapterVersions(comic.id)).toMatchObject([
    { version_number: 2, content: pages },
    { version_number: 1, content: '' },
  ])
})

test('comic JSON keeps query ampersands through save, read and restore', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const pages = [
    'https://cdn.example/page.jpg?width=800&height=1200',
    '/local?x=1&y=2',
  ]
  const comic = await createChapter({
    edition_id: chapter.edition_id,
    chapter_index: 2,
    title: 'JSON comic',
    content: JSON.stringify(pages),
  })
  if (!comic) throw new Error('Expected persisted comic')
  expect(comic.content).toBe(JSON.stringify(pages))
  expect(comic.content).not.toContain('&amp;')
  expect((await fetchChapterById(comic.id))?.content).toBe(JSON.stringify(pages))

  const next = ['/new?filter=a&sort=b']
  const saved = await updateChapter(comic.id, {
    content: JSON.stringify(next),
    word_count: 0,
  }, { expectedRevision: comic.revision, lease })
  expect(saved).toMatchObject({ content: JSON.stringify(next), word_count: 0 })
  expect(saved.content).not.toContain('&amp;')

  const versions = await fetchChapterVersions(comic.id)
  expect(versions[0]?.content).toBe(JSON.stringify(pages))
  const restored = await restoreChapterVersion(comic.id, versions[0].id, {
    expectedRevision: saved.revision,
    lease,
  })
  expect(restored).toMatchObject({ content: JSON.stringify(pages), word_count: 0 })
})

test('append ignores requested chapter_index and keeps order', async ({ sandbox: { chapter } }) => {
  const appended = await createChapter({
    edition_id: chapter.edition_id,
    chapter_index: 99,
    title: 'Appended chapter',
    content: null,
  }, { append: true })
  expect(appended?.chapter_index).toBe(chapter.chapter_index + 1)

  const second = await createChapter({
    edition_id: chapter.edition_id,
    chapter_index: 500,
    title: 'Second appended chapter',
    content: null,
  }, { append: true })
  expect(second?.chapter_index).toBe(chapter.chapter_index + 2)
})

test('chapter_index cannot be changed through updateChapter', async ({ sandbox: { chapter, userId } }) => {
  const saved = await updateChapter(chapter.id, {
    title: 'Renamed without reorder',
    chapter_index: 42,
  }, {
    expectedRevision: chapter.revision,
    lease: implicit(userId),
  })
  expect(saved).toMatchObject({
    title: 'Renamed without reorder',
    chapter_index: chapter.chapter_index,
  })
})

test('a guarded write fails if the chapter disappeared', async ({ sandbox: { chapter, userId } }) => {
  await dbQuery('DELETE FROM chapters WHERE id = $1', [chapter.id])
  await expect(updateChapter(chapter.id, { title: 'Lost' }, {
    expectedRevision: chapter.revision,
    lease: implicit(userId),
  })).rejects.toMatchObject({ code: 'not-found' })
})

test('a guarded restore invalidates drafts based on older revisions', async ({ sandbox: { chapter, userId } }) => {
  const lease = implicit(userId)
  const { id, revision } = chapter
  const saved = await updateChapter(id, { content: edited }, { expectedRevision: revision, lease })
  expect(saved).toMatchObject({ revision: revision + 1 })
  const [previous] = await fetchChapterVersions(id)
  await expect(restoreChapterVersion(id, previous.id, { expectedRevision: revision, lease }))
    .rejects.toMatchObject({ code: 'conflict' })
  const restored = await restoreChapterVersion(id, previous.id, { expectedRevision: revision + 1, lease })
  expect(restored).toMatchObject({ revision: revision + 2, content: original })
  await expect(updateChapter(id, { title: 'Stale' }, { expectedRevision: revision + 1, lease }))
    .rejects.toMatchObject({ code: 'conflict' })
  expect(await updateChapter(id, { title: 'Renamed' }, { expectedRevision: revision + 2, lease }))
    .toMatchObject({ title: 'Renamed', content: original, revision: revision + 3 })
  expect(await fetchChapterVersions(id)).toHaveLength(2)
})

test.describe('MCP chapter writes', () => {
  test('create appends the chapter and ignores the requested index', async ({ sandbox: { chapter } }) => {
    const created = await callChapterMcp('canfly_create_chapter', {
      edition_id: chapter.edition_id,
      title: 'MCP append',
      chapter_index: 999,
      content: '<p>MCP</p>',
    })
    expect(created.isError).not.toBe(true)
    expect(JSON.parse(created.content[0].text)).toMatchObject({
      chapter_index: chapter.chapter_index + 1,
    })
  })

  test('legacy tools reject blind writes and accept revisioned ones', async ({ sandbox: { chapter } }) => {
    const { id, revision } = chapter

    const blind = await callChapterMcp('canfly_update_chapter', { id, content: edited })
    expect(blind.isError).toBe(true)
    expect(blind.structuredContent).toMatchObject({ code: 'revision_required' })
    expect(await fetchChapterById(id)).toEqual(chapter)

    const legacy = await callChapterMcp('canfly_update_chapter', { id, expected_revision: revision, content: edited })
    expect(legacy.isError).not.toBe(true)
    expect(JSON.parse(legacy.content[0].text)).toMatchObject({ revision: revision + 1 })

    const stale = await callChapterMcp('canfly_update_chapter', {
      id, expected_revision: revision, content: original,
    })
    expect(stale.isError).toBe(true)
    expect(stale.structuredContent).toMatchObject({ code: 'conflict' })
    const [previous] = await fetchChapterVersions(id)

    const blindRestore = await callChapterMcp('canfly_restore_chapter_version', {
      chapter_id: id, version_id: previous.id,
    })
    expect(blindRestore.isError).toBe(true)
    expect(blindRestore.structuredContent).toMatchObject({ code: 'revision_required' })

    const legacyRestore = await callChapterMcp('canfly_restore_chapter_version', {
      chapter_id: id, version_id: previous.id, expected_revision: revision + 1,
    })
    expect(legacyRestore.isError).not.toBe(true)
    expect(JSON.parse(legacyRestore.content[0].text)).toMatchObject({ revision: revision + 2 })
    expect(await fetchChapterById(id)).toMatchObject({ content: original })
  })

  test('v2 applies a current patch and returns a structured conflict for a stale patch', async ({ sandbox: { chapter } }) => {
    const { id, revision } = chapter
    const saved = await callChapterMcp('canfly_update_chapter_v2', {
      id, expected_revision: revision, content: edited,
    })
    expect(saved.isError).not.toBe(true)
    expect(JSON.parse(saved.content[0].text)).toMatchObject({ ok: true, id, revision: revision + 1 })
    const current = await fetchChapterById(id)
    expect(current).toMatchObject({ title: chapter.title, content: edited, audio_url: audioUrl })
    const history = await fetchChapterVersions(id)
    expect(history).toMatchObject([{ version_number: 1, content: original }])

    const stale = await callChapterMcp('canfly_update_chapter_v2', {
      id, expected_revision: revision, title: 'Stale title', content: original,
    })
    expect(stale).toMatchObject({ isError: true, structuredContent: { ok: false, code: 'conflict' } })
    expect(JSON.parse(stale.content[0].text)).toEqual(stale.structuredContent)
    expect(await fetchChapterById(id)).toEqual(current)
    expect(await fetchChapterVersions(id)).toEqual(history)
  })

  test('v2 rejects operations without a revision', async ({ sandbox: { chapter, userId } }) => {
    const { id, revision } = chapter
    const current = await updateChapter(id, { content: edited }, {
      expectedRevision: revision,
      lease: implicit(userId),
    })
    const history = await fetchChapterVersions(id)
    const update = await callChapterMcp('canfly_update_chapter_v2', { id, content: original })
    const restore = await callChapterMcp('canfly_restore_chapter_version_v2', {
      chapter_id: id, version_id: history[0].id,
    })
    for (const result of [update, restore]) {
      expect(result.isError).toBe(true)
      expect(result.content[0].text).toContain('expected_revision')
    }
    expect(await fetchChapterById(id)).toEqual(current)
    expect(await fetchChapterVersions(id)).toEqual(history)
  })

  test('v2 rejects a stale restore and archives the latest text on deliberate restore', async ({ sandbox: { chapter, userId } }) => {
    const lease = implicit(userId)
    const { id, revision } = chapter
    await updateChapter(id, { content: edited }, { expectedRevision: revision, lease })
    const latestText = '<p>Later chapter draft</p>'
    const latest = await updateChapter(id, { content: latestText }, { expectedRevision: revision + 1, lease })
    const history = await fetchChapterVersions(id)
    const args = { chapter_id: id, version_id: history[1].id }

    const stale = await callChapterMcp('canfly_restore_chapter_version_v2', {
      ...args, expected_revision: revision + 1,
    })
    expect(stale).toMatchObject({ isError: true, structuredContent: { ok: false, code: 'conflict' } })
    expect(await fetchChapterById(id)).toEqual(latest)
    expect(await fetchChapterVersions(id)).toEqual(history)

    const restored = await callChapterMcp('canfly_restore_chapter_version_v2', {
      ...args, expected_revision: revision + 2,
    })
    expect(restored.isError).not.toBe(true)
    expect(JSON.parse(restored.content[0].text)).toMatchObject({ ok: true, revision: revision + 3 })
    expect(await fetchChapterById(id)).toMatchObject({ content: original })
    expect(await fetchChapterVersions(id)).toMatchObject([
      { version_number: 3, content: latestText },
      ...history,
    ])
  })

  test('Studio lease blocks MCP and a stale Studio write after MCP releases', async ({ sandbox: { chapter, userId } }) => {
    const { id, revision } = chapter
    const acquired = await acquireChapterLease({
      chapterId: id,
      sessionId: `session-${randomUUID()}`,
      documentId: `doc-${randomUUID()}`,
      actor: { userId, actorKind: 'studio' },
    })
    if (!acquired.ok) throw new Error('Expected free chapter')

    const blocked = await callChapterMcp('canfly_update_chapter_v2', {
      id, expected_revision: revision, content: edited,
    })
    expect(blocked).toMatchObject({ isError: true, structuredContent: { ok: false, code: 'lease_held' } })
    expect(await fetchChapterById(id)).toEqual(chapter)

    await releaseChapterLease({
      chapterId: id,
      sessionId: acquired.lease.sessionId,
      actor: { userId, actorKind: 'studio' },
      proof: {
        sessionId: acquired.lease.sessionId,
        token: acquired.lease.token,
        generation: acquired.lease.generation,
      },
    })

    const mcp = await callChapterMcp('canfly_update_chapter_v2', {
      id, expected_revision: revision, content: edited,
    })
    expect(mcp.isError).not.toBe(true)

    await expect(updateChapter(id, { content: original }, {
      expectedRevision: revision,
      lease: session(userId, acquired.lease),
    })).rejects.toMatchObject({ code: 'lease-lost' })
    expect(await fetchChapterById(id)).toMatchObject({ content: edited, revision: revision + 1 })
  })
})
