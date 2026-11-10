/**
 * Один ход чата персонажа: пределы и таймауты.
 *
 * Значения — стартовые для пилота P0, они не являются точным токенным
 * счётчиком. Символьный бюджет контекста лишь ограничивает объём, который
 * попадает в модель, и может быть уточнён после замеров на эталонах.
 *
 * Часть значений (модель, temperature, output, таймауты и лимит обращений)
 * может быть переопределена в `character_ai_settings`. Runtime и Studio
 * обязаны читать один и тот же `resolveCharacterAiRuntimeConfig`, иначе
 * панель станет декоративной.
 */
export const CHARACTER_CHAT_CONFIG = {
  /** Запрошенная модель по умолчанию. Фактически сообщённую модель пишем в metadata хода. */
  modelId: 'openai/gpt-4o-mini',
  temperature: 0.8,
  maxOutputTokens: 1024,

  /** Новый вопрос пользователя. */
  maxQuestionChars: 2000,
  /** Суммарный текст истории, передаваемый модели (не токены). */
  maxContextChars: 20_000,
  /** Тело запроса целиком, до JSON.parse. */
  maxRequestBodyChars: 64 * 1024,
  /** Сколько последних записей читаем из БД перед отбором по бюджету. */
  historyLimit: 24,
  /** Максимум элементов в устаревшем payload `messages`. */
  maxLegacyMessages: 50,

  /** Общий timeout одного вызова и пауза между чанками. */
  totalTimeoutMs: 45_000,
  chunkTimeoutMs: 10_000,
  /** Повторы SDK выключены: один ход — один платный вызов. */
  maxRetries: 0,

  /** Сколько «готовящийся» ход считается активным до автоматического устаревания. */
  activeTurnTtlSeconds: 120,

  /** Существующий лимит пользователя; дневной лимит персонажа ждёт согласования бюджета. */
  userTurnsPerHour: 60,
} as const

/**
 * Модели, которые разрешено сохранить в настройках персонажа. Список намеренно
 * узкий: смена production-модели — отдельное продуктовое решение, а не
 * побочный эффект формы. Расширять только после замеров и утверждения.
 */
export const APPROVED_MODEL_IDS = [CHARACTER_CHAT_CONFIG.modelId] as const
export type ApprovedModelId = (typeof APPROVED_MODEL_IDS)[number]

export function isApprovedModelId(value: unknown): value is ApprovedModelId {
  return typeof value === 'string' && (APPROVED_MODEL_IDS as readonly string[]).includes(value)
}

/** Допустимые границы технических параметров. Дублируются CHECK-ами в миграции 033. */
export const CHARACTER_AI_LIMITS = {
  temperature: { min: 0, max: 1.5 },
  maxOutputTokens: { min: 128, max: 4096 },
  totalTimeoutMs: { min: 5_000, max: 120_000 },
  chunkTimeoutMs: { min: 1_000, max: 60_000 },
  userTurnsPerHour: { min: 1, max: 600 },
} as const

/** Техническая часть настроек, которую можно переопределить для персонажа. */
export interface CharacterAiSettingsValues {
  model_id: string
  temperature: number
  max_output_tokens: number
  total_timeout_ms: number
  chunk_timeout_ms: number
  user_turns_per_hour: number
}

/** Эффективная конфигурация одного хода. */
export interface CharacterAiRuntimeConfig {
  modelId: string
  temperature: number
  maxOutputTokens: number
  maxQuestionChars: number
  maxContextChars: number
  maxRequestBodyChars: number
  historyLimit: number
  maxLegacyMessages: number
  totalTimeoutMs: number
  chunkTimeoutMs: number
  maxRetries: number
  activeTurnTtlSeconds: number
  userTurnsPerHour: number
}

function inRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max
}

/**
 * Собирает эффективный конфиг из строки настроек и безопасных defaults.
 *
 * Значения из БД не считаются доверенными: при ручной правке SQL или будущем
 * рассинхроне схемы неверное поле откатывается к default, а не роняет ход.
 * Символьные пределы запроса и контекста намеренно не переопределяются —
 * это защитные ограничения, а не авторская настройка.
 */
export function mergeCharacterAiRuntimeConfig(
  settings: Partial<CharacterAiSettingsValues> | null | undefined,
): CharacterAiRuntimeConfig {
  const base: CharacterAiRuntimeConfig = {
    modelId: CHARACTER_CHAT_CONFIG.modelId,
    temperature: CHARACTER_CHAT_CONFIG.temperature,
    maxOutputTokens: CHARACTER_CHAT_CONFIG.maxOutputTokens,
    maxQuestionChars: CHARACTER_CHAT_CONFIG.maxQuestionChars,
    maxContextChars: CHARACTER_CHAT_CONFIG.maxContextChars,
    maxRequestBodyChars: CHARACTER_CHAT_CONFIG.maxRequestBodyChars,
    historyLimit: CHARACTER_CHAT_CONFIG.historyLimit,
    maxLegacyMessages: CHARACTER_CHAT_CONFIG.maxLegacyMessages,
    totalTimeoutMs: CHARACTER_CHAT_CONFIG.totalTimeoutMs,
    chunkTimeoutMs: CHARACTER_CHAT_CONFIG.chunkTimeoutMs,
    maxRetries: CHARACTER_CHAT_CONFIG.maxRetries,
    activeTurnTtlSeconds: CHARACTER_CHAT_CONFIG.activeTurnTtlSeconds,
    userTurnsPerHour: CHARACTER_CHAT_CONFIG.userTurnsPerHour,
  }

  if (!settings) return base

  const totalTimeoutMs = inRange(
    settings.total_timeout_ms,
    CHARACTER_AI_LIMITS.totalTimeoutMs.min,
    CHARACTER_AI_LIMITS.totalTimeoutMs.max,
  )
    ? settings.total_timeout_ms
    : base.totalTimeoutMs
  const chunkTimeoutMs = inRange(
    settings.chunk_timeout_ms,
    CHARACTER_AI_LIMITS.chunkTimeoutMs.min,
    CHARACTER_AI_LIMITS.chunkTimeoutMs.max,
  )
    ? settings.chunk_timeout_ms
    : base.chunkTimeoutMs

  // Пауза между чанками обязана быть меньше общего таймаута. Если пара
  // противоречива, используем defaults целиком, а не «почти валидную» смесь.
  const timeoutPairValid = chunkTimeoutMs < totalTimeoutMs

  return {
    ...base,
    modelId: isApprovedModelId(settings.model_id) ? settings.model_id : base.modelId,
    temperature: inRange(
      settings.temperature,
      CHARACTER_AI_LIMITS.temperature.min,
      CHARACTER_AI_LIMITS.temperature.max,
    )
      ? settings.temperature
      : base.temperature,
    maxOutputTokens: inRange(
      settings.max_output_tokens,
      CHARACTER_AI_LIMITS.maxOutputTokens.min,
      CHARACTER_AI_LIMITS.maxOutputTokens.max,
    )
      ? settings.max_output_tokens
      : base.maxOutputTokens,
    totalTimeoutMs: timeoutPairValid ? totalTimeoutMs : base.totalTimeoutMs,
    chunkTimeoutMs: timeoutPairValid ? chunkTimeoutMs : base.chunkTimeoutMs,
    userTurnsPerHour: inRange(
      settings.user_turns_per_hour,
      CHARACTER_AI_LIMITS.userTurnsPerHour.min,
      CHARACTER_AI_LIMITS.userTurnsPerHour.max,
    )
      ? settings.user_turns_per_hour
      : base.userTurnsPerHour,
  }
}
