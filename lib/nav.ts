export interface NavItem {
  label: string
  href: string
}

/**
 * Где живёт каталог релизов.
 *
 * Временно каталог отдаётся с корня, а прежний лендинг переехал на `/home`.
 * Чтобы вернуть как было: поменять значение на `'/releases'`, вернуть страницы
 * (`app/home/page.tsx` → `app/page.tsx`, каталог → `app/releases/page.tsx`) и
 * убрать редирект-заглушку. Ссылки на каталог в коде идут через эту константу,
 * поэтому руками их править не нужно.
 */
export const CATALOG_PATH = '/'

/** Путь прежнего лендинга. */
export const LANDING_PATH = '/home'

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
