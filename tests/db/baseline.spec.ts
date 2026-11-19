import { randomUUID } from 'node:crypto'
import { expect, test } from '@playwright/test'
import { dbQuery, dbQueryOne } from '@/lib/db'
import {
  createChapter,
  fetchAllChaptersByEdition,
  fetchChapterVersions,
  fetchPublishedChaptersByEdition,
  publishChapter,
  updateChapter,
} from '@/lib/server/chapters'
import { createEdition } from '@/lib/server/editions'
import { fetchReadingProgress, upsertReadingProgress } from '@/lib/server/reading-progress'
import { createRelease } from '@/lib/server/releases'


test('persists chapters and versions, reads published chapters and upserts reading progress', async () => {
  const slug = `fixture-${randomUUID()}`
  const userId = randomUUID()
  const content = '<p>Synthetic chapter</p>'
  const release = await createRelease({ title: 'Synthetic release', slug, status: 'published' })

  try {
    const edition = await createEdition({ release_id: release.id, slug, status: 'published' })
    const chapter = await createChapter({
      edition_id: edition.id, chapter_index: 1, title: 'Synthetic chapter', content,
    })
    if (!chapter) throw new Error('Expected persisted chapter')
    const draft = await createChapter({
      edition_id: edition.id, chapter_index: 2, title: 'Synthetic draft', content,
    })
    if (!draft) throw new Error('Expected persisted draft')

    await test.step('stores a version and filters drafts from the public reader', async () => {
      const updatedContent = '<p>Updated synthetic chapter</p>'
      await updateChapter(chapter.id, { content: updatedContent })
      expect(await fetchChapterVersions(chapter.id)).toMatchObject([
        { chapter_id: chapter.id, content, version_number: 1 },
      ])
      expect(await fetchPublishedChaptersByEdition(edition.id)).toEqual([])
      await publishChapter(chapter.id)
      expect(await fetchPublishedChaptersByEdition(edition.id)).toMatchObject([
        { id: chapter.id, content: updatedContent },
      ])
      expect(await fetchAllChaptersByEdition(edition.id)).toMatchObject([{ id: chapter.id }, { id: draft.id }])
    })

    await test.step('updates the same progress row through the partial unique index', async () => {
      await dbQuery('INSERT INTO users (id, handle, display_name) VALUES ($1, $2, $3)', [
        userId, slug, 'Synthetic reader',
      ])
      const ids = { editionId: edition.id, chapterId: chapter.id, userId }
      const first = await upsertReadingProgress({ ...ids, progressPercent: 12 })
      const second = await upsertReadingProgress({ ...ids, progressPercent: 34.5 })
      expect(first?.id).toBeTruthy()
      expect(second).toEqual(first)
      expect(await fetchReadingProgress(edition.id, userId)).toMatchObject({
        chapter_id: chapter.id, progress_percent: '34.50', position: null,
      })

      await expect(dbQuery(
        'INSERT INTO reading_progress (edition_id, chapter_id, user_id) VALUES ($1, $2, $3)',
        [edition.id, chapter.id, userId],
      )).rejects.toMatchObject({ code: '23505', constraint: 'idx_reading_progress_user_unique' })
    })

    await test.step('cascades deletion through editions, chapters, versions and progress', async () => {
      await dbQuery('DELETE FROM releases WHERE id = $1', [release.id])
      const remaining = await dbQueryOne(
        `SELECT EXISTS (SELECT FROM editions WHERE id = $1) AS edition,
                EXISTS (SELECT FROM chapters WHERE id IN ($2, $3)) AS chapter,
                EXISTS (SELECT FROM chapter_versions WHERE chapter_id = $2) AS version,
                EXISTS (SELECT FROM reading_progress WHERE chapter_id = $2) AS progress`,
        [edition.id, chapter.id, draft.id],
      )
      expect(remaining).toEqual({ edition: false, chapter: false, version: false, progress: false })
    })
  } finally {
    await dbQuery('DELETE FROM releases WHERE id = $1', [release.id])
    await dbQuery('DELETE FROM users WHERE id = $1', [userId])
  }
})
