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
import {
  createEdition,
  fetchEditionsByRelease,
  fetchEditionsWithPublishedChapterCounts,
  fetchReleaseChapterCounts,
} from '@/lib/server/editions'
import { fetchReadingProgress, upsertReadingProgress } from '@/lib/server/reading-progress'
import { createRelease } from '@/lib/server/releases'
import { canOpenEdition, getPrimaryEdition } from '@/lib/utils/editions'
import { createSeries, fetchSeriesWithReleases, fetchSeriesWithReleasesById } from '@/lib/server/series'


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

test('one-query release editions preserve the published counts and visibility rules', async () => {
  const slug = `edition-counts-${randomUUID()}`
  const release = await createRelease({ title: 'Synthetic edition listing', slug, status: 'published' })
  try {
    const book = await createEdition({
      release_id: release.id, slug: `${slug}-book`, format: 'book',
      status: 'published', is_primary: true,
    })
    const emptyBook = await createEdition({
      release_id: release.id, slug: `${slug}-empty`, format: 'book', status: 'published',
    })
    const digital = await createEdition({
      release_id: release.id, slug: `${slug}-digital`, format: 'digital', status: 'published',
      external_url: 'https://example.test/edition',
    })
    const artwork = await createEdition({
      release_id: release.id, slug: `${slug}-art`, format: 'artwork', status: 'published',
      artwork_url: 'https://example.test/cover.png',
    })
    const draft = await createEdition({
      release_id: release.id, slug: `${slug}-draft`, format: 'book', status: 'draft',
    })
    await createChapter({
      edition_id: book.id, chapter_index: 1, title: 'Published', status: 'published',
    })
    await createChapter({
      edition_id: book.id, chapter_index: 2, title: 'Unpublished', status: 'draft',
    })
    await createChapter({
      edition_id: draft.id, chapter_index: 1, title: 'Draft edition published chapter', status: 'published',
    })

    const originalEditions = await fetchEditionsByRelease(release.id)
    const originalCounts = await fetchReleaseChapterCounts(release.id)
    const withCounts = await fetchEditionsWithPublishedChapterCounts(release.id)
    const stripped = withCounts.map(({ published_chapter_count: _count, ...edition }) => edition)
    expect(stripped).toEqual(originalEditions)
    expect(withCounts.map(({ id, published_chapter_count }) => [id, published_chapter_count]))
      .toEqual(originalEditions.map(edition => [edition.id, originalCounts[edition.id] ?? 0]))

    const originalAvailable = originalEditions.filter(
      edition => canOpenEdition(edition, originalCounts[edition.id] ?? 0),
    )
    const optimizedAvailable = withCounts
      .filter(edition => canOpenEdition(edition, edition.published_chapter_count))
      .map(({ published_chapter_count: _count, ...edition }) => edition)
    expect(optimizedAvailable).toEqual(originalAvailable)
    expect(getPrimaryEdition(optimizedAvailable)?.id).toBe(book.id)
    expect(optimizedAvailable.map(edition => edition.id)).toEqual(
      expect.arrayContaining([book.id, digital.id, artwork.id]),
    )
    expect(optimizedAvailable.map(edition => edition.id)).not.toContain(emptyBook.id)
    expect(optimizedAvailable.map(edition => edition.id)).not.toContain(draft.id)
  } finally {
    await dbQuery('DELETE FROM releases WHERE id = $1', [release.id])
  }
})

test('series JOIN returns identical series, publication ordering, and empty results', async () => {
  const slug = `series-join-${randomUUID()}`
  const series = await createSeries({ title: 'Synthetic series', slug })
  const emptySeries = await createSeries({ title: 'Empty series', slug: `${slug}-empty` })
  const releases: string[] = []
  try {
    for (const [i, status, date] of [
      [1, 'published', '2026-01-01'],
      [2, 'draft', '2026-02-02'],
      [3, 'published', null],
      [4, 'published', '2026-03-03'],
    ] as const) {
      const release = await createRelease({
        title: `Synthetic part ${i}`, slug: `${slug}-part-${i}`,
        release_date: date, status,
      })
      releases.push(release.id)
      await dbQuery(
        'INSERT INTO release_series (release_id, series_id, phase_number) VALUES ($1, $2, $3)',
        [release.id, series.id, i === 3 ? null : i === 4 ? 0 : i],
      )
    }
    const originalSeries = await dbQueryOne<{
      id: string; title: string; slug: string; description: string | null;
      created_at: string; updated_at: string
    }>(
      'SELECT id, title, slug, description, created_at, updated_at FROM series WHERE slug = $1 LIMIT 1',
      [slug],
    )
    expect(originalSeries).not.toBeNull()
    const originalReleases = await dbQuery(
      `SELECT r.id, r.title, r.slug, r.annotation, r.cover_image, r.release_date,
              rs.phase_number
       FROM release_series rs JOIN releases r ON r.id = rs.release_id
       WHERE rs.series_id = $1 AND r.status = 'published'
       ORDER BY COALESCE(rs.phase_number, 0) ASC NULLS LAST,
                r.release_date ASC NULLS LAST`,
      [series.id],
    )
    const legacyResult = { ...originalSeries, releases: originalReleases }
    expect(await fetchSeriesWithReleases(slug)).toEqual(legacyResult)
    expect(await fetchSeriesWithReleasesById(series.id)).toEqual(legacyResult)
    expect((await fetchSeriesWithReleases(slug))?.releases.map(r => r.id)).not.toContain(releases[1])

    const oldEmpty = await dbQueryOne(
      'SELECT id, title, slug, description, created_at, updated_at FROM series WHERE id = $1',
      [emptySeries.id],
    )
    expect(await fetchSeriesWithReleasesById(emptySeries.id))
      .toEqual({ ...oldEmpty, releases: [] })
    expect(await fetchSeriesWithReleases(`${slug}-not-found`)).toBeNull()
    expect(await fetchSeriesWithReleasesById(randomUUID())).toBeNull()
  } finally {
    for (const id of releases) {
      await dbQuery('DELETE FROM releases WHERE id = $1', [id])
    }
    await dbQuery('DELETE FROM series WHERE id = ANY($1::uuid[])', [[series.id, emptySeries.id]])

  }
})
