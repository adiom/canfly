import { randomUUID } from 'node:crypto'
import { expect, test as base } from '@playwright/test'
import { dbQuery, withTransaction } from '@/lib/db'
import type { Chapter } from '@/lib/releases-types'
import { chapterUpdateSchema } from '@/lib/schemas/studio'
import { callChapterMcp } from '@/e2e/setup/chapter-mcp'
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

const test = base.extend<{ chapter: Chapter }>({
  chapter: async ({}, applyFixture) => {
    const slug = `fixture-${randomUUID()}`
    const release = await createRelease({ title: 'Synthetic release', slug, status: 'draft' })
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
      if (!chapter) throw new Error('Expected persisted chapter')
      await applyFixture(chapter)
    } finally {
      await dbQuery('DELETE FROM releases WHERE id = $1', [release.id])
    }
  },
})


test('sanitizes before comparison and saves only supplied fields, including empty content', async ({ chapter }) => {
  const { id } = chapter
  await updateChapter(id, { title: 'Renamed', content: undefined })
  expect(await updateChapter(id, { content: '<p style="color:red">Original chapter</p>' }))
    .toMatchObject({ content: original, word_count: 2 })
  expect(await fetchChapterVersions(id)).toEqual([])

  const { title, ...patch } = chapterUpdateSchema.parse({ content: '' })
  expect(await updateChapter(id, { ...patch, title: title ?? undefined })).toMatchObject({
    content: '', word_count: 0, title: 'Renamed', status: 'published', audio_url: audioUrl, duration_seconds: 42,
  })
  expect(await fetchChapterVersions(id)).toMatchObject([{ version_number: 1, content: original }])
  expect(await updateChapter(id, { audio_url: null })).toMatchObject({
    audio_url: null, duration_seconds: 42, content: '', word_count: 0,
  })
  expect(await fetchChapterVersions(id)).toHaveLength(1)
})

test('rolls back the snapshot when updating the chapter fails', async ({ chapter }) => {
  const { id } = chapter
  await expect(updateChapter(id, { title: null, content: edited })).rejects.toMatchObject({
    code: '23502', column: 'title',
  })
  expect(await fetchChapterById(id)).toEqual(chapter)
  expect(await fetchChapterVersions(id)).toEqual([])
  await updateChapter(id, { content: edited })
  expect(await fetchChapterVersions(id)).toMatchObject([{ version_number: 1, content: original }])
})

test('rolls back the chapter write when inserting a snapshot fails', async ({ chapter }) => {
  const { id } = chapter
  await dbQuery(
    'INSERT INTO chapter_versions (chapter_id, content, version_number) VALUES ($1, $2, $3)',
    [id, original, 2147483647],
  )
  const history = await fetchChapterVersions(id)
  await expect(updateChapter(id, { content: edited, title: 'Renamed' })).rejects.toMatchObject({ code: '22003' })
  expect(await fetchChapterById(id)).toEqual(chapter)
  expect(await fetchChapterVersions(id)).toEqual(history)
})

test('serializes competing saves and restores using the same chapter lock', async ({ chapter }) => {
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
      for (const result of settled ?? []) {
        if (result.status === 'rejected') throw result.reason
      }
    }
  }

  const latest = '<p>Third draft</p>'
  await race(
    () => updateChapter(id, { content: edited, title: 'Renamed' }),
    () => updateChapter(id, { content: latest, audio_url: null }),
  )
  const afterSaves = await fetchChapterById(id)
  expect(afterSaves).toMatchObject({ title: 'Renamed', audio_url: null, status: 'published' })
  const history = await fetchChapterVersions(id)
  expect(history).toMatchObject([
    { version_number: 2, content: afterSaves?.content === edited ? latest : edited },
    { version_number: 1, content: original },
  ])

  const incoming = '<p>Another draft</p>'
  const target = history[1]
  await race(
    () => updateChapter(id, { content: incoming }),
    () => restoreChapterVersion(id, target.id),
  )
  const afterRestore = await fetchChapterById(id)
  expect([original, incoming]).toContain(afterRestore?.content)
  expect(await fetchChapterVersions(id)).toMatchObject([
    { version_number: 4, content: afterRestore?.content === original ? incoming : original },
    { version_number: 3, content: afterSaves?.content },
    ...history,
  ])
})

