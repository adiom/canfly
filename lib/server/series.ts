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

export interface SeriesWithStats extends Series {
  release_count: number
  cover_image: string | null
}

export async function fetchAllSeriesWithStats() {
  return dbQuery<SeriesWithStats>(
    `SELECT s.id, s.title, s.slug, s.description, s.created_at, s.updated_at,
       COUNT(rs.release_id) FILTER (WHERE r.status = 'published') AS release_count,
       (
         SELECT r2.cover_image
         FROM release_series rs2
         JOIN releases r2 ON r2.id = rs2.release_id
         WHERE rs2.series_id = s.id AND r2.status = 'published'
         ORDER BY rs2.phase_number ASC NULLS LAST, r2.release_date ASC NULLS LAST
         LIMIT 1
       ) AS cover_image
     FROM series s
     LEFT JOIN release_series rs ON rs.series_id = s.id
     LEFT JOIN releases r ON r.id = rs.release_id
     GROUP BY s.id
     ORDER BY s.title ASC`,
  )
}

export async function fetchSeriesById(id: string) {
  return dbQueryOne<Series>(
    `SELECT ${seriesColumns} FROM series WHERE id = $1 LIMIT 1`,
    [id],
  )
}

/**
 * Fetch a series and its published releases in a single database round-trip.
 *
 * LEFT JOIN LATERAL keeps an empty series as one row with no release; the
 * release projection intentionally uses the same PG types as the old query.
 */
async function fetchSeriesWithReleasesBy(
  key: 'slug' | 'id',
  value: string,
): Promise<(Series & { releases: SeriesRelease[] }) | null> {
  type SeriesRow = Series & {
    release_id: string | null
    release_title: string | null
    release_slug: string | null
    release_annotation: string | null
    release_cover_image: string | null
    release_date: string | null
    phase_number: number | null
  }
  const rows = await dbQuery<SeriesRow>(
    `SELECT
       s.id, s.title, s.slug, s.description, s.created_at, s.updated_at,
       rel.id AS release_id, rel.title AS release_title, rel.slug AS release_slug,
       rel.annotation AS release_annotation, rel.cover_image AS release_cover_image,
       rel.release_date, rel.phase_number
     FROM series s
     LEFT JOIN LATERAL (
       SELECT r.id, r.title, r.slug, r.annotation, r.cover_image, r.release_date,
              rs.phase_number
       FROM release_series rs
       JOIN releases r ON r.id = rs.release_id
       WHERE rs.series_id = s.id AND r.status = 'published'
       ORDER BY COALESCE(rs.phase_number, 0) ASC NULLS LAST,
                r.release_date ASC NULLS LAST
     ) rel ON true
     WHERE ${key === 'id' ? 's.id' : 's.slug'} = $1
     ORDER BY COALESCE(rel.phase_number, 0) ASC NULLS LAST,
              rel.release_date ASC NULLS LAST`,
    [value],
  )
  if (!rows.length) return null

  const {
    release_id: _releaseId, release_title: _releaseTitle, release_slug: _releaseSlug,
    release_annotation: _releaseAnnotation, release_cover_image: _releaseCoverImage,
    release_date: _releaseDate, phase_number: _phaseNumber,
    ...series
  } = rows[0]
  const releases: SeriesRelease[] = rows.flatMap(row =>
    row.release_id && row.release_title !== null && row.release_slug !== null
      ? [{
          id: row.release_id,
          title: row.release_title,
          slug: row.release_slug,
          annotation: row.release_annotation,
          cover_image: row.release_cover_image,
          release_date: row.release_date,
          phase_number: row.phase_number,
        }]
      : [],
  )
  return { ...series, releases }
}

export function fetchSeriesWithReleases(slug: string) {
  return fetchSeriesWithReleasesBy('slug', slug)
}

export function fetchSeriesWithReleasesById(id: string) {
  return fetchSeriesWithReleasesBy('id', id)
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

/**
 * Серии, в которых у персонажа есть `role = 'main'` хотя бы в одном релизе серии.
 *
 * Для subjectOf на странице персонажа: идёт как `CreativeWorkSeries`
 * с агрегацией по серии. Один выпуск серии с главным героем привязывает
 * серию целиком — иначе получается дубль в графе.
 */
export async function fetchSeriesByCharacter(characterId: string): Promise<Series[]> {
  return dbQuery<Series>(
    `SELECT DISTINCT ${seriesColumns}
     FROM series s
     JOIN release_series rs ON rs.series_id = s.id
     JOIN release_characters rc ON rc.release_id = rs.release_id
     WHERE rc.character_id = $1 AND rc.role = 'main'
     ORDER BY s.title ASC`,
    [characterId],
  )
}
