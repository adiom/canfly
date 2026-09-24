import { notFound } from 'next/navigation'

import { GameForm } from '@/components/studio/game-form'
import { getStudioGame } from '@/lib/actions/studio-games'

export const metadata = {
  title: 'Редактирование игры — Studio',
}

export default async function EditGamePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const data = await getStudioGame(id)
  if (!data) notFound()

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 md:px-8 md:py-12">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-gray-900">
        Редактирование: {data.game.title}
      </h1>
      <GameForm
        game={data.game}
        allCharacters={data.allCharacters}
        allReleases={data.allReleases}
        linkedCharacterIds={data.linkedCharacterIds}
        linkedReleaseIds={data.linkedReleaseIds}
      />
    </div>
  )
}
