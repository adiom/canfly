'use client'

import { useState } from 'react'

import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { updateFaceAction } from '@/lib/actions/studio-characters-v2'
import { CharacterNode } from './character-node'
import { Field, StatusBadge, inputClass } from './shared'
import { useAutosave } from './use-autosave'
import type { LifeState } from '@/lib/server/character-completeness'
import type { Character } from '@/lib/types'

interface FaceData {
  name: string
  slug: string
  avatar: string
  bio: string
  full_description: string
}

function fromCharacter(c: Character): FaceData {
  return {
    name: c.name ?? '',
    slug: c.slug ?? '',
    avatar: c.avatar ?? '',
    bio: c.bio ?? '',
    full_description: c.full_description ?? '',
  }
}

export function FaceNode({
  character,
  state,
  isAdmin,
}: {
  character: Character
  state: LifeState
  isAdmin: boolean
}) {
  const [data, setData] = useState<FaceData>(() => fromCharacter(character))

  const status = useAutosave(
    data,
    isAdmin ? (v) => updateFaceAction(character.id, v) : async () => {},
  )

  function set<K extends keyof FaceData>(key: K, value: string) {
    setData((d) => ({ ...d, [key]: value }))
  }

  return (
    <CharacterNode
      id="face"
      title="Лицо"
      eyebrow="01 · лицо"
      state={state}
      aside={<StatusBadge status={status} />}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Имя">
            <Input
              value={data.name}
              disabled={!isAdmin}
              onChange={(e) => set('name', e.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Позывной">
            <Input
              value={data.slug}
              disabled={!isAdmin}
              onChange={(e) => set('slug', e.target.value)}
              className={`font-mono text-sm ${inputClass}`}
            />
          </Field>
        </div>

        <Field label="Аватар (URL)">
          <Input
            value={data.avatar}
            disabled={!isAdmin}
            onChange={(e) => set('avatar', e.target.value)}
            placeholder="https://..."
            className={inputClass}
          />
        </Field>

        <Field label="Краткое описание">
          <Textarea
            value={data.bio}
            disabled={!isAdmin}
            rows={3}
            onChange={(e) => set('bio', e.target.value)}
            className={inputClass}
          />
        </Field>

        <Field label="Полное описание">
          <Textarea
            value={data.full_description}
            disabled={!isAdmin}
            rows={6}
            onChange={(e) => set('full_description', e.target.value)}
            className={inputClass}
          />
        </Field>
      </div>
    </CharacterNode>
  )
}
