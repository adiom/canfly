import { listAdminHomepageSlides } from '@/lib/homepage-slide-store'
import { AdminSlidesPanel } from '@/app/admin/_components/admin-slides-panel'
import { AdminHeader } from '@/app/admin/_components/admin-header'

export const dynamic = 'force-dynamic'

export default async function AdminSliderPage() {
  const slides = await listAdminHomepageSlides()

  return (
    <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
      <AdminHeader />

      <section className="mx-auto max-w-7xl px-4 py-8">
        <AdminSlidesPanel slides={slides} />
      </section>
    </main>
  )
}
