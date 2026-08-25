import { CharacterNode } from './character-node'
import { ReadersList } from '@/app/studio/characters/[id]/_components/readers-list'
import type { LifeState } from '@/lib/server/character-completeness'

type Reader = {
  id: string
  user_id: string
  handle: string
  display_name: string
  avatar: string | null
  status: 'pending' | 'accepted' | 'blocked'
  intimacy_level: number
  created_at: string
}

/**
 * Читатели Character↔User. ReadersList переиспользуется из старого редактора:
 * его мутации (status/delete) не делают redirect, только revalidatePath +
 * router.refresh, поэтому корректно обновляют v2-страницу.
 */
export function ReadersNode({
  characterId,
  state,
  initial,
}: {
  characterId: string
  state: LifeState
  initial: Reader[]
}) {
  return (
    <CharacterNode id="readers" title="Читатели" eyebrow="07 · читатели" state={state}>
      <ReadersList characterId={characterId} initial={initial} />
    </CharacterNode>
  )
}
