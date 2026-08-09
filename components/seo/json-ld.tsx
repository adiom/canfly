import { serializeJsonLd } from '@/lib/seo/serialize'

/**
 * Один тег `application/ld+json` со всеми узлами страницы в `@graph`.
 *
 * Отдельные теги на каждую схему не дают резолвить `{ '@id': ... }`: ссылка
 * на Organization из соседнего тега для парсера — просто строка. Внутри
 * одного `@graph` она склеивается с полным узлом.
 */
export function JsonLd({ schemas }: { schemas: unknown[] }) {
  const nodes = schemas.filter(Boolean)
  if (nodes.length === 0) return null

  const payload =
    nodes.length === 1
      ? { '@context': 'https://schema.org', ...(nodes[0] as Record<string, unknown>) }
      : { '@context': 'https://schema.org', '@graph': nodes }

  return (
    <script
      type="application/ld+json"
      // serializeJsonLd экранирует `<`, `>`, `&` и U+2028/29 — пользовательский
      // текст с `</script>` не может закрыть тег и подсунуть код (BUGS #18).
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(payload) }}
    />
  )
}
