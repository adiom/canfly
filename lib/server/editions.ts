import { dbQuery, dbQueryOne } from '@/lib/db'
import type { Edition } from '@/lib/releases-types'
import { generateEditionSlug } from '@/lib/slug-utils'

const editionColumns = `
  id, release_id, format, platform, external_url,
  slug, status, is_primary, quality_tier, created_at, updated_at
`

export async function fetchEditionsByRelease(releaseId: string) {
  return dbQuery<Edition>(
    `SELECT ${editionColumns} FROM editions
     WHERE release_id = $1
     ORDER BY created_at ASC`,
    [releaseId],
  )
}

export async function fetchEditionById(id: string) {
  return dbQueryOne<Edition>(
    `SELECT ${editionColumns} FROM editions WHERE id = $1 LIMIT 1`,
    [id],
  )
}

export async function fetchEditionBySlug(slug: string) {
  return dbQueryOne<Edition>(
    `SELECT ${editionColumns} FROM editions WHERE slug = $1 LIMIT 1`,
    [slug],
  )
}

export async function fetchEditionByReleaseFormatTier(
  releaseId: string,
  format: string,
  qualityTier: string
) {
  return dbQueryOne<Edition>(
    `SELECT ${editionColumns} FROM editions
     WHERE release_id = $1 AND format = $2::edition_format AND quality_tier = $3 LIMIT 1`,
    [releaseId, format, qualityTier],
  )
}

/**
 * Опубликованные издания опубликованных релизов вместе со слагом релиза —
 * для sitemap: без слага релиза URL оглавления не собрать.
 */
export async function fetchPublishedEditionsForSitemap() {
  return dbQuery<Edition & { release_slug: string; release_updated_at: string }>(
    `SELECT e.id, e.release_id, e.format, e.platform, e.external_url,
            e.slug, e.status, e.is_primary, e.quality_tier, e.created_at, e.updated_at,
            r.slug AS release_slug, r.updated_at AS release_updated_at
     FROM editions e
     JOIN releases r ON r.id = e.release_id
     WHERE e.status = 'published' AND r.status = 'published'
     ORDER BY r.slug ASC, e.created_at ASC`,
  )
}

export async function createEdition(data: Record<string, unknown>) {
  const uniqueSlug = generateEditionSlug(
    data.release_id as string,
    (data.format as string) ?? 'book',
    (data.quality_tier as string) ?? 'standard'
  )

  return dbQueryOne<Edition>(
    `INSERT INTO editions (release_id, format, platform, external_url, slug, status, is_primary, quality_tier)
     VALUES ($1, $2::edition_format, $3, $4, $5, $6::edition_status, $7, $8)
     RETURNING ${editionColumns}`,
    [
      data.release_id,
      data.format ?? 'book',
      data.platform ?? null,
      data.external_url ?? null,
      uniqueSlug,
      data.status ?? 'draft',
      data.is_primary ?? false,
      data.quality_tier ?? 'standard',
    ],
  )
}

export async function updateEdition(id: string, data: Record<string, unknown>) {
  const current = await fetchEditionById(id)
  if (!current) throw new Error('Edition not found')

  // Slug генерируется один раз при создании и больше не меняется
  return dbQueryOne<Edition>(
    `UPDATE editions SET
      format = $2::edition_format, platform = $3, external_url = $4,
      status = $5::edition_status, is_primary = $6, quality_tier = $7
     WHERE id = $1
     RETURNING ${editionColumns}`,
    [
      id,
      data.format ?? 'book',
      data.platform ?? null,
      data.external_url ?? null,
      data.status ?? 'draft',
      data.is_primary ?? false,
      data.quality_tier ?? 'standard',
    ],
  )
}

export async function updateEditionStatus(id: string, status: string) {
  return dbQueryOne<Edition>(
    `UPDATE editions SET status = $2::edition_status WHERE id = $1 RETURNING ${editionColumns}`,
    [id, status],
  )
}

export async function deleteEdition(id: string) {
  await dbQuery('DELETE FROM editions WHERE id = $1', [id])
}
