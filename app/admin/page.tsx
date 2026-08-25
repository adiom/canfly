import Link from 'next/link'

import { listAdminUsers } from '@/lib/server/users'
import { AdminUsersPanel } from '@/app/admin/_components/admin-users-panel'
import { AdminHeader } from '@/app/admin/_components/admin-header'

export const dynamic = 'force-dynamic'

export default async function AdminPage() {
  const users = await listAdminUsers()

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <AdminHeader />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <div className="mb-6 flex items-start gap-3 rounded-md border border-purple-900/60 bg-purple-950/30 px-4 py-3 text-sm text-purple-100">
          <span aria-hidden>✨</span>
          <p>
            Управление релизами, изданиями, главами, персонажами и новостями — в{' '}
            <Link href="/studio" className="font-semibold underline underline-offset-2 hover:text-purple-50">
              Студии
            </Link>
            . Здесь — слайды главной (
            <Link href="/admin/slider" className="font-semibold underline underline-offset-2 hover:text-purple-50">
              /admin/slider
            </Link>
            ) и управление пользователями.
          </p>
        </div>

        <AdminUsersPanel users={users} />
      </section>

      <footer className="mt-20 border-t border-slate-800 bg-slate-950/50 py-8">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-400">
          <p>&copy; 2024 Canfly Admin Panel</p>
        </div>
      </footer>
    </main>
  )
}
