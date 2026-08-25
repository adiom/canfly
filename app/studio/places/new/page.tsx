import { PlaceForm } from '@/components/studio/place-form'

export const metadata = {
  title: 'Новое место — Studio',
}

export default function NewPlacePage() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold text-gray-900 tracking-tight">Новое место</h1>
      <PlaceForm />
    </div>
  )
}
