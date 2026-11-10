import { test, expect } from '@playwright/test'

import {
  canManageCharacterAi,
  canViewCharacterAi,
} from '../../lib/ai/character-chat/access'
import {
  CHARACTER_CHAT_CONFIG,
  mergeCharacterAiRuntimeConfig,
} from '../../lib/ai/character-chat/config'
import {
  buildCharacterAiOverviewItem,
  mapCharacterAiStats,
  type CharacterAiStatsRow,
} from '../../lib/ai/character-chat/insights'
import { characterAiSettingsSchema } from '../../lib/schemas/character-ai'
import type { Character } from '../../lib/types'

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Соня Крой',
    slug: 'sonya-kroy',
    avatar: null,
    bio: 'Живёт у реки',
    full_description: null,
    abilities: null,
    speaking_style: 'тихо',
    personality: 'замкнутая',
    boundaries: 'не говорит о прошлом',
    knowledge_scope: 'только город',
    spoiler_policy: 'без спойлеров',
    system_role: 'Ты Соня. Говори тихо.',
    reply_mode: 'ai_auto',
    can_receive_messages: true,
    character_type: 'person',
    passport: 'SECRET PASSPORT',
    map_image_url: null,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    ...overrides,
  }
}

const VALID_SETTINGS = {
  characterId: '11111111-1111-4111-8111-111111111111',
  modelId: CHARACTER_CHAT_CONFIG.modelId,
  temperature: 0.5,
  maxOutputTokens: 512,
  totalTimeoutMs: 30_000,
  chunkTimeoutMs: 5_000,
  userTurnsPerHour: 20,
}

test.describe('эффективный конфиг AI-чата', () => {
  test('без строки настроек используются документированные defaults', () => {
    const config = mergeCharacterAiRuntimeConfig(null)

    expect(config.modelId).toBe(CHARACTER_CHAT_CONFIG.modelId)
    expect(config.temperature).toBe(CHARACTER_CHAT_CONFIG.temperature)
    expect(config.maxOutputTokens).toBe(CHARACTER_CHAT_CONFIG.maxOutputTokens)
    expect(config.userTurnsPerHour).toBe(CHARACTER_CHAT_CONFIG.userTurnsPerHour)
    expect(mergeCharacterAiRuntimeConfig(undefined)).toEqual(config)
  })

  test('валидные настройки персонажа переопределяют defaults', () => {
    const config = mergeCharacterAiRuntimeConfig({
      model_id: CHARACTER_CHAT_CONFIG.modelId,
      temperature: 0.4,
      max_output_tokens: 512,
      total_timeout_ms: 30_000,
      chunk_timeout_ms: 5_000,
      user_turns_per_hour: 20,
    })

    expect(config.temperature).toBe(0.4)
    expect(config.maxOutputTokens).toBe(512)
    expect(config.totalTimeoutMs).toBe(30_000)
    expect(config.chunkTimeoutMs).toBe(5_000)
    expect(config.userTurnsPerHour).toBe(20)
  })

  test('недопустимые значения из БД откатываются к default, а не роняют ход', () => {
    const config = mergeCharacterAiRuntimeConfig({
      model_id: 'openai/gpt-5-ultra',
      temperature: 4,
      max_output_tokens: 1,
      total_timeout_ms: 120,
      chunk_timeout_ms: 60,
      user_turns_per_hour: 0,
    })

    expect(config.modelId).toBe(CHARACTER_CHAT_CONFIG.modelId)
    expect(config.temperature).toBe(CHARACTER_CHAT_CONFIG.temperature)
    expect(config.maxOutputTokens).toBe(CHARACTER_CHAT_CONFIG.maxOutputTokens)
    expect(config.totalTimeoutMs).toBe(CHARACTER_CHAT_CONFIG.totalTimeoutMs)
    expect(config.chunkTimeoutMs).toBe(CHARACTER_CHAT_CONFIG.chunkTimeoutMs)
    expect(config.userTurnsPerHour).toBe(CHARACTER_CHAT_CONFIG.userTurnsPerHour)
  })

  test('противоречивая пара таймаутов не превращается в «почти валидную» смесь', () => {
    const config = mergeCharacterAiRuntimeConfig({
      model_id: CHARACTER_CHAT_CONFIG.modelId,
      temperature: 0.3,
      max_output_tokens: 256,
      total_timeout_ms: 10_000,
      chunk_timeout_ms: 10_000,
      user_turns_per_hour: 10,
    })

    expect(config.totalTimeoutMs).toBe(CHARACTER_CHAT_CONFIG.totalTimeoutMs)
    expect(config.chunkTimeoutMs).toBe(CHARACTER_CHAT_CONFIG.chunkTimeoutMs)
    // Остальные валидные поля не теряются.
    expect(config.temperature).toBe(0.3)
    expect(config.maxOutputTokens).toBe(256)
  })

  test('защитные пределы запроса и контекста не переопределяются настройкой', () => {
    const config = mergeCharacterAiRuntimeConfig({})
    expect(config.maxQuestionChars).toBe(CHARACTER_CHAT_CONFIG.maxQuestionChars)
    expect(config.maxContextChars).toBe(CHARACTER_CHAT_CONFIG.maxContextChars)
    expect(config.maxRequestBodyChars).toBe(CHARACTER_CHAT_CONFIG.maxRequestBodyChars)
    expect(config.maxRetries).toBe(0)
  })
})

