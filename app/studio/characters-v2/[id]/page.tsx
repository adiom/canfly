import { notFound } from 'next/navigation'

import {
  getStudioCharacter,
  listStudioCharacterPosts,
  listStudioCharacterReaders,
  listStudioCharacterRelationships,
  listStudioWallPosts,
} from '@/lib/actions/studio-characters'
import {
  isAuthorOrAdmin,
  isStudioAdmin,
  requireStudioSession,
} from '@/lib/server/studio-auth'
import { computeCharacterCompleteness } from '@/lib/server/character-completeness'
import { hasPassportHistory } from '@/lib/server/character-passport-versions'

import { ControlBar } from './_components/control-bar'
import { FaceNode } from './_components/face-node'
import { VoiceNode } from './_components/voice-node'
import { ConductNode } from './_components/conduct-node'
import { AbilitiesNode } from './_components/abilities-node'
import { PassportNode } from './_components/passport-node'
import { RelationsNode } from './_components/relations-node'
import { PostsNode } from './_components/posts-node'
import { WallNode } from './_components/wall-node'
import { ReadersNode } from './_components/readers-node'

export const dynamic = 'force-dynamic'

/**
 * v2-редактор персонажа — «живое дело» в orbital-стиле. Полностью отдельный
 * маршрут: старый редактор (/studio/characters/[id]) не затрагивается.
 *
 * Доступ: requireStudioSession (admin/author/editor). Паспорт видят author+admin,
 * посты/стену — только admin. Мутации — через lib/actions/studio-characters-v2.ts.
 */
export default async function CharacterV2Page({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const session = await requireStudioSession()
  if (!session) notFound()

  const canEditPassport = isAuthorOrAdmin(session)
  const isAdmin = isStudioAdmin(session)

  const character = await getStudioCharacter(id)
  if (!character) notFound()

  const isCity = character.character_type === 'city'

  // Параллельная загрузка «жизни» персонажа. Посты/стена — admin-only.
  const [relations, readers, posts, wallPosts, passportHasHistory] = await Promise.all([
    listStudioCharacterRelationships(id),
    listStudioCharacterReaders(id),
    isAdmin ? listStudioCharacterPosts(id) : Promise.resolve([]),
    isAdmin ? listStudioWallPosts(id) : Promise.resolve([]),
    hasPassportHistory(id),
  ])

  const completeness = computeCharacterCompleteness(character, {
    relationsCount: relations.length,
    postsCount: posts.length,
    wallCount: wallPosts.length,
    readersCount: readers.length,
    passportHasHistory,
  })

  return (
    <div
      className="relative min-h-screen"
      style={{
        backgroundColor: '#F4EFE5',
        backgroundImage:
          'radial-gradient(60% 50% at 12% 8%, rgba(168,85,247,0.10), transparent 70%), radial-gradient(50% 45% at 88% 12%, rgba(59,130,246,0.09), transparent 70%), radial-gradient(55% 50% at 50% 100%, rgba(16,185,129,0.07), transparent 70%)',
      }}
    >
      <div className="relative mx-auto max-w-5xl px-4 py-4 md:px-8 md:py-6">
        <ControlBar
          character={character}
          density={completeness.density}
          summary={completeness.summary}
          isAdmin={isAdmin}
        />

        <div className="mt-5 space-y-5">
          <FaceNode
            character={character}
            state={completeness.sections.face}
            isAdmin={isAdmin}
          />

          {!isCity && (
            <VoiceNode
              character={character}
              state={completeness.sections.voice}
              isAdmin={isAdmin}
            />
          )}

          {!isCity && (
            <ConductNode
              character={character}
              state={completeness.sections.conduct}
              isAdmin={isAdmin}
            />
          )}

          {!isCity && (
            <AbilitiesNode
              character={character}
              state={completeness.sections.abilities}
              isAdmin={isAdmin}
            />
          )}

          {canEditPassport && (
            <PassportNode
              character={character}
              state={completeness.sections.passport}
              canEdit={canEditPassport}
            />
          )}

          <RelationsNode
            characterId={id}
            state={completeness.sections.relations}
            initial={relations}
          />

          {isAdmin && (
            <PostsNode
              characterId={id}
              state={completeness.sections.posts}
              posts={posts}
            />
          )}

          {isAdmin && (
            <WallNode
              characterId={id}
              state={completeness.sections.wall}
              wallPosts={wallPosts}
            />
          )}

          <ReadersNode
            characterId={id}
            state={completeness.sections.readers}
            initial={readers}
          />
        </div>
      </div>
    </div>
  )
}
