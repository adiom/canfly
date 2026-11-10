import {
  resolveCharacterChatAvailability,
  type CharacterChatAvailability,
} from '@/lib/ai/character-chat/availability'
import type { CharacterAiRuntimeConfig } from '@/lib/ai/character-chat/config'
import type { Character } from '@/lib/types'

/**
 * Числовая сводка AI-чата персонажа.
 *
 * Источник — существующая metadata ходов первого этапа:
 *   metadata.attempt.status / errorCode / finishedAt
 *   metadata.usage.inputTokens / outputTokens / totalTokens
 *
 * Текст сообщений сюда не попадает. Старые ответы без usage остаются
 * `unmeteredAnswers`, а не получают выдуманный ноль или оценку стоимости.
 */
export interface CharacterAiStatsRow {
  character_id: string
  conversations: number
  readers: number
  messages: number
  user_messages: number
  answers: number
  requests_30d: number
  completed_30d: number
  failed_30d: number
  pending_now: number
  last_answer_at: Date | string | null
  input_tokens: string | number | null
  output_tokens: string | number | null
  metered_answers: number
  unmetered_answers: number
}

export interface CharacterAiStats {
  conversations: number
  readers: number
  messages: number
  userMessages: number
  answers: number
  requestsLast30d: number
  completedLast30d: number
  failedLast30d: number
  pendingNow: number
  lastAnswerAt: string | null
  /** `null` — ни одного ответа с известным usage, а не 0 токенов. */
  inputTokens: number | null
  outputTokens: number | null
  meteredAnswers: number
  unmeteredAnswers: number
}

export interface CharacterAiLastErrorRow {
  character_id: string
  error_code: string | null
  failed_at: Date | string | null
}

export interface CharacterAiLastError {
  code: string | null
  at: string | null
}

function toCount(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : 0
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString()
}

function toTokenTotal(value: string | number | null | undefined, meteredAnswers: number): number | null {
  if (meteredAnswers === 0 || value === null || value === undefined) return null
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) && number >= 0 ? Math.trunc(number) : null
}

export const EMPTY_CHARACTER_AI_STATS: CharacterAiStats = {
  conversations: 0,
  readers: 0,
  messages: 0,
  userMessages: 0,
  answers: 0,
  requestsLast30d: 0,
  completedLast30d: 0,
  failedLast30d: 0,
  pendingNow: 0,
  lastAnswerAt: null,
  inputTokens: null,
  outputTokens: null,
  meteredAnswers: 0,
  unmeteredAnswers: 0,
}

/** Приводит строку SQL (включая bigint-строки pg) к безопасному view-объекту. */
export function mapCharacterAiStats(row: CharacterAiStatsRow | undefined): CharacterAiStats {
  if (!row) return { ...EMPTY_CHARACTER_AI_STATS }

  const meteredAnswers = toCount(row.metered_answers)

  return {
    conversations: toCount(row.conversations),
    readers: toCount(row.readers),
    messages: toCount(row.messages),
    userMessages: toCount(row.user_messages),
    answers: toCount(row.answers),
    requestsLast30d: toCount(row.requests_30d),
    completedLast30d: toCount(row.completed_30d),
    failedLast30d: toCount(row.failed_30d),
    pendingNow: toCount(row.pending_now),
    lastAnswerAt: toIso(row.last_answer_at),
    inputTokens: toTokenTotal(row.input_tokens, meteredAnswers),
    outputTokens: toTokenTotal(row.output_tokens, meteredAnswers),
    meteredAnswers,
    unmeteredAnswers: toCount(row.unmetered_answers),
  }
}

export function mapCharacterAiLastError(
  row: CharacterAiLastErrorRow | undefined,
): CharacterAiLastError | null {
  if (!row) return null
  return {
    code: typeof row.error_code === 'string' && row.error_code.trim() ? row.error_code : null,
    at: toIso(row.failed_at),
  }
}

/**
 * Персонаж в общей AI-сводке Studio. Текст `system_role` сюда не копируется:
 * только факт наличия и длина. Так панель не становится вторым редактором
 * авторского промпта.
 */
export interface CharacterAiOverviewItem {
  id: string
  name: string
  slug: string
  avatar: string | null
  replyMode: Character['reply_mode']
  canReceiveMessages: boolean
  hasInstruction: boolean
  instructionLength: number
  availability: CharacterChatAvailability
  config: CharacterAiRuntimeConfig
  settingsRevision: number | null
  settingsSource: 'character' | 'default'
  stats: CharacterAiStats
  statsAvailable: boolean
  lastError: CharacterAiLastError | null
  blockedReaders: number
}

export interface CharacterAiOverviewInput {
  character: Pick<
    Character,
    'id' | 'name' | 'slug' | 'avatar' | 'reply_mode' | 'can_receive_messages' | 'system_role'
  >
  config: CharacterAiRuntimeConfig
  settingsRevision: number | null
  stats: CharacterAiStats | undefined
  statsAvailable: boolean
  lastError: CharacterAiLastError | null
  blockedReaders: number
}

export function buildCharacterAiOverviewItem(
  input: CharacterAiOverviewInput,
): CharacterAiOverviewItem {
  const { character } = input
  const instruction = character.system_role.trim()

  return {
    id: character.id,
    name: character.name,
    slug: character.slug,
    avatar: character.avatar,
    replyMode: character.reply_mode,
    canReceiveMessages: character.can_receive_messages,
    hasInstruction: instruction.length > 0,
    instructionLength: instruction.length,
    // Тот же резолвер, что использует страница чата, карточки и API.
    availability: resolveCharacterChatAvailability({ character, authenticated: true }),
    config: input.config,
    settingsRevision: input.settingsRevision,
    settingsSource: input.settingsRevision === null ? 'default' : 'character',
    stats: input.stats ?? { ...EMPTY_CHARACTER_AI_STATS },
    statsAvailable: input.statsAvailable,
    lastError: input.lastError,
    blockedReaders: input.blockedReaders,
  }
}
