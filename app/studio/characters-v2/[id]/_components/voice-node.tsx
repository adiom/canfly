'use client'

import { useState } from 'react'

import { Textarea } from '@/components/ui/textarea'
import { updateVoiceAction } from '@/lib/actions/studio-characters-v2'
import { CharacterNode } from './character-node'
import { Field, StatusBadge, inputClass } from './shared'
import { useAutosave } from './use-autosave'
import type { LifeState } from '@/lib/server/character-completeness'
import type { Character } from '@/lib/types'

interface VoiceData {
  personality: string
  speaking_style: string
  system_role: string
}

function fromCharacter(c: Character): VoiceData {
  return {
    personality: c.personality ?? '',
    speaking_style: c.speaking_style ?? '',
    system_role: c.system_role ?? '',
  }
}

export function VoiceNode({
  character,
  state,
  isAdmin,
}: {
  character: Character
  state: LifeState
  isAdmin: boolean
}) {
  const [data, setData] = useState<VoiceData>(() => fromCharacter(character))

  const status = useAutosave(
    data,
    isAdmin ? (v) => updateVoiceAction(character.id, v) : async () => {},
  )

  function set<K extends keyof VoiceData>(key: K, value: string) {
    setData((d) => ({ ...d, [key]: value }))
  }

  return (
    <CharacterNode
      id="voice"
      title="Голос"
      eyebrow="02 · голос"
      state={state}
      aside={<StatusBadge status={status} />}
    >
      <div className="space-y-4">
        <Field label="Характер" hint="Как персонаж мыслит и принимает решения.">
          <Textarea
            value={data.personality}
            disabled={!isAdmin}
            rows={3}
            onChange={(e) => set('personality', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Манера речи" hint="Слова, обороты, длина реплик, что подчёркивает.">
          <Textarea
            value={data.speaking_style}
            disabled={!isAdmin}
            rows={3}
            onChange={(e) => set('speaking_style', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field
          label="Системная инструкция"
          hint="Что и как говорит модель от лица персонажа в чате. Подставляется в system-промпт вместе с характером и манерой речи. Пусто — чат отключён."
        >
          <Textarea
            value={data.system_role}
            disabled={!isAdmin}
            rows={8}
            onChange={(e) => set('system_role', e.target.value)}
            placeholder="Вы {Имя}, …"
            className={`font-mono text-sm ${inputClass}`}
          />
        </Field>
      </div>
    </CharacterNode>
  )
}
