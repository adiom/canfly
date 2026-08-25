'use client'

import { useState } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { updateAbilitiesAction } from '@/lib/actions/studio-characters-v2'
import { CharacterNode } from './character-node'
import { Field, StatusBadge, inputClass } from './shared'
import { useAutosave } from './use-autosave'
import type { LifeState } from '@/lib/server/character-completeness'
import type { Character } from '@/lib/types'

/**
 * Способности — простой список, по одной на строку (как в admin-форме).
 * Храним как string[] в JSONB; редактируем одной textarea.
 */
export function AbilitiesNode({
  character,
  state,
  isAdmin,
}: {
  character: Character
  state: LifeState
  isAdmin: boolean
}) {
  const [text, setText] = useState(() =>
    Array.isArray(character.abilities) ? character.abilities.join('\n') : '',
  )

  const abilities = text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)

  const status = useAutosave(
    { abilities },
    isAdmin ? (v) => updateAbilitiesAction(character.id, v) : async () => {},
  )

  return (
    <CharacterNode
      id="abilities"
      title="Способности"
      eyebrow="04 · способности"
      state={state}
      aside={<StatusBadge status={status} />}
    >
      <Field label="Список" hint="По одной способности на строку.">
        <Textarea
          value={text}
          disabled={!isAdmin}
          rows={5}
          onChange={(e) => setText(e.target.value)}
          placeholder={'Левитация\nЧтение мыслей'}
          className={inputClass}
        />
      </Field>
    </CharacterNode>
  )
}
