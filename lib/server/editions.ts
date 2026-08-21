import { dbQuery, dbQueryOne, dbUpdatePartial } from '@/lib/db'
import type { UpdatableColumn } from '@/lib/db'
import type {
  Edition,
  EditionCreateInput,
  EditionUpdateInput,
  EditionWithRelease,
} from '@/lib/releases-types'

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

/**
 * Опубликованные издания опубликованных релизов вместе со слагом релиза —
 * для sitemap: без слага релиза URL оглавления не собрать.
 *
 * `digital` не попадает: у digital-изданий нет собственной страницы в
 * `/vvvvv` (там `notFound()` для этого формата) — на странице релиза они
 * ведут на внешнюю площадку (`external_url`).
 */
export async function fetchPublishedEditionsForSitemap() {
  return dbQuery<Edition & { release_slug: string; release_updated_at: string }>(
    `SELECT e.id, e.release_id, e.format, e.platform, e.external_url,
            e.slug, e.status, e.is_primary, e.quality_tier, e.created_at, e.updated_at,
            r.slug AS release_slug, r.updated_at AS release_updated_at
     FROM editions e
     JOIN releases r ON r.id = e.release_id
     WHERE e.status = 'published' AND r.status = 'published'
       AND e.format <> 'digital'
     ORDER BY r.slug ASC, e.created_at ASC`,
  )
}

// --- Сквозные списки для Studio ---

const editionWithReleaseSelect = `
  e.id, e.release_id, e.format, e.platform, e.external_url,
  e.slug, e.status, e.is_primary, e.quality_tier, e.created_at, e.updated_at,
  r.title AS release_title, r.slug AS release_slug, r.status AS release_status,
  (COUNT(c.id))::integer AS chapter_count
`

const editionWithReleaseGroupBy = `
  GROUP BY e.id, e.release_id, e.format, e.platform, e.external_url,
           e.slug, e.status, e.is_primary, e.quality_tier, e.created_at, e.updated_at,
           r.title, r.slug, r.status
  ORDER BY e.updated_at DESC
`

export async function listAllEditionsWithRelease() {
  return dbQuery<EditionWithRelease>(
    `SELECT ${editionWithReleaseSelect}
     FROM editions e
     JOIN releases r ON r.id = e.release_id
     LEFT JOIN chapters c ON c.edition_id = e.id
     ${editionWithReleaseGroupBy}`,
  )
}

/**
 * Издания релизов, где пользователь состоит коллаборатором. Ограничение по
 * `release_collaborators` — та же граница, что у `listReleasesByAuthorWithEditions`:
 * список не отдаёт чужие издания даже без отдельной проверки владения.
 */
export async function listEditionsByAuthorWithRelease(userId: string) {
  return dbQuery<EditionWithRelease>(
    `SELECT ${editionWithReleaseSelect}
     FROM editions e
     JOIN releases r ON r.id = e.release_id
     JOIN release_collaborators rc ON rc.release_id = r.id AND rc.user_id = $1
     LEFT JOIN chapters c ON c.edition_id = e.id
     ${editionWithReleaseGroupBy}`,
    [userId],
  )
}

// --- Мутации ---

const MAX_SLUG_ATTEMPTS = 50

/**
 * Слаг издания собирается из слага релиза: `{release-slug}-0`, `-1`, `-2`… .
 * Раньше база слага не зависела от релиза (`web-book`, `comic`), а уникальность
 * глобальная — поэтому копился хвост `web-book-2/3/…`, а MCP-тул без слага
 * плодил публичные адреса вида `/vvvvv/edition-7`.
 */
async function fetchReleaseSlugForEdition(releaseId: string): Promise<string> {
  const release = await dbQueryOne<{ slug: string }>(
    `SELECT slug FROM releases WHERE id = $1 LIMIT 1`,
    [releaseId],
  )
  if (!release) throw new Error('Релиз не найден')
  return release.slug
}

/**
 * Вставка с подбором слага. `ON CONFLICT (slug) DO NOTHING` делает попытку
 * атомарной: параллельное создание изданий одного релиза больше не роняет
 * запрос через unique_violation, а просто берёт следующий номер.
 */
