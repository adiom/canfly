import { dbQuery, dbQueryOne, dbUpdatePartial, withTransaction } from '@/lib/db'
import type { UpdatableColumn } from '@/lib/db'
import type { Place, ReleasePlaceLink, CharacterPlaceLink } from '@/lib/types'

// === Places CRUD ===

export async function fetchPublicPlaces(): Promise<Place[]> {
  return dbQuery<Place>('SELECT * FROM places ORDER BY created_at DESC')
}

export async function fetchAllPlaces(): Promise<Place[]> {
  return dbQuery<Place>('SELECT * FROM places ORDER BY created_at DESC')
}

export async function fetchPlaceBySlug(slug: string): Promise<Place | null> {
  return dbQueryOne<Place>('SELECT * FROM places WHERE slug = $1 LIMIT 1', [slug])
}

export async function fetchPlaceById(id: string): Promise<Place | null> {
  return dbQueryOne<Place>('SELECT * FROM places WHERE id = $1 LIMIT 1', [id])
}

export async function createPlace(data: Record<string, unknown>): Promise<Place | null> {
  return dbQueryOne<Place>(
    `INSERT INTO places (name, slug, avatar, bio, full_description, map_image_url, theme_color, era)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      data.name,
      data.slug,
      data.avatar ?? null,
      data.bio ?? null,
      data.full_description ?? null,
      data.map_image_url ?? null,
      data.theme_color ?? null,
      data.era ?? null,
    ],
  )
}

const placeUpdatable: Record<string, UpdatableColumn> = {
  name: { column: 'name' },
  slug: { column: 'slug' },
  avatar: { column: 'avatar' },
  bio: { column: 'bio' },
  full_description: { column: 'full_description' },
  map_image_url: { column: 'map_image_url' },
  theme_color: { column: 'theme_color' },
  era: { column: 'era' },
}

export async function updatePlace(id: string, data: Record<string, unknown>): Promise<Place | null> {
  return dbUpdatePartial<Place>({
    table: 'places',
    id,
    data,
    columns: placeUpdatable,
    returning: '*',
  })
}

export async function deletePlace(id: string): Promise<void> {
  await dbQuery('DELETE FROM places WHERE id = $1', [id])
}

// === Release ↔ Place ===

export async function fetchReleasePlaces(releaseId: string): Promise<ReleasePlaceLink[]> {
  return dbQuery<ReleasePlaceLink>(
    `SELECT rp.release_id, p.slug AS release_slug, p.name AS release_title, rp.role
     FROM release_places rp
     JOIN places p ON p.id = rp.place_id
     WHERE rp.release_id = $1`,
    [releaseId],
  )
}

export async function fetchPlacesByRelease(releaseId: string): Promise<Array<Place & { role: string }>> {
  return dbQuery<Place & { role: string }>(
    `SELECT p.*, rp.role
     FROM places p
     JOIN release_places rp ON rp.place_id = p.id
     WHERE rp.release_id = $1
     ORDER BY p.name`,
    [releaseId],
  )
}

export async function fetchPlacesForReleases(releaseIds: string[]): Promise<Array<Place & { release_id: string; role: string }>> {
  if (releaseIds.length === 0) return []
  return dbQuery<Place & { release_id: string; role: string }>(
    `SELECT p.*, rp.release_id, rp.role
     FROM places p
     JOIN release_places rp ON rp.place_id = p.id
     WHERE rp.release_id = ANY($1::uuid[])`,
    [releaseIds],
  )
}

export async function setReleasePlaces(releaseId: string, placeIds: string[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM release_places WHERE release_id = $1', [releaseId])
    if (placeIds.length === 0) return
    const values = placeIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await client.query(
      `INSERT INTO release_places (release_id, place_id) VALUES ${values}`,
      [releaseId, ...placeIds],
    )
  })
}

// === Character ↔ Place ===

export async function fetchPlaceCharacters(placeId: string): Promise<CharacterPlaceLink[]> {
  return dbQuery<CharacterPlaceLink>(
    `SELECT c.id AS character_id, c.name AS character_name, c.slug AS character_slug,
            c.avatar AS character_avatar, cp.role
     FROM character_places cp
     JOIN characters c ON c.id = cp.character_id
     WHERE cp.place_id = $1
     ORDER BY c.name`,
    [placeId],
  )
}

export async function fetchPlacesByCharacter(characterId: string): Promise<Array<Place & { role: string }>> {
  return dbQuery<Place & { role: string }>(
    `SELECT p.*, cp.role
     FROM places p
     JOIN character_places cp ON cp.place_id = p.id
     WHERE cp.character_id = $1
     ORDER BY p.name`,
    [characterId],
  )
}

export async function fetchPlacesForCharacters(characterIds: string[]): Promise<Array<Place & { character_id: string; role: string }>> {
  if (characterIds.length === 0) return []
  return dbQuery<Place & { character_id: string; role: string }>(
    `SELECT p.*, cp.character_id, cp.role
     FROM places p
     JOIN character_places cp ON cp.place_id = p.id
     WHERE cp.character_id = ANY($1::uuid[])`,
    [characterIds],
  )
}

export async function setCharacterPlaces(characterId: string, placeIds: string[]): Promise<void> {
  await withTransaction(async (client) => {
    await client.query('DELETE FROM character_places WHERE character_id = $1', [characterId])
    if (placeIds.length === 0) return
    const values = placeIds.map((_, i) => `($1, $${i + 2})`).join(', ')
    await client.query(
      `INSERT INTO character_places (character_id, place_id) VALUES ${values}`,
      [characterId, ...placeIds],
    )
  })
}
