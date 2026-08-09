'use client'

import { useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import type { ReleaseCharacter } from '@/lib/releases-types'
import { updateReleaseCharactersAction } from '@/lib/actions/studio'

interface Character {
  id: string
  name: string
  slug: string
  avatar: string | null
}

const ROLE_LABELS: Record<string, string> = {
  main: 'Главный',
  supporting: 'Второстепенный',
  cameo: 'Камео',
}

export function ReleaseCharactersSection({
  releaseId,
  characters,
  releaseCharacters,
}: {
  releaseId: string
  characters: Character[]
  releaseCharacters: ReleaseCharacter[]
}) {
  const router = useRouter()
  const [selected, setSelected] = useState<{ character_id: string; role: string }[]>(
    releaseCharacters.map(rc => ({ character_id: rc.character_id, role: rc.role })),
  )
  const [saving, setSaving] = useState(false)

  const toggle = (characterId: string, role: string) => {
    setSelected(prev => {
      const existing = prev.find(c => c.character_id === characterId)
      if (existing) {
        if (existing.role === role) {
          return prev.filter(c => c.character_id !== characterId)
        }
        return prev.map(c => (c.character_id === characterId ? { ...c, role } : c))
      }
      return [...prev, { character_id: characterId, role }]
    })
  }

  const handleSave = useCallback(async () => {
    setSaving(true)
    try {
      await updateReleaseCharactersAction(releaseId, selected)
      toast.success('Персонажи сохранены')
      router.refresh()
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Ошибка сохранения')
    } finally {
      setSaving(false)
    }
  }, [releaseId, selected, router])

  return (
    <div className="space-y-4">
      <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-cf-text-3">
        Персонажи привязаны к релизу, а не к изданию. Один каст на все форматы.
      </p>

      {characters.length === 0 ? (
        <div className="border border-dashed border-cf-text-1/15 py-10 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-cf-text-3">
            Персонажи пока не добавлены
          </p>
        </div>
      ) : (
        <div className="grid gap-px border border-cf-text-1/10 bg-cf-text-1/10 sm:grid-cols-2">
          {characters.map(character => {
            const current = selected.find(c => c.character_id === character.id)
            const isSelected = Boolean(current)
            return (
              <div
                key={character.id}
                className="flex items-start gap-3 bg-cf-bg-2 px-3 py-3 transition-colors hover:bg-cf-bg-3"
              >
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(character.id, current?.role ?? 'supporting')}
                  className="mt-1 size-4 cursor-pointer accent-cf-accent"
                />
                <div className="min-w-0 flex-1">
                  <span className="block truncate font-[family-name:var(--font-cormorant)] text-base font-semibold text-cf-text-heading">
                    {character.name}
                  </span>
                  <span className="block truncate font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-4">
                    /{character.slug}
                  </span>
                </div>
                {isSelected && (
                  <select
                    value={current?.role ?? 'supporting'}
                    onChange={e => toggle(character.id, e.target.value)}
                    className="h-8 border border-cf-text-1/15 bg-cf-bg px-2 font-mono text-[10px] uppercase tracking-[0.12em] text-cf-text-1"
                  >
                    {Object.entries(ROLE_LABELS).map(([value, label]) => (
                      <option key={value} value={value}>
                        {label}
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div className="flex items-center justify-between gap-3 border-t border-cf-text-1/10 pt-4">
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-cf-text-3">
          Выбрано: {selected.length}
        </span>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="inline-flex h-10 items-center justify-center gap-2 bg-cf-accent px-4 text-xs font-black uppercase tracking-[0.08em] text-white transition-colors hover:bg-[#b81e1e] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Сохраняю...' : 'Сохранить персонажей'}
        </button>
      </div>
    </div>
  )
}
