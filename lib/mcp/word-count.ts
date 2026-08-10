/**
 * Подсчёт слов в HTML-контенте глав.
 * Та же логика, что в lib/actions/studio.ts:
 * HTML → remove tags → split по \s+ → filter empty → length
 */
export function countWords(html: string | null | undefined): number {
  if (!html) return 0
  return html
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter(Boolean).length
}