test.describe('схема сохранения настроек', () => {
  test('принимает валидную форму', () => {
    expect(characterAiSettingsSchema.safeParse(VALID_SETTINGS).success).toBe(true)
  })

  test('отвергает неутверждённую модель и выход за границы', () => {
    const unapprovedModel = characterAiSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      modelId: 'anthropic/claude-opus',
    })
    expect(unapprovedModel.success).toBe(false)

    expect(
      characterAiSettingsSchema.safeParse({ ...VALID_SETTINGS, temperature: 2 }).success,
    ).toBe(false)
    expect(
      characterAiSettingsSchema.safeParse({ ...VALID_SETTINGS, maxOutputTokens: 8_000 }).success,
    ).toBe(false)
    expect(
      characterAiSettingsSchema.safeParse({ ...VALID_SETTINGS, userTurnsPerHour: 0 }).success,
    ).toBe(false)
  })

  test('отвергает паузу чанка не меньше общего таймаута', () => {
    const result = characterAiSettingsSchema.safeParse({
      ...VALID_SETTINGS,
      totalTimeoutMs: 10_000,
      chunkTimeoutMs: 10_000,
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]?.path).toEqual(['chunkTimeoutMs'])
  })

  test('в форме нет полей prompt и ai_enabled', () => {
    const parsed = characterAiSettingsSchema.parse(VALID_SETTINGS)
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'characterId',
        'chunkTimeoutMs',
        'maxOutputTokens',
        'modelId',
        'temperature',
        'totalTimeoutMs',
        'userTurnsPerHour',
      ].sort(),
    )
  })
})

test.describe('права AI-панели', () => {
  test('администратор видит и меняет настройки', () => {
    const actor = { isAdmin: true, publicRole: 'reader' as const }
    expect(canViewCharacterAi(actor)).toBe(true)
    expect(canManageCharacterAi(actor)).toBe(true)
  })

  test('автор видит сводку, но не меняет технические параметры', () => {
    const actor = { isAdmin: false, publicRole: 'author' as const }
    expect(canViewCharacterAi(actor)).toBe(true)
    expect(canManageCharacterAi(actor)).toBe(false)
  })

  test('читатель и отсутствующая сессия не получают доступа', () => {
    for (const actor of [
      { isAdmin: false, publicRole: 'reader' as const },
      null,
      undefined,
    ]) {
      expect(canViewCharacterAi(actor)).toBe(false)
      expect(canManageCharacterAi(actor)).toBe(false)
    }
  })
})

test.describe('сводка Studio', () => {
  function statsRow(overrides: Partial<CharacterAiStatsRow> = {}): CharacterAiStatsRow {
    return {
      character_id: '11111111-1111-4111-8111-111111111111',
      conversations: 3,
      readers: 2,
      messages: 9,
      user_messages: 5,
      answers: 4,
      requests_30d: 5,
      completed_30d: 4,
      failed_30d: 1,
      pending_now: 0,
      last_answer_at: '2026-11-01T10:00:00.000Z',
      input_tokens: '0',
      output_tokens: '0',
      metered_answers: 0,
      unmetered_answers: 4,
      ...overrides,
    }
  }

  test('ответы без usage остаются «нет данных», а не нулём', () => {
    const stats = mapCharacterAiStats(statsRow())

    expect(stats.conversations).toBe(3)
    expect(stats.answers).toBe(4)
    expect(stats.inputTokens).toBeNull()
    expect(stats.outputTokens).toBeNull()
    expect(stats.unmeteredAnswers).toBe(4)
  })

  test('known usage приводится к числам, включая bigint-строки pg', () => {
    const stats = mapCharacterAiStats(
      statsRow({ input_tokens: '1200', output_tokens: '800', metered_answers: 4 }),
    )

    expect(stats.inputTokens).toBe(1200)
    expect(stats.outputTokens).toBe(800)
    expect(stats.meteredAnswers).toBe(4)
  })

  test('отсутствующая строка — пустая сводка, а не падение', () => {
    const stats = mapCharacterAiStats(undefined)
    expect(stats.conversations).toBe(0)
    expect(stats.inputTokens).toBeNull()
    expect(stats.lastAnswerAt).toBeNull()
  })

  test('карточка показывает факт инструкции и источник настроек', () => {
    const withInstruction = buildCharacterAiOverviewItem({
      character: makeCharacter(),
      config: mergeCharacterAiRuntimeConfig(null),
      settingsRevision: null,
      stats: undefined,
      statsAvailable: true,
      lastError: null,
      blockedReaders: 0,
    })

    expect(withInstruction.hasInstruction).toBe(true)
    expect(withInstruction.instructionLength).toBe('Ты Соня. Говори тихо.'.length)
    expect(withInstruction.settingsSource).toBe('default')
    expect(withInstruction.availability.reason).toBe('ready')

    const configured = buildCharacterAiOverviewItem({
      character: makeCharacter({ system_role: '   ' }),
      config: mergeCharacterAiRuntimeConfig({ temperature: 0.4 }),
      settingsRevision: 2,
      stats: undefined,
      statsAvailable: false,
      lastError: { code: 'model_APICallError', at: '2026-11-02T09:00:00.000Z' },
      blockedReaders: 1,
    })

    expect(configured.hasInstruction).toBe(false)
    expect(configured.settingsSource).toBe('character')
    expect(configured.availability.reason).toBe('unconfigured')
    expect(configured.statsAvailable).toBe(false)
    expect(configured.lastError?.code).toBe('model_APICallError')
  })

  test('сводка не копирует авторский prompt и паспорт', () => {
    const item = buildCharacterAiOverviewItem({
      character: makeCharacter(),
      config: mergeCharacterAiRuntimeConfig(null),
      settingsRevision: null,
      stats: undefined,
      statsAvailable: true,
      lastError: null,
      blockedReaders: 0,
    })

    const serialized = JSON.stringify(item)
    expect(serialized).not.toContain('Ты Соня')
    expect(serialized).not.toContain('SECRET PASSPORT')
  })
})
