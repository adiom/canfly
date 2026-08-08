import { dbQuery, dbQueryOne } from '@/lib/db'
import type { Series } from '@/lib/releases-types'

const seriesColumns = `id, title, slug, description, created_at, updated_at`

export interface SeriesRelease {
  id: string
  title: string
  slug: string
  annotation: string | null
  cover_image: string | null
  release_date: string | null
  phase_number: number | null
}

export async function fetchAllSeries() {
  return dbQuery<Series>(
    `SELECT ${seriesColumns} FROM series ORDER BY title ASC`,
  )
}

export async function fetchSeriesById(id: string) {
  return dbQueryOne<Series>(
    `SELECT ${seriesColumns} FROM series WHERE id = $1 LIMIT 1`,
    [id],
  )
}

export async function fetchSeriesWithReleases(slug: string) {
  const series = await dbQueryOne<Series & { id: string }>(
    `SELECT ${seriesColumns} FROM series WHERE slug = $1 LIMIT 1`,
    [slug],
  )
  if (!series) return null

  const releases = await dbQuery<SeriesRelease>(
    `SELECT
       r.id, r.title, r.slug, r.annotation, r.cover_image, r.release_date,
       rs.phase_number
     FROM release_series rs
     JOIN releases r ON r.id = rs.release_id
     WHERE rs.series_id = $1 AND r.status = 'published'
     ORDER BY COALESCE(rs.phase_number, 0) ASC NULLS LAST,
              r.release_date ASC NULLS LAST`,
    [series.id],
  )

  return { ...series, releases }
}


export async function createSeries(data: Record<string, unknown>) {
  return dbQueryOne<Series>(
    `INSERT INTO series (title, slug, description)
     VALUES ($1, $2, $3)
     RETURNING ${seriesColumns}`,
    [data.title, data.slug, data.description ?? null],
  )
}

export async function updateSeries(id: string, data: Record<string, unknown>) {
  return dbQueryOne<Series>(
    `UPDATE series SET title = $2, slug = $3, description = $4
     WHERE id = $1
     RETURNING ${seriesColumns}`,
    [id, data.title, data.slug, data.description ?? null],
  )
}

export async function deleteSeries(id: string) {
  await dbQuery('DELETE FROM series WHERE id = $1', [id])
}
