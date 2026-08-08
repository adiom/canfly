/**
 * Форматирование чисел и единиц для публичных страниц.
 * Жило локально в components/release-page.tsx — вынесено, чтобы страница
 * издания (оглавление) считала объём и время теми же правилами.
 */

export function pluralRu(n: number, one: string, few: string, many: string): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return few
  return many
}

export function formatReadingTime(minutes: number): string {
  if (minutes <= 0) return ''
  if (minutes < 60) return `${minutes} мин`
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return m > 0 ? `${h} ч ${m} мин` : `${h} ч`
}

export function formatWordCount(words: number): string {
  if (words >= 1000) return `${(words / 1000).toFixed(words >= 10000 ? 0 : 1)} тыс. слов`
  return `${words} ${pluralRu(words, 'слово', 'слова', 'слов')}`
}

/** «12 глав» / «12 треков» — единица зависит от формата издания. */
export function formatChapterCount(count: number, isAudio: boolean): string {
  const unit = isAudio
    ? pluralRu(count, 'трек', 'трека', 'треков')
    : pluralRu(count, 'глава', 'главы', 'глав')
  return `${count} ${unit}`
}
