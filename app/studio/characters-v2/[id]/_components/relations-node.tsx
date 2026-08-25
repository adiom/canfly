import { CharacterNode } from './character-node'
import { RelationshipsEditor } from '@/app/studio/characters/[id]/_components/relationships-editor'
import type { LifeState } from '@/lib/server/character-completeness'
import type { CharacterRelationshipWithMutual } from '@/lib/server/character-relationships'

/**
 * Связи Character↔Character. Редактор (RelationshipsEditor) переиспользуется
 * из старого редактора: его мутации (upsert/delete) не делают redirect, только
 * revalidatePath + router.refresh, поэтому корректно обновляют и v2-страницу.
 */
export function RelationsNode({
  characterId,
  state,
  initial,
}: {
  characterId: string
  state: LifeState
  initial: CharacterRelationshipWithMutual[]
}) {
  return (
    <CharacterNode id="relations" title="Связи" eyebrow="06 · связи" state={state}>
      <RelationshipsEditor characterId={characterId} initial={initial} />
    </CharacterNode>
  )
}
