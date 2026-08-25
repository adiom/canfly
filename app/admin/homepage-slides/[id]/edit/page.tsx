import { notFound } from 'next/navigation'

import { getAdminHomepageSlide } from '@/lib/homepage-slide-store'
import { AdminShell } from '@/app/admin/_components/admin-shell'
import { HomepageSlideForm } from '@/app/admin/_components/homepage-slide-form'

export const dynamic = 'force-dynamic'

interface EditHomepageSlidePageProps {
  params: Promise<{ id: string }>
}

export default async function EditHomepageSlidePage({ params }: EditHomepageSlidePageProps) {
  const { id } = await params
  const slide = await getAdminHomepageSlide(id)

  if (!slide) notFound()

  return (
    <AdminShell
      title="Редактировать слайд"
      description="Настройте текст, ссылки, тему и порядок показа на главной."
      backHref="/admin/slider"
    >
      <HomepageSlideForm slide={slide} />
    </AdminShell>
  )
}