export async function createEdition(data: EditionCreateInput) {
  const explicitSlug = data.slug?.trim()
  const baseSlug = explicitSlug || (await fetchReleaseSlugForEdition(data.release_id))
  const startIndex = explicitSlug
    ? 0
    : await countEditionsOfRelease(data.release_id)

  for (let attempt = 0; attempt < MAX_SLUG_ATTEMPTS; attempt++) {
    const candidate = explicitSlug && attempt === 0
      ? explicitSlug
      : `${baseSlug}-${startIndex + attempt}`

    const inserted = await dbQueryOne<Edition>(
      `INSERT INTO editions (release_id, format, platform, external_url, slug, status, is_primary, quality_tier)
       VALUES ($1, $2::edition_format, $3, $4, $5, $6::edition_status, $7, $8)
       ON CONFLICT (slug) DO NOTHING
       RETURNING ${editionColumns}`,
      [
        data.release_id,
        data.format ?? 'book',
        data.platform ?? null,
        data.external_url ?? null,
        candidate,
        data.status ?? 'draft',
        data.is_primary ?? false,
        data.quality_tier ?? 'standard',
      ],
    )
    if (inserted) return inserted
  }

  throw new Error(`Не удалось подобрать слаг издания для «${baseSlug}»`)
}

async function countEditionsOfRelease(releaseId: string): Promise<number> {
  const row = await dbQueryOne<{ count: number }>(
    `SELECT (COUNT(*))::integer AS count FROM editions WHERE release_id = $1`,
    [releaseId],
  )
  return row?.count ?? 0
}

/**
 * Подбор свободного слага для явного переименования из настроек издания:
 * автор задаёт основу руками, а числовой суффикс добавляется при конфликте.
 */
async function makeUniqueEditionSlugGlobal(baseSlug: string, excludeId?: string): Promise<string> {
  const existing = await dbQuery<{ slug: string }>(
    `SELECT slug FROM editions
     WHERE (slug = $1 OR slug LIKE $2) AND ($3::uuid IS NULL OR id <> $3::uuid)`,
    [baseSlug, `${baseSlug}-%`, excludeId ?? null],
  )
  const used = new Set(existing.map(e => e.slug))
  if (!used.has(baseSlug)) return baseSlug

  for (let i = 2; i < MAX_SLUG_ATTEMPTS; i++) {
    const candidate = `${baseSlug}-${i}`
    if (!used.has(candidate)) return candidate
  }
  throw new Error(`Не удалось подобрать слаг издания для «${baseSlug}»`)
}

/**
 * Колонки, которые разрешено менять через updateEdition. Ключ отсутствует в
 * data — колонка не участвует в UPDATE.
 */
const editionUpdatable: Record<string, UpdatableColumn> = {
  format: { column: 'format', cast: '::edition_format' },
  platform: { column: 'platform' },
  external_url: { column: 'external_url' },
  slug: { column: 'slug' },
  status: { column: 'status', cast: '::edition_status' },
  is_primary: { column: 'is_primary' },
  quality_tier: { column: 'quality_tier' },
}

/**
 * Частичный апдейт: перезаписываются только переданные поля. Раньше запрос
 * выставлял все колонки сразу, поэтому сохранение настроек издания (где
 * is_primary не передаётся) сбрасывало флаг основного издания в false.
 */
export async function updateEdition(id: string, data: EditionUpdateInput) {
  const patch: EditionUpdateInput = { ...data }

  const requestedSlug = data.slug?.trim()
  if (requestedSlug) {
    const current = await fetchEditionById(id)
    if (!current) throw new Error('Edition not found')
    patch.slug = requestedSlug === current.slug
      ? undefined
      : await makeUniqueEditionSlugGlobal(requestedSlug, id)
  } else {
    delete patch.slug
  }

  return dbUpdatePartial<Edition>({
    table: 'editions',
    id,
    data: patch as Record<string, unknown>,
    columns: editionUpdatable,
    returning: editionColumns,
  })
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
