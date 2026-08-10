import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  fetchAllCharactersList,
  fetchCharacterById,
  fetchCharacterBySlug,
  createCharacter,
  updateCharacter,
  updatePassport,
} from '@/lib/server/characters'
import { json, notFound, pick, toolError } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

const characterType = z.enum(['person', 'city'])
const replyMode = z.enum(['ai_auto', 'manual', 'hybrid', 'disabled'])

/** Карточка персонажа в списке — без full_description/passport/system_role. */
const characterListFields = ['id', 'name', 'slug', 'avatar', 'bio', 'character_type'] as const

export function registerCharactersTools(server: McpServer) {
  server.registerTool(
    'canfly_list_characters',
    {
      title: 'Список персонажей',
      description:
        'Персонажи и города вселенной canfly. Возвращает укороченные карточки: id, name, slug, avatar, bio, character_type. Полные данные (full_description, passport, abilities) — через canfly_get_character.',
      inputSchema: z.object({
        character_type: characterType.optional().describe('Фильтр по типу'),
        limit: z.number().int().min(1).max(200).default(100).describe('Сколько вернуть'),
        offset: z.number().int().min(0).default(0).describe('Сдвиг для постраничного обхода'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ character_type, limit, offset }) => {
      const all = await fetchAllCharactersList()
      const filtered = character_type
        ? all.filter((c) => c.character_type === character_type)
        : all
      return json({
        total: filtered.length,
        items: filtered.slice(offset, offset + limit).map((c) => pick(c, characterListFields)),
      })
    },
  )

  server.registerTool(
    'canfly_get_character',
    {
      title: 'Персонаж по ID или slug',
      description:
        'Полный объект персонажа со всеми полями (bio, full_description, abilities, speaking_style, personality и т.д.).',
      inputSchema: z.object({
        id: uuid.optional().describe('UUID персонажа (либо id, либо slug)'),
        slug: z.string().optional().describe('Slug персонажа (либо id, либо slug)'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ id, slug }) => {
      if (id) {
        const character = await fetchCharacterById(id)
        return character ? json(character) : notFound('Персонаж', id)
      }
      if (slug) {
        const result = await fetchCharacterBySlug(slug)
        return result ? json(result) : toolError(`Персонаж со slug="${slug}" не найден`)
      }
      return toolError('Нужно указать id или slug')
    },
  )

  server.registerTool(
    'canfly_create_character',
    {
      title: 'Создать персонажа',
      description:
        'Создать нового персонажа. Обязательны name и slug. character_type: person (по умолчанию) или city.',
      inputSchema: z.object({
        name: z.string().describe('Имя персонажа'),
        slug: z.string().describe('URL-friendly slug (уникальный)'),
        bio: z.string().optional().describe('Краткое описание (одна строка)'),
        full_description: z.string().optional().describe('Полное описание персонажа'),
        character_type: characterType.optional().describe('Тип: person или city'),
        abilities: z.array(z.string()).optional().describe('Список способностей'),
        speaking_style: z.string().optional().describe('Стиль речи'),
        personality: z.string().optional().describe('Характер'),
        boundaries: z.string().optional().describe('Границы поведения'),
        knowledge_scope: z.string().optional().describe('Область знаний'),
        spoiler_policy: z.string().optional().describe('Политика спойлеров'),
        system_role: z.string().optional().describe('Системная инструкция для чат-бота'),
        passport: z.string().optional().describe('Паспорт персонажа'),
        avatar: z.string().optional().describe('URL аватара'),
        map_image_url: z.string().optional().describe('URL карты'),
        reply_mode: replyMode.optional().describe('Режим ответов'),
        can_receive_messages: z.boolean().optional().describe('Принимает сообщения'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false },
    },
    async (data) => json(await createCharacter(data)),
  )

  server.registerTool(
    'canfly_update_character',
    {
      title: 'Обновить персонажа',
      description:
        'Обновить персонажа. Апдейт частичный: непереданные поля сохраняют текущее значение, явный null очищает поле.',
      inputSchema: z.object({
        id: uuid.describe('UUID персонажа'),
        name: z.string().optional().describe('Имя'),
        slug: z.string().optional().describe('Slug'),
        bio: z.string().nullable().optional().describe('Краткое описание'),
        full_description: z.string().nullable().optional().describe('Полное описание'),
        character_type: characterType.optional().describe('Тип персонажа'),
        abilities: z.array(z.string()).optional().describe('Способности'),
        speaking_style: z.string().nullable().optional().describe('Стиль речи'),
        personality: z.string().nullable().optional().describe('Характер'),
        boundaries: z.string().nullable().optional().describe('Границы'),
        knowledge_scope: z.string().nullable().optional().describe('Область знаний'),
        spoiler_policy: z.string().nullable().optional().describe('Политика спойлеров'),
        system_role: z.string().optional().describe('Системная инструкция для чат-бота'),
        passport: z.string().nullable().optional().describe('Паспорт'),
        avatar: z.string().nullable().optional().describe('URL аватара'),
        map_image_url: z.string().nullable().optional().describe('URL карты'),
        reply_mode: replyMode.optional().describe('Режим ответов'),
        can_receive_messages: z.boolean().optional().describe('Принимает сообщения'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id, ...data }) => {
      const character = await updateCharacter(id, data)
      return character ? json(character) : notFound('Персонаж', id)
    },
  )

  server.registerTool(
    'canfly_update_character_passport',
    {
      title: 'Паспорт персонажа',
      description: 'Точечно обновить только поле passport персонажа.',
      inputSchema: z.object({
        id: uuid.describe('UUID персонажа'),
        passport: z.string().nullable().describe('Новый текст паспорта (null — очистить)'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ id, passport }) => {
      const character = await updatePassport(id, passport)
      return character ? json(character) : notFound('Персонаж', id)
    },
  )
}
