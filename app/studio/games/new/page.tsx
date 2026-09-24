import { GameForm } from '@/components/studio/game-form'

export const metadata = {
  title: 'Новая игра — Studio',
}

export default function NewGamePage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-2 text-2xl font-bold tracking-tight text-gray-900">Новая игра</h1>
      <p className="mb-6 text-sm text-gray-500">
        Slug должен совпадать с именем папки в <code>public/games/</code>.
      </p>
      <GameForm />
    </div>
  )
}
