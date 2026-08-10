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
