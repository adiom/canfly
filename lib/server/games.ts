import { dbQuery, dbQueryOne, dbUpdatePartial, withTransaction } from '@/lib/db'
import type { UpdatableColumn } from '@/lib/db'
import type { CharacterGame, Game, ReleaseGame } from '@/lib/releases-types'

// === Публичные выборки ===

/**
 * Игры для каталога и блоков на страницах. Порядок задаётся в Studio:
 * `display_order`, затем — по названию, чтобы свежие игры не переезжали сами.
 */
export async function fetchPublishedGames(): Promise<Game[]> {
  return dbQuery<Game>(
    `SELECT * FROM games
     WHERE is_published = TRUE
     ORDER BY display_order, title`,
  )
}

export async function fetchPublishedGameBySlug(slug: string): Promise<Game | null> {
  return dbQueryOne<Game>(
    `SELECT * FROM games WHERE slug = $1 AND is_published = TRUE LIMIT 1`,
    [slug],
  )
}

// === Studio ===

export async function fetchAllGames(): Promise<Game[]> {
  return dbQuery<Game>(`SELECT * FROM games ORDER BY display_order, title`)
}

export async function fetchGameById(id: string): Promise<Game | null> {
  return dbQueryOne<Game>('SELECT * FROM games WHERE id = $1 LIMIT 1', [id])
}

export async function createGame(data: Record<string, unknown>): Promise<Game | null> {
  return dbQueryOne<Game>(
    `INSERT INTO games (title, slug, tagline, description, cover_image, aspect_ratio, display_order, is_published)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.title,
      data.slug,
      data.tagline ?? null,
      data.description ?? null,
      data.cover_image ?? null,
      data.aspect_ratio ?? '16:9',
      data.display_order ?? 0,
      data.is_published ?? false,
    ],
  )
}

const gameUpdatable: Record<string, UpdatableColumn> = {
  title: { column: 'title' },
  slug: { column: 'slug' },
  tagline: { column: 'tagline' },
  description: { column: 'description' },
  cover_image: { column: 'cover_image' },
  aspect_ratio: { column: 'aspect_ratio' },
  display_order: { column: 'display_order' },
  is_published: { column: 'is_published' },
}

export async function updateGame(id: string, data: Record<string, unknown>): Promise<Game | null> {
  return dbUpdatePartial<Game>({
    table: 'games',
    id,
    data,
    columns: gameUpdatable,
    returning: '*',
  })
}

export async function deleteGame(id: string): Promise<void> {
  await dbQuery('DELETE FROM games WHERE id = $1', [id])
}

// === Связи игры с персонажами и релизами ===

export async function fetchGameCharacters(gameId: string): Promise<CharacterGame[]> {
  return dbQuery<CharacterGame>(
    `SELECT c.id AS character_id, c.name AS character_name, c.slug AS character_slug,
            c.avatar AS character_avatar
     FROM character_games cg
     JOIN characters c ON c.id = cg.character_id
     WHERE cg.game_id = $1
     ORDER BY c.name`,
    [gameId],
  )
}

export async function fetchGameReleases(
  gameId: string,
  options: { onlyPublished?: boolean } = {},
): Promise<ReleaseGame[]> {
  const { onlyPublished = true } = options
  return dbQuery<ReleaseGame>(
    `SELECT r.id AS release_id, r.slug AS release_slug, r.title AS release_title
     FROM release_games rg
     JOIN releases r ON r.id = rg.release_id
     WHERE rg.game_id = $1${onlyPublished ? " AND r.status = 'published'" : ''}
     ORDER BY r.title`,
    [gameId],
  )
}

export async function fetchGamesByCharacter(characterId: string): Promise<Game[]> {
  return dbQuery<Game>(
    `SELECT g.*
     FROM games g
     JOIN character_games cg ON cg.game_id = g.id
     WHERE cg.character_id = $1 AND g.is_published = TRUE
     ORDER BY g.display_order, g.title`,
    [characterId],
  )
}

export async function fetchGamesByRelease(
  releaseId: string,
  options: { onlyPublished?: boolean } = {},
): Promise<Game[]> {
  const { onlyPublished = true } = options
  return dbQuery<Game>(
    `SELECT g.*
     FROM games g
     JOIN release_games rg ON rg.game_id = g.id
     WHERE rg.release_id = $1${onlyPublished ? ' AND g.is_published = TRUE' : ''}
     ORDER BY g.display_order, g.title`,
    [releaseId],
  )
}

/** Полная замена связей игры с персонажами: один путь правки — форма игры. */
export async function setGameCharacters(gameId: string, characterIds: string[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM character_games WHERE game_id = $1', [gameId])
    if (characterIds.length === 0) return
    const values = characterIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await client.query(
      `INSERT INTO character_games (game_id, character_id) VALUES ${values}`,
      [gameId, ...characterIds],
    )
  })
}

export async function setGameReleases(gameId: string, releaseIds: string[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM release_games WHERE game_id = $1', [gameId])
    if (releaseIds.length === 0) return
    const values = releaseIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await client.query(
      `INSERT INTO release_games (game_id, release_id) VALUES ${values}`,
      [gameId, ...releaseIds],
    )
  })
}
