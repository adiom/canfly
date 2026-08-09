/**
 * Сериализует JSON-LD для безопасной вставки в тег <script>.
 *
 * JSON.stringify не экранирует закрывающий тег script: пользовательское
 * значение с </script> могло завершить JSON-LD и добавить исполняемый код.
 * U+2028/U+2029 — валидный JSON, но невалидный JS: без экранирования они
 * ломают парсинг инлайн-скрипта.
 */
export function serializeJsonLd(value: unknown): string {
  const json = JSON.stringify(value) ?? 'null'

  return json.replace(/[<>&\u2028\u2029]/g, (character) => {
    const escapedCharacters: Record<string, string> = {
      '<': '\\u003c',
      '>': '\\u003e',
      '&': '\\u0026',
      '\u2028': '\\u2028',
      '\u2029': '\\u2029',
    }

    return escapedCharacters[character]
  })
}
