import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import {
  fetchCharacterRelationships,
  searchCharactersForRelationship,
  upsertMutualCharacterRelationship,
  deleteMutualCharacterRelationship,
} from '@/lib/server/character-relationships'
import { isDefaultRelationshipKey, RELATIONSHIP_KINDS } from '@/lib/relationships-kinds'
import { json, pick, toolError } from '@/lib/mcp/tool-result'

const uuid = z.uuid()

const relationshipListFields = [
  'id',
  'character_id',
  'related_character_id',
  'relationship_type',
  'description',
  'created_at',
  'is_mutual',
  'inverse_type',
  'related_name',
  'related_slug',
  'related_avatar',
  'related_type',
] as const

const RELATIONSHIP_TYPE_NOTES = [
  'Тип связи. Дефолтные ключи: ' +
    RELATIONSHIP_KINDS.map((k) => `${k.key} (${k.label.toLowerCase()})`).join(', ') +
    '. Для любого другого значения необходимо передать custom=true.',
  'ВАЖНО при mutual=true: асимметричные типы (mentor, subordinate, creator) с ',
  'обратной связью семантически некорректны (B→A получит тот же тип, что значит ',
  '«B наставник A», а не «B ученик A»). Для асимметричных делайте два отдельных ',
  'вызова (A→B с mentor, B→A с нужным типом). Симметричные (ally, rival, family, ',
  'romantic, comrade, enemy) — mutual=true работает корректно.',
].join('')

export function registerCharacterRelationshipsTools(server: McpServer) {
  server.registerTool(
    'canfly_list_character_relationships',
    {
      title: 'Список связей персонажа',
      description:
        'Исходящие связи A→B с данными цели (related_*) и пометкой взаимности is_mutual. inverse_type — тип обратной связи, если она есть. Обрезано до limit для контекста AI.',
      inputSchema: z.object({
        character_id: uuid.describe('UUID персонажа — источника связи'),
        limit: z.number().int().min(1).max(200).default(50).describe('Сколько вернуть'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ character_id, limit }) => {
      const all = await fetchCharacterRelationships(character_id)
      return json({
        total: all.length,
        items: all.slice(0, limit).map((r) => pick(r, relationshipListFields)),
      })
    },
  )

  server.registerTool(
    'canfly_search_characters_for_relationship',
    {
      title: 'Поиск цели для связи',
      description:
        'Поиск персонажей по имени/slug для формы «выберите цель связи». Исключает самого персонажа (exclude_character_id). Возвращает id, name, slug, avatar, character_type.',
      inputSchema: z.object({
        exclude_character_id: uuid.describe('UUID персонажа-источника (исключается из выдачи)'),
        query: z.string().min(2, 'Минимум 2 символа').describe('Поисковый термин (имя или slug)'),
        limit: z.number().int().min(1).max(50).default(12).describe('Сколько вернуть'),
      }),
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ exclude_character_id, query, limit }) => {
      const items = await searchCharactersForRelationship({
        excludeCharacterId: exclude_character_id,
        query,
        limit,
      })
      return json({ total: items.length, items })
    },
  )

  server.registerTool(
    'canfly_upsert_character_relationship',
    {
      title: 'Создать/обновить связь персонажа',
      description:
        'Upsert направленной связи A→B (character_id → related_character_id). ' +
        'Идемпотентно: при повторе с тем же типом/описанием ничего не меняется, при изменении — апдейтит поля. ' +
        'При mutual=true — атомарно создаёт и обратную B→A с тем же типом и описанием.',
      inputSchema: z
        .object({
          character_id: uuid.describe('UUID персонажа — источника связи (A)'),
          related_character_id: uuid.describe('UUID персонажа — цели связи (B)'),
          relationship_type: z
            .string()
            .min(1, 'Укажите тип связи')
            .max(60, 'Тип связи слишком длинный')
            .describe(RELATIONSHIP_TYPE_NOTES),
          description: z
            .string()
            .max(600, 'Описание слишком длинное')
            .nullable()
            .optional()
            .describe('Описание/история связи (≤ 600 символов), null — очистить'),
          custom: z
            .boolean()
            .default(false)
            .describe('true — разрешить нестандартный relationship_type (не из дефолтного списка)'),
          mutual: z
            .boolean()
            .default(false)
            .describe('true — атомарно создать обратную связь B→A с тем же типом/описанием'),
        })
        .superRefine((data, ctx) => {
          if (data.character_id === data.related_character_id) {
            ctx.addIssue({
              code: 'custom',
              path: ['related_character_id'],
              message: 'Персонаж не может быть связан сам с собой',
            })
          }
          if (!isDefaultRelationshipKey(data.relationship_type) && data.custom !== true) {
            ctx.addIssue({
              code: 'custom',
              path: ['relationship_type'],
              message:
                'Нестандартный тип связи требует custom=true. Дефолтные: ' +
                RELATIONSHIP_KINDS.map((k) => k.key).join(', '),
            })
          }
        }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
    },
    async ({ character_id, related_character_id, relationship_type, description, mutual }) => {
      const result = await upsertMutualCharacterRelationship({
        characterId: character_id,
        relatedCharacterId: related_character_id,
        relationshipType: relationship_type,
        description: description ?? null,
        mutual,
      })
      return json({ direct: result.direct, inverse: result.inverse })
    },
  )

  server.registerTool(
    'canfly_delete_character_relationship',
    {
      title: 'Удалить связь персонажа',
      description:
        'Удалить связь по паре (character_id, related_character_id) — list-then-delete не нужен. ' +
        'Идемпотентно: если строки нет — deleted=false. При mutual=true (по умолчанию) — ' +
        'атомарно удаляет и обратную B→A, возвращая {deleted, inverse_deleted}.',
      inputSchema: z.object({
        character_id: uuid.describe('UUID персонажа — источника связи (A)'),
        related_character_id: uuid.describe('UUID персонажа — цели связи (B)'),
        mutual: z
          .boolean()
          .default(true)
          .describe('true (default) — удалить и обратную B→A; false — только A→B'),
      }),
      annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true },
    },
    async ({ character_id, related_character_id, mutual }) => {
      if (character_id === related_character_id) {
        return toolError('Персонаж не может быть связан сам с собой')
      }
      const result = await deleteMutualCharacterRelationship({
        characterId: character_id,
        relatedCharacterId: related_character_id,
        mutual,
      })
      return json(result)
    },
  )
}
