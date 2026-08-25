import { notFound } from 'next/navigation'

import { getStudioPlace } from '@/lib/actions/studio-places'
import { PlaceForm } from '@/components/studio/place-form'

export const metadata = {
  title: 'Редактирование места — Studio',
}

export default async function EditPlacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const place = await getStudioPlace(id)
  if (!place) notFound()

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 tracking-tight">
        Редактирование: {place.name}
      </h1>
      <PlaceForm place={place} />
    </div>
  )
}