test('preserves comic pages and can restore the empty first revision once', async ({ chapter }) => {
  const comic = await createChapter({
    edition_id: chapter.edition_id,
    chapter_index: 2,
    title: 'Synthetic comic',
  })
  if (!comic) throw new Error('Expected persisted comic')

  const pages = JSON.stringify(['https://example.test/1.png', 'https://example.test/2.png'])
  const patch = { content: pages, word_count: 0 }
  expect(await updateChapter(comic.id, patch, { archiveEmptyContent: true })).toMatchObject(patch)
  await updateChapter(comic.id, patch, { archiveEmptyContent: true })
  const versions = await fetchChapterVersions(comic.id)
  expect(versions).toMatchObject([{ content: '', version_number: 1 }])
  expect(await restoreChapterVersion(chapter.id, versions[0].id)).toBeNull()
  expect(await fetchChapterVersions(chapter.id)).toEqual([])
  expect(await restoreChapterVersion(comic.id, versions[0].id)).toMatchObject({ content: '', word_count: 0 })
  await restoreChapterVersion(comic.id, versions[0].id)
  expect(await fetchChapterVersions(comic.id)).toMatchObject([
    { version_number: 2, content: pages },
    { version_number: 1, content: '' },
  ])
})

test('only one guarded writer wins and the rejected write creates no history', async ({ chapter }) => {
  const { id, revision } = chapter
  expect(revision).toBe(0)
  const results = await Promise.allSettled([
    updateChapter(id, { content: edited }, { expectedRevision: revision }),
    updateChapter(id, { content: '<p>Third draft</p>' }, { expectedRevision: revision }),
  ])
  expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
  expect(results.find(result => result.status === 'rejected')).toMatchObject({
    reason: { code: 'conflict' },
  })
  expect(await fetchChapterById(id)).toMatchObject({ revision: revision + 1 })
  expect(await fetchChapterVersions(id)).toMatchObject([{ version_number: 1, content: original }])
})

test('unguarded writes advance the revision and a guarded restore invalidates other drafts', async ({ chapter }) => {
  const { id, revision } = chapter
  const saved = await updateChapter(id, { content: edited })
  expect(saved).toMatchObject({ revision: revision + 1 })
  const [previous] = await fetchChapterVersions(id)
  await expect(restoreChapterVersion(id, previous.id, revision)).rejects.toMatchObject({ code: 'conflict' })
  const restored = await restoreChapterVersion(id, previous.id, revision + 1)
  expect(restored).toMatchObject({ revision: revision + 2, content: original })
  await expect(updateChapter(id, { title: 'Stale' }, { expectedRevision: revision + 1 }))
    .rejects.toMatchObject({ code: 'conflict' })
  expect(await updateChapter(id, { title: 'Renamed' }, { expectedRevision: revision + 2 }))
    .toMatchObject({ title: 'Renamed', content: original, revision: revision + 3 })
  expect(await fetchChapterVersions(id)).toHaveLength(2)
})

test('a guarded write fails if the chapter disappeared', async ({ chapter }) => {
  await dbQuery('DELETE FROM chapters WHERE id = $1', [chapter.id])
  await expect(updateChapter(chapter.id, { title: 'Lost' }, { expectedRevision: chapter.revision }))
    .rejects.toMatchObject({ code: 'not-found' })
})

test('MCP accepts legacy writes and optionally rejects stale edits', async ({ chapter }) => {
  const { id, revision } = chapter
  const legacy = await callChapterMcp('canfly_update_chapter', { id, content: edited })
  expect(legacy.isError).not.toBe(true)
  expect(JSON.parse(legacy.content[0].text)).toMatchObject({ revision: revision + 1 })

  const stale = await callChapterMcp('canfly_update_chapter', { id, expected_revision: revision, content: original })
  expect(stale.isError).toBe(true)
  expect(stale.content[0].text).toContain('Глава изменилась')
  const [previous] = await fetchChapterVersions(id)
  const staleRestore = await callChapterMcp('canfly_restore_chapter_version', {
    chapter_id: id, version_id: previous.id, expected_revision: revision,
  })
  expect(staleRestore.isError).toBe(true)
  expect(staleRestore.content[0].text).toContain('Глава изменилась')
  const current = await callChapterMcp('canfly_get_chapter', { id })
  expect(JSON.parse(current.content[0].text)).toMatchObject({ revision: revision + 1, content: edited })

  const legacyRestore = await callChapterMcp('canfly_restore_chapter_version', {
    chapter_id: id, version_id: previous.id,
  })
  expect(legacyRestore.isError).not.toBe(true)
  expect(JSON.parse(legacyRestore.content[0].text)).toMatchObject({ revision: revision + 2 })
  expect(await fetchChapterById(id)).toMatchObject({ content: original })
})

test.describe('MCP chapter writes v2', () => {
  test('applies a current patch and returns a structured conflict for a stale patch', async ({ chapter }) => {
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

  test('rejects both operations without a revision', async ({ chapter }) => {
    const { id, revision } = chapter
    const current = await updateChapter(id, { content: edited }, { expectedRevision: revision })
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

  test('rejects a stale restore and archives the latest text on deliberate restore', async ({ chapter }) => {
    const { id, revision } = chapter
    await updateChapter(id, { content: edited }, { expectedRevision: revision })
    const latestText = '<p>Later chapter draft</p>'
    const latest = await updateChapter(id, { content: latestText }, { expectedRevision: revision + 1 })
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
})
