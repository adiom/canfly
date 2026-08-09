export interface NavItem {
  label: string
  href: string
}

/**
 * Где живёт каталог релизов.
 *
 * Возвращаем прежнюю структуру: лендинг — на корне, каталог — на `/releases`.
 * Ссылки на каталог в коде идут через эту константу, поэтому руками их править не нужно.
 */
export const CATALOG_PATH = '/releases'

/** Путь лендинга. */
export const LANDING_PATH = '/'

/**
 * Адрес каталога с query-параметрами. Простая склейка работает и для корня
 * (`/` + `?x=1` → `/?x=1`), и для `/releases` — но держим её в одном месте,
 * чтобы откат на прежний путь не потребовал правок по вызовам.
 */
export function catalogHref(params?: URLSearchParams): string {
  const qs = params?.toString()
  return qs ? `${CATALOG_PATH}?${qs}` : CATALOG_PATH
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Новости', href: '/news' },
  { label: 'Релизы', href: CATALOG_PATH },
  { label: 'Персонажи', href: '/characters' },
  { label: 'Цвета', href: '/colors' },
]
