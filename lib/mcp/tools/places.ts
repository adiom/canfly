import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  fetchAllPlaces,
  fetchPlaceById,
  fetchPlaceBySlug,
  createPlace,
  updatePlace,
  deletePlace,
  fetchPlaceCharacters,
  fetchPlacesByCharacter,
  setCharacterPlaces,
} from '@/lib/server/places'
import { fetchCharacterById } from '@/lib/server/characters'
import { json, notFound, pick, toolError, withToolCatch } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

const placeListFields = ['id', 'name', 'slug', 'avatar', 'bio'] as const

export function registerPlacesTools(server: McpServer) {
  server.registerTool(
    'canfly_list_places',
    {
      title: 'Список мест',
      description:
        'Города и локации вселенной canfly. Возвращает укороченные карточки: id, name, slug, avatar, bio.',
      inputSchema: z.object({
        limit: z.number().int().min(1).max(200).default(100).describe('Сколько вернуть'),
        offset: z.number().int().min(0).default(0).describe('Сдвиг'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ limit, offset }) => {
      const all = await fetchAllPlaces()
      return json({
        total: all.length,
        items: all.slice(offset, offset + limit).map((p) => pick(p, placeListFields)),
      })
    }),
  )

  server.registerTool(
    'canfly_get_place',
    {
      title: 'Место по ID или slug',
      description: 'Полный объект места со всеми полями.',
      inputSchema: z.object({
        id: uuid.optional().describe('UUID места (либо id, либо slug)'),
        slug: z.string().optional().describe('Slug места (либо id, либо slug)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id, slug }) => {
      if (id) {
        const place = await fetchPlaceById(id)
        return place ? json(place) : notFound('Место', id)
      }
      if (slug) {
        const place = await fetchPlaceBySlug(slug)
        return place ? json(place) : toolError(`Место со slug="${slug}" не найдено`)
      }
      return toolError('Нужно указать id или slug')
    }),
  )

  server.registerTool(
    'canfly_create_place',
    {
      title: 'Создать место',
      description: 'Создать новое место/город. Обязательны name и slug.',
      inputSchema: z.object({
        name: z.string().describe('Название места'),
        slug: z.string().describe('URL-friendly slug (уникальный)'),
        bio: z.string().optional().describe('Краткое описание'),
        full_description: z.string().optional().describe('Полное описание'),
        avatar: z.string().optional().describe('URL аватара'),
        map_image_url: z.string().optional().describe('URL карты'),
        theme_color: z.string().optional().describe('Тематический цвет'),
        era: z.string().optional().describe('Эпоха'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    withToolCatch(async (data) => json(await createPlace(data))),
  )

  server.registerTool(
    'canfly_update_place',
    {
      title: 'Обновить место',
      description: 'Обновить место. Апдейт частичный.',
      inputSchema: z.object({
        id: uuid.describe('UUID места'),
        name: z.string().optional().describe('Название'),
        slug: z.string().optional().describe('Slug'),
        bio: z.string().nullable().optional().describe('Краткое описание'),
        full_description: z.string().nullable().optional().describe('Полное описание'),
        avatar: z.string().nullable().optional().describe('URL аватара'),
        map_image_url: z.string().nullable().optional().describe('URL карты'),
        theme_color: z.string().nullable().optional().describe('Тематический цвет'),
        era: z.string().nullable().optional().describe('Эпоха'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ id, ...data }) => {
      const place = await updatePlace(id, data)
      return place ? json(place) : notFound('Место', id)
    }),
  )

  server.registerTool(
    'canfly_delete_place',
    {
      title: 'Удалить место',
      description: 'Удалить место и все связи.',
      inputSchema: z.object({
        id: uuid.describe('UUID места'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ id }) => {
      const place = await fetchPlaceById(id)
      if (!place) return notFound('Место', id)
      await deletePlace(id)
      return json({ ok: true, deleted: place.name })
    }),
  )

  server.registerTool(
    'canfly_get_place_characters',
    {
      title: 'Персонажи места',
      description: 'Какие персонажи проживают в данном месте.',
      inputSchema: z.object({
        id: uuid.describe('UUID места'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ id }) => {
      const chars = await fetchPlaceCharacters(id)
      return json({ total: chars.length, items: chars })
    }),
  )

  server.registerTool(
    'canfly_list_character_places',
    {
      title: 'Места персонажа',
      description: 'Места, привязанные к персонажу.',
      inputSchema: z.object({
        character_id: uuid.describe('UUID персонажа'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    withToolCatch(async ({ character_id }) => {
      const items = await fetchPlacesByCharacter(character_id)
      return json({ total: items.length, items })
    }),
  )

  server.registerTool(
    'canfly_set_character_places',
    {
      title: 'Привязать места к персонажу',
      description:
        'Атомарно заменить список мест персонажа. Пустой массив очищает связи.',
      inputSchema: z.object({
        character_id: uuid.describe('UUID персонажа'),
        place_ids: z.array(uuid.describe('UUID места')).max(200).describe('Полный новый список мест'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    withToolCatch(async ({ character_id, place_ids }) => {
      const character = await fetchCharacterById(character_id)
      if (!character) return notFound('Персонаж', character_id)

      await setCharacterPlaces(character_id, place_ids)
      return json({ ok: true, total: place_ids.length })
    }),
  )
}
