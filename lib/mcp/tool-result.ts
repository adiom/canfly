/**
 * Общие помощники для тулов MCP.
 *
 * Ответы отдаём компактным JSON: pretty-print раздувает контекст модели на
 * треть, а читает это не человек.
 */

import type { CallToolResult } from '@modelcontextprotocol/server'

/** Успешный ответ с данными. */
export function json(data: unknown): CallToolResult {
  return { content: [{ type: 'text', text: JSON.stringify(data) }] }
}

/**
 * Ошибка, которую модель должна прочитать и исправиться. Не throw: SDK
 * превратил бы исключение в тот же isError, но текст-подсказку надёжнее
 * формулировать явно.
 */
export function toolError(text: string): CallToolResult {
  return { content: [{ type: 'text', text }], isError: true }
}

/** Единая формулировка «сущность не найдена». */
export function notFound(entity: string, id: string): CallToolResult {
  return toolError(`${entity} с id="${id}" не найден(а)`)
}

/**
 * Оставляет в объекте только перечисленные поля. Нужен спискам: полный набор
 * колонок (full_description, passport, content) в перечне не нужен и стоит
 * тысяч токенов на каждый вызов.
 */
export function pick<T, K extends keyof T>(row: T, keys: readonly K[]): Pick<T, K> {
  const result = {} as Pick<T, K>
  for (const key of keys) {
    if (key in (row as object)) result[key] = row[key]
  }
  return result
}

/**
 * Обёртка handler'а тулa, ловящая синхронные и асинхронные исключения.
 * mcp-handler тоже ловит throw и упаковывает в isError, но сообщение
 * становится generic — agent не понимает, что именно упало. Эта обёртка
 * возвращает toolError(err.message) с конкретным текстом (например,
 * «Postgres error: …»), не роняя запрос. Аудит mcp-handler всё равно
 * получит REQUEST_COMPLETED со status='error' (не ERROR), что onEvent
 * правильно классифицирует.
 *
 * Обёртка сохраняет тип аргумента `Args`: вызов `withToolCatch(handler)`
 * возвращает ту же сигнатуру, что и переданный handler, mcp-handler видит
 * корректные типы (instanceof per-tool input).
 */
export function withToolCatch<Args>(
  handler: (args: Args) => Promise<CallToolResult> | CallToolResult,
): (args: Args) => Promise<CallToolResult> {
  return async (args) => {
    try {
      return await handler(args)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      return toolError(message)
    }
  }
}
