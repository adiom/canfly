import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Серверная проверка роли, как в app/studio/layout.tsx. Раньше защита /admin
// держалась только на proxy.ts — любой промах matcher'а открывал админ-UI целиком.
//
// Страница /admin/login живёт в группе app/(admin-login)/, чтобы этот layout
// на неё не распространялся и не получалось редиректа на самого себя.
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStudioAdminSession()
  if (!session) redirect('/admin/login')

  return children
}
