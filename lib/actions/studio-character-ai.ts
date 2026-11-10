'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { canManageCharacterAi } from '@/lib/ai/character-chat/access'
import { mergeCharacterAiRuntimeConfig } from '@/lib/ai/character-chat/config'
import {
  buildCharacterAiOverviewItem,
  type CharacterAiOverviewItem,
} from '@/lib/ai/character-chat/insights'
import { characterAiSettingsSchema, firstZodMessage } from '@/lib/schemas/character-ai'
import * as charactersDb from '@/lib/server/characters'
import {
  listCharacterAiSettings,
  resolveCharacterAiRuntimeConfig,
  saveCharacterAiSettings,
  type CharacterAiSettingsSchemaStatus,
} from '@/lib/server/character-ai-settings'
import {
  fetchCharacterAiBlockedReaders,
  fetchCharacterAiLastErrors,
  fetchCharacterAiStats,
} from '@/lib/server/character-ai-stats'
import {
  requireAuthorOrAdminSession,
  requireStudioAdminSession,
} from '@/lib/server/studio-auth'

/**
 * Данные AI-панели Studio.
 *
 * Просмотр — author/admin, как и раздел персонажей. Мутации отдельно требуют
 * admin: у персонажа нет отдельного владельца, поэтому автор релиза не
 * получает право менять общего героя. Тексты переписок не читаются.
 */
export interface CharacterAiOverview {
  items: CharacterAiOverviewItem[]
  schema: CharacterAiSettingsSchemaStatus
  statsOk: boolean
  canManage: boolean
}

export interface CharacterAiDetail {
  item: CharacterAiOverviewItem
  schema: CharacterAiSettingsSchemaStatus
  statsOk: boolean
  errorsOk: boolean
  blockedOk: boolean
  canManage: boolean
  settingsUpdatedAt: string | null
  settingsUpdatedBy: string | null
}

function toIso(value: string | Date | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

export async function getStudioCharacterAiOverview(): Promise<CharacterAiOverview> {
  const session = await requireAuthorOrAdminSession()
  // Как и в остальной Studio: не-автор уходит на вход, а не в тихий редирект
  // внутри раздела, где непонятно, почему ссылки нет.
  if (!session) redirect('/login')

  const characters = await charactersDb.fetchCharactersList()
  const ids = characters.map((character) => character.id)

  const [settingsRead, statsRead, errorsRead, blockedRead] = await Promise.all([
    listCharacterAiSettings(ids),
    fetchCharacterAiStats(ids),
    fetchCharacterAiLastErrors(ids),
    fetchCharacterAiBlockedReaders(ids),
  ])

  const items = characters.map((character) => {
    const settings = settingsRead.settingsByCharacter.get(character.id) ?? null
    return buildCharacterAiOverviewItem({
      character,
      config: mergeCharacterAiRuntimeConfig(settings),
      settingsRevision: settings?.revision ?? null,
      stats: statsRead.statsByCharacter.get(character.id),
      statsAvailable: statsRead.ok,
      lastError: errorsRead.errorsByCharacter.get(character.id) ?? null,
      blockedReaders: blockedRead.blockedByCharacter.get(character.id) ?? 0,
    })
  })

  return {
    items,
    schema: settingsRead.schema,
    statsOk: statsRead.ok,
    canManage: canManageCharacterAi({
      isAdmin: session.isAdmin,
      publicRole: session.publicRole,
    }),
  }
}

export async function getStudioCharacterAiDetail(
  characterId: string,
): Promise<CharacterAiDetail | null> {
  const session = await requireAuthorOrAdminSession()
  if (!session) redirect('/login')

  const character = await charactersDb.fetchCharacterById(characterId)
  if (!character || character.character_type !== 'person') return null

  const [runtime, statsRead, errorsRead, blockedRead] = await Promise.all([
    resolveCharacterAiRuntimeConfig(character.id),
    fetchCharacterAiStats([character.id]),
    fetchCharacterAiLastErrors([character.id]),
    fetchCharacterAiBlockedReaders([character.id]),
  ])

  const item = buildCharacterAiOverviewItem({
    character,
    config: runtime.config,
    settingsRevision: runtime.settings?.revision ?? null,
    stats: statsRead.statsByCharacter.get(character.id),
    statsAvailable: statsRead.ok,
    lastError: errorsRead.errorsByCharacter.get(character.id) ?? null,
    blockedReaders: blockedRead.blockedByCharacter.get(character.id) ?? 0,
  })

  return {
    item,
    schema: runtime.schema,
    statsOk: statsRead.ok,
    errorsOk: errorsRead.ok,
    blockedOk: blockedRead.ok,
    canManage: canManageCharacterAi({
      isAdmin: session.isAdmin,
      publicRole: session.publicRole,
    }),
    settingsUpdatedAt: toIso(runtime.settings?.updated_at),
    settingsUpdatedBy: runtime.settings?.updated_by ?? null,
  }
}

export interface CharacterAiSettingsFormState {
  status: 'idle' | 'success' | 'error'
  message: string
}

/**
 * Сохраняет только технические параметры. `system_role`, `ai_enabled` и
 * доступность сюда не входят: их источник — существующие поля персонажа.
 */
export async function saveCharacterAiSettingsAction(
  _previous: CharacterAiSettingsFormState,
  formData: FormData,
): Promise<CharacterAiSettingsFormState> {
  const session = await requireStudioAdminSession()
  if (!session) {
    return {
      status: 'error',
      message: 'Недостаточно прав: технические настройки AI меняет администратор.',
    }
  }

  const parsed = characterAiSettingsSchema.safeParse({
    characterId: formData.get('characterId'),
    modelId: formData.get('modelId'),
    temperature: formData.get('temperature'),
    maxOutputTokens: formData.get('maxOutputTokens'),
    totalTimeoutMs: formData.get('totalTimeoutMs'),
    chunkTimeoutMs: formData.get('chunkTimeoutMs'),
    userTurnsPerHour: formData.get('userTurnsPerHour'),
  })
  if (!parsed.success) {
    return { status: 'error', message: firstZodMessage(parsed.error) }
  }

  const character = await charactersDb.fetchCharacterById(parsed.data.characterId)
  if (!character || character.character_type !== 'person') {
    return { status: 'error', message: 'Персонаж не найден или не является человеком.' }
  }

  const result = await saveCharacterAiSettings({
    ...parsed.data,
    updatedBy: session.user.id,
  })

  if (!result.saved) {
    if (result.schema === 'missing') {
      return {
        status: 'error',
        message:
          'Схема character_ai_settings не установлена. Примените postgres/033_character_ai_settings.sql: до этого runtime использует defaults, а сохранение недоступно.',
      }
    }
    return {
      status: 'error',
      message: 'Не удалось сохранить настройки. Смотрите серверный лог.',
    }
  }

  revalidatePath('/studio/ai')
  revalidatePath(`/studio/ai/${parsed.data.characterId}`)

  return {
    status: 'success',
    message: `Настройки сохранены (revision ${result.settings?.revision ?? '—'}). Следующий ход прочитает их через общий resolver.`,
  }
}
