import type { Metadata } from 'next'

/**
 * Страница — клиентская, поэтому `metadata` живёт в layout: служебный экран
 * отказа в доступе не должен попадать ни в индекс, ни в обход.
 */
export const metadata: Metadata = {
  title: 'Доступ ограничен | canfly',
  robots: { index: false, follow: false },
}

export default function StudioAccessDeniedLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return children
}
