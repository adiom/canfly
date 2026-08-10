import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import {
  fetchAllCharactersList,
  fetchCharacterById,
  fetchCharacterBySlug,
  createCharacter,
  updateCharacter,
  updatePassport,
} from '@/lib/server/characters'

export function registerCharactersTools(server: McpServer) {
  server.tool(
    'canfly_list_characters',
    'Получить список всех персонажей и городов literary universe canfly. Возвращает массив объектов Character с полями: id, name, slug, avatar, bio, character_type (person/city), passport и др.',
    {},
    async () => {
      try {
        const characters = await fetchAllCharactersList()
        return {
          content: [{ type: 'text', text: JSON.stringify(characters, null, 2) }],
        }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_get_character',
    'Получить одного персонажа по ID или slug. Возвращает полный объект персонажа со всеми полями (bio, full_description, abilities, speaking_style, personality и т.д.)',
    {
      id: z.string().optional().describe('UUID персонажа (либо id, либо slug)'),
      slug: z.string().optional().describe('Slug персонажа (либо id, либо slug)'),
    },
    async ({ id, slug }) => {
      try {
        if (!id && !slug) {
          return {
            content: [{ type: 'text', text: 'Нужно указать id или slug' }],
            isError: true,
          }
        }

        if (id) {
          const character = await fetchCharacterById(id)
          if (!character) {
            return { content: [{ type: 'text', text: `Персонаж с id="${id}" не найден` }], isError: true }
          }
          return { content: [{ type: 'text', text: JSON.stringify(character, null, 2) }] }
        }

        const result = await fetchCharacterBySlug(slug!)
        if (!result) {
          return { content: [{ type: 'text', text: `Персонаж со slug="${slug}" не найден` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_create_character',
    'Создать нового персонажа. Обязательны name и slug. character_type: person (по умолчанию) или city. abilities — JSON-массив строк. Возвращает созданный объект.',
    {
      name: z.string().describe('Имя персонажа'),
      slug: z.string().describe('URL-friendly slug (уникальный)'),
      bio: z.string().optional().describe('Краткое описание (одна строка)'),
      full_description: z.string().optional().describe('Полное описание персонажа'),
      character_type: z.enum(['person', 'city']).optional().describe('Тип: person или city'),
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
      reply_mode: z.enum(['ai_auto', 'manual', 'hybrid', 'disabled']).optional(),
      can_receive_messages: z.boolean().optional(),
    },
    async (data) => {
      try {
        const character = await createCharacter(data)
        return { content: [{ type: 'text', text: JSON.stringify(character, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_update_character',
    'Обновить персонажа целиком. ОБЯЗАТЕЛЬНО сначала вызвать canfly_get_character, чтобы прочитать текущие данные, иначе можно затереть неизвестные поля. Возвращает обновлённый объект.',
    {
      id: z.string().describe('UUID персонажа'),
      name: z.string().describe('Имя'),
      slug: z.string().describe('Slug'),
      bio: z.string().nullable().optional().describe('Краткое описание'),
      full_description: z.string().nullable().optional().describe('Полное описание'),
      character_type: z.enum(['person', 'city']).optional().describe('Тип персонажа'),
      abilities: z.array(z.string()).optional().describe('Способности (JSON-массив)'),
      speaking_style: z.string().nullable().optional().describe('Стиль речи'),
      personality: z.string().nullable().optional().describe('Характер'),
      boundaries: z.string().nullable().optional().describe('Границы'),
      knowledge_scope: z.string().nullable().optional().describe('Область знаний'),
      spoiler_policy: z.string().nullable().optional().describe('Политика спойлеров'),
      system_role: z.string().optional().describe('Системная инструкция для чат-бота'),
      passport: z.string().nullable().optional().describe('Паспорт'),
      avatar: z.string().nullable().optional().describe('URL аватара'),
      map_image_url: z.string().nullable().optional().describe('URL карты'),
      reply_mode: z.enum(['ai_auto', 'manual', 'hybrid', 'disabled']).optional(),
      can_receive_messages: z.boolean().optional(),
    },
    async (data) => {
      try {
        const character = await updateCharacter(data.id, data)
        if (!character) {
          return { content: [{ type: 'text', text: `Персонаж с id="${data.id}" не найден` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(character, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )

  server.tool(
    'canfly_update_character_passport',
    'Точечно обновить только поле passport персонажа. Не требует полной перезаписи. Возвращает обновлённый объект.',
    {
      id: z.string().describe('UUID персонажа'),
      passport: z.string().nullable().describe('Новый текст паспорта (null — очистить)'),
    },
    async ({ id, passport }) => {
      try {
        const character = await updatePassport(id, passport)
        if (!character) {
          return { content: [{ type: 'text', text: `Персонаж с id="${id}" не найден` }], isError: true }
        }
        return { content: [{ type: 'text', text: JSON.stringify(character, null, 2) }] }
      } catch (e) {
        return {
          content: [{ type: 'text', text: `Ошибка: ${e instanceof Error ? e.message : String(e)}` }],
          isError: true,
        }
      }
    },
  )
}
