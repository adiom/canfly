'use client'

import { useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { updateConductAction } from '@/lib/actions/studio-characters-v2'
import { CharacterNode } from './character-node'
import { Field, StatusBadge, inputClass } from './shared'
import { useAutosave } from './use-autosave'
import type { LifeState } from '@/lib/server/character-completeness'
import type { Character, CharacterReplyMode } from '@/lib/types'

interface ConductData {
  reply_mode: CharacterReplyMode
  can_receive_messages: boolean
  boundaries: string
  knowledge_scope: string
  spoiler_policy: string
}

function fromCharacter(c: Character): ConductData {
  return {
    reply_mode: c.reply_mode ?? 'ai_auto',
    can_receive_messages: c.can_receive_messages ?? true,
    boundaries: c.boundaries ?? '',
    knowledge_scope: c.knowledge_scope ?? '',
    spoiler_policy: c.spoiler_policy ?? '',
  }
}

export function ConductNode({
  character,
  state,
  isAdmin,
}: {
  character: Character
  state: LifeState
  isAdmin: boolean
}) {
  const [data, setData] = useState<ConductData>(() => fromCharacter(character))

  const status = useAutosave(
    data,
    isAdmin ? (v) => updateConductAction(character.id, v) : async () => {},
  )

  function set<K extends keyof ConductData>(key: K, value: ConductData[K]) {
    setData((d) => ({ ...d, [key]: value }))
  }

  return (
    <CharacterNode
      id="conduct"
      title="Поведение"
      eyebrow="03 · поведение"
      state={state}
      aside={<StatusBadge status={status} />}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Режим ответов">
            <Select
              value={data.reply_mode}
              onValueChange={(v) => set('reply_mode', v as CharacterReplyMode)}
              disabled={!isAdmin}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ai_auto">AI автоматически</SelectItem>
                <SelectItem value="manual">Вручную</SelectItem>
                <SelectItem value="hybrid">AI + подтверждение</SelectItem>
                <SelectItem value="disabled">Отключено</SelectItem>
              </SelectContent>
            </Select>
          </Field>

          <Field label="Принимает сообщения">
            <Select
              value={data.can_receive_messages ? 'true' : 'false'}
              onValueChange={(v) => set('can_receive_messages', v === 'true')}
              disabled={!isAdmin}
            >
              <SelectTrigger className={inputClass}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="true">Да</SelectItem>
                <SelectItem value="false">Нет</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>

        <Field label="Границы" hint="Что персонаж никогда не делает и не говорит.">
          <Textarea
            value={data.boundaries}
            disabled={!isAdmin}
            rows={3}
            onChange={(e) => set('boundaries', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Границы знаний" hint="Что персонаж знает и откуда.">
          <Textarea
            value={data.knowledge_scope}
            disabled={!isAdmin}
            rows={3}
            onChange={(e) => set('knowledge_scope', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Политика спойлеров" hint="Что можно раскрывать, что — нет.">
          <Textarea
            value={data.spoiler_policy}
            disabled={!isAdmin}
            rows={3}
            onChange={(e) => set('spoiler_policy', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </CharacterNode>
  )
}
