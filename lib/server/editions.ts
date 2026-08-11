import { dbQuery, dbQueryOne } from '@/lib/db'
import type { Edition } from '@/lib/releases-types'

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

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * Издание по UUID или по слагу. Проверка формата обязательна: Postgres бросает
 * `invalid input syntax for type uuid` на неподходящей строке, поэтому запрос
 * по id со слагом отдал бы 500 вместо 404.
 */
export async function fetchEditionByIdOrSlug(idOrSlug: string) {
  return UUID_PATTERN.test(idOrSlug)
    ? fetchEditionById(idOrSlug)
    : fetchEditionBySlug(idOrSlug)
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
  const baseSlug = (data.slug as string)?.trim() || 'edition'
  const uniqueSlug = await makeUniqueEditionSlugGlobal(baseSlug)

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

async function makeUniqueEditionSlugGlobal(baseSlug: string): Promise<string> {
  const existing = await dbQuery<{ slug: string }>(
    `SELECT slug FROM editions WHERE slug = $1 OR slug LIKE $2`,
    [baseSlug, `${baseSlug}-%`],
  )
  const used = new Set(existing.map(e => e.slug))
  if (!used.has(baseSlug)) return baseSlug

  for (let i = 2; i < 100000; i++) {
    const candidate = `${baseSlug}-${i}`
    if (!used.has(candidate)) return candidate
  }
  return `${baseSlug}-${Date.now()}`
}

export async function updateEdition(id: string, data: Record<string, unknown>) {
  const current = await fetchEditionById(id)
  if (!current) throw new Error('Edition not found')

  let nextSlug = (data.slug as string)?.trim() || current.slug
  if (nextSlug !== current.slug) {
    const clash = await dbQuery<{ slug: string }>(
      `SELECT slug FROM editions WHERE slug = $1 AND id != $2 LIMIT 1`,
      [nextSlug, id],
    )
    if (clash.length > 0) {
      nextSlug = await makeUniqueEditionSlugGlobal(nextSlug)
    }
  }

  return dbQueryOne<Edition>(
    `UPDATE editions SET
      format = $2::edition_format, platform = $3, external_url = $4,
      slug = $5, status = $6::edition_status, is_primary = $7, quality_tier = $8
     WHERE id = $1
     RETURNING ${editionColumns}`,
    [
      id,
      data.format ?? 'book',
      data.platform ?? null,
      data.external_url ?? null,
      nextSlug,
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
