import { redirect } from 'next/navigation'

export const dynamic = 'force-dynamic'

/**
 * Каталог временно переехал на корень (`app/page.tsx`), прежний лендинг — на `/home`.
 * Этот адрес остаётся рабочим: внешние ссылки и старые закладки не должны ломаться.
 *
 * Редирект намеренно временный (307, а не 308): переезд обратим, а постоянный
 * редирект браузеры и поисковики кэшируют надолго — после отката пользователи
 * ещё сутками улетали бы с `/releases` на корень.
 */
export default async function ReleasesRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; category?: string }>
}) {
  const { page, category } = await searchParams

  const params = new URLSearchParams()
  if (category) params.set('category', category)
  if (page) params.set('page', page)

  const qs = params.toString()
  redirect(qs ? `/?${qs}` : '/')
}
