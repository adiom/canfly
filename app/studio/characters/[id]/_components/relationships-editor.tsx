'use client'

import { useEffect, useRef, useState, useTransition } from 'react'
import Image from 'next/image'
import { useRouter } from 'next/navigation'

import { GlassButton } from '@/components/ui/glass-button'
import { GlassChip, type ChipTone } from '@/components/ui/glass-chip'
import {
  RELATIONSHIP_KINDS,
  isDefaultRelationshipKey,
  relationshipLabel,
  relationshipTone,
} from '@/lib/relationships-kinds'
import {
  deleteCharacterRelationshipAction,
  searchCharactersForRelationshipAction,
  upsertCharacterRelationshipAction,
} from '@/lib/actions/studio-characters'
import type { CharacterRelationshipWithMutual } from '@/lib/server/character-relationships'

interface CharacterSummary {
  id: string
  name: string
  slug: string
  avatar: string | null
  character_type: 'person' | 'city'
}

interface RelationshipsEditorProps {
  characterId: string
  initial: CharacterRelationshipWithMutual[]
}

const TONE_TO_CHIP: Record<string, ChipTone> = {
  accent: 'accent',
  on: 'on',
  slow: 'slow',
  quiet: 'quiet',
  warm: 'warm',
}

/**
 * Редактор связей персонажа с другими персонажами. Стеклянные карточки
 * в духе orbital: pill-кнопки, чипы состояний, мягкие тени.
 *
 * Форма «добавить связь»:
 *   - поиск персонажа по имени/слагу (server action с дебаунсом);
 *   - чипы-типы из дефолтного списка + поле для своего типа;
 *   - опциональное описание (история связи).
 *
 * Удаление — кнопка-иконка без подтверждения: список обычно короткий,
 * ошибочное удаление легко отменить повторным добавлением.
 */
export function RelationshipsEditor({ characterId, initial }: RelationshipsEditorProps) {
  return (
    <div className="space-y-5">
      <AddRelationshipForm characterId={characterId} />

      {initial.length === 0 ? (
        <p className="rounded-2xl bg-cf-air-surface px-4 py-6 text-center text-[13px] text-cf-text-3 backdrop-blur-xl">
          Связей пока нет. Добавьте первую — форма выше.
        </p>
      ) : (
        <ul className="space-y-3">
          {initial.map((rel) => (
            <RelationshipCard
              key={rel.id}
              characterId={characterId}
              relationship={rel}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function AddRelationshipForm({ characterId }: { characterId: string }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<CharacterSummary[]>([])
  const [selected, setSelected] = useState<CharacterSummary | null>(null)
  const [type, setType] = useState<string>('ally')
  const [customType, setCustomType] = useState('')
  const [useCustom, setUseCustom] = useState(false)
  const [description, setDescription] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const [isPending, startSearch] = useTransition()
  const router = useRouter()
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Дебаунс поиска — 250мс, чтобы не бить БД на каждый символ.
  useEffect(() => {
    if (!query.trim() || selected) return
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      startSearch(async () => {
        try {
          const list = await searchCharactersForRelationshipAction(characterId, query)
          setResults(list)
        } catch {
          setResults([])
        }
      })
    }, 250)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, characterId, selected])

  function reset() {
    setQuery('')
    setResults([])
    setSelected(null)
    setType('ally')
    setCustomType('')
    setUseCustom(false)
    setDescription('')
    setError(null)
  }

  function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!selected) {
      setError('Выберите персонажа')
      return
    }

    const finalType = useCustom ? customType.trim() : type
    if (!finalType) {
      setError('Укажите тип связи')
      return
    }

    startTransition(async () => {
      try {
        const fd = new FormData()
        fd.set('characterId', characterId)
        fd.set('relatedCharacterId', selected.id)
        fd.set('relationshipType', finalType)
        fd.set('description', description.trim())
        if (useCustom) fd.set('custom', 'true')

        await upsertCharacterRelationshipAction(fd)
        reset()
        router.refresh()
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Не удалось сохранить связь')
      }
    })
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-3xl bg-cf-air-surface p-5 backdrop-blur-2xl ring-1 ring-cf-air-line shadow-[var(--cf-air-shadow)]"
    >
      <p className="mb-4 text-[10px] uppercase tracking-[0.28em] text-cf-text-3">
        Новая связь
      </p>

      <div className="space-y-4">
        {/* Поиск персонажа */}
        <div>
          <label className="mb-1.5 block text-[12px] text-cf-text-3">Персонаж</label>
          {selected ? (
            <SelectedPill
              character={selected}
              onClear={() => {
                setSelected(null)
                setQuery('')
              }}
            />
          ) : (
            <div className="relative">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Имя или слаг…"
                className="w-full rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] text-cf-text-1 ring-1 ring-white/70 backdrop-blur-xl outline-none placeholder:text-cf-text-4 focus:ring-cf-air-accent/40"
              />
              {query.trim() && (
                <div className="absolute left-0 right-0 top-full z-10 mt-1.5 max-h-60 overflow-y-auto rounded-2xl bg-white/95 p-1.5 shadow-[var(--cf-air-shadow)] ring-1 ring-cf-air-line backdrop-blur-2xl">
                  {isPending ? (
                    <p className="px-3 py-2 text-[12px] text-cf-text-3">Поиск…</p>
                  ) : results.length === 0 ? (
                    <p className="px-3 py-2 text-[12px] text-cf-text-3">Ничего не найдено</p>
                  ) : (
                    results.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelected(c)
                          setResults([])
                          setQuery('')
                        }}
                        className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors hover:bg-cf-air-surface"
                      >
                        <Avatar avatar={c.avatar} name={c.name} />
                        <span className="flex-1 truncate text-[13px] text-cf-text-heading">
                          {c.name}
                        </span>
                        <GlassChip tone="quiet">{c.character_type === 'city' ? 'город' : 'персонаж'}</GlassChip>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Тип связи */}
        <div>
          <label className="mb-1.5 block text-[12px] text-cf-text-3">Тип связи</label>
          <div className="flex flex-wrap gap-1.5">
            {RELATIONSHIP_KINDS.map((kind) => {
              const active = !useCustom && type === kind.key
              return (
                <button
                  key={kind.key}
                  type="button"
                  onClick={() => {
                    setUseCustom(false)
                    setType(kind.key)
                  }}
                  className={`rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-all duration-200 ${
                    active
                      ? 'bg-cf-text-heading text-cf-bg shadow-[var(--cf-air-shadow)]'
                      : 'bg-white/70 text-cf-text-3 ring-1 ring-white/70 backdrop-blur-xl hover:bg-white/85 hover:text-cf-text-heading'
                  }`}
                >
                  {kind.label}
                </button>
              )
            })}
            <button
              type="button"
              onClick={() => setUseCustom((v) => !v)}
              className={`rounded-full px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.18em] transition-all duration-200 ${
                useCustom
                  ? 'bg-cf-text-heading text-cf-bg shadow-[var(--cf-air-shadow)]'
                  : 'bg-white/70 text-cf-text-3 ring-1 ring-white/70 backdrop-blur-xl hover:bg-white/85'
              }`}
            >
              свой тип
            </button>
          </div>
          {useCustom && (
            <input
              value={customType}
              onChange={(e) => setCustomType(e.target.value)}
              placeholder="Например: Брат по оружию"
              className="mt-2 w-full rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] text-cf-text-1 ring-1 ring-white/70 backdrop-blur-xl outline-none placeholder:text-cf-text-4 focus:ring-cf-air-accent/40"
            />
          )}
        </div>

        {/* Описание */}
        <div>
          <label className="mb-1.5 block text-[12px] text-cf-text-3">
            История связи <span className="text-cf-text-4">(опционально)</span>
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Коротко: что их связывает, ключевой эпизод…"
            rows={2}
            className="w-full resize-none rounded-2xl bg-white/80 px-4 py-2.5 text-[13px] leading-relaxed text-cf-text-1 ring-1 ring-white/70 backdrop-blur-xl outline-none placeholder:text-cf-text-4 focus:ring-cf-air-accent/40"
          />
        </div>

        {error && (
          <p className="rounded-xl bg-red-50/80 px-3 py-2 text-[12px] text-red-700 ring-1 ring-red-200/80">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <GlassButton variant="ghost" size="sm" type="button" onClick={reset}>
            Очистить
          </GlassButton>
          <GlassButton
            variant="primary"
            size="sm"
            type="submit"
            disabled={pending || !selected}
          >
            {pending ? 'Сохраняем…' : 'Добавить связь'}
          </GlassButton>
        </div>
      </div>
    </form>
  )
}

function SelectedPill({
  character,
  onClear,
}: {
  character: CharacterSummary
  onClear: () => void
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-white/85 px-3 py-2 ring-1 ring-cf-air-line backdrop-blur-xl">
      <Avatar avatar={character.avatar} name={character.name} small />
      <span className="flex-1 truncate text-[13px] text-cf-text-heading">
        {character.name}
      </span>
      <button
        type="button"
        onClick={onClear}
        className="text-[12px] text-cf-text-4 transition-colors hover:text-cf-text-1"
        aria-label="Убрать выбор"
      >
        ×
      </button>
    </div>
  )
}

function Avatar({
  avatar,
  name,
  small = false,
}: {
  avatar: string | null
  name: string
  small?: boolean
}) {
  const size = small ? 'h-7 w-7' : 'h-9 w-9'
  const fontSize = small ? 'text-[11px]' : 'text-[12px]'
  return (
    <span className={`relative ${size} shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2`}>
      {avatar ? (
        <Image
          src={avatar}
          alt={name}
          width={36}
          height={36}
          className="h-full w-full object-cover"
        />
      ) : (
        <span className={`flex h-full w-full items-center justify-center text-cf-text-3 ${fontSize}`}>
          {name[0]?.toUpperCase() ?? '·'}
        </span>
      )}
    </span>
  )
}

function RelationshipCard({
  characterId,
  relationship,
}: {
  characterId: string
  relationship: CharacterRelationshipWithMutual
}) {
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function onDelete() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('relationshipId', relationship.id)
      fd.set('characterId', characterId)
      try {
        await deleteCharacterRelationshipAction(fd)
        router.refresh()
      } catch (e) {
        // Здесь нет локального state для ошибки — карточка исчезнет после
        // ревалидации, ошибки редки (только IDOR или удалённая запись).
        console.error(e)
      }
    })
  }

  const isCustom = !isDefaultRelationshipKey(relationship.relationship_type)
  const tone = TONE_TO_CHIP[relationshipTone(relationship.relationship_type)] ?? 'quiet'

  return (
    <li className="group rounded-3xl bg-white/75 p-4 ring-1 ring-cf-air-line backdrop-blur-2xl shadow-[var(--cf-air-shadow)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/90">
      <div className="flex items-start gap-3.5">
        <Avatar avatar={relationship.related_avatar} name={relationship.related_name} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <p className="truncate text-[14px] font-medium text-cf-text-heading">
              {relationship.related_name}
            </p>
            <GlassChip tone="quiet">{relationship.related_type === 'city' ? 'город' : 'персонаж'}</GlassChip>
            {relationship.is_mutual && <GlassChip tone="on">взаимно</GlassChip>}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <GlassChip tone={tone}>
              {isCustom ? relationship.relationship_type : relationshipLabel(relationship.relationship_type)}
            </GlassChip>
            {relationship.inverse_type && relationship.inverse_type !== relationship.relationship_type && (
              <GlassChip tone="quiet">
                ↔ {isDefaultRelationshipKey(relationship.inverse_type)
                  ? relationshipLabel(relationship.inverse_type)
                  : relationship.inverse_type}
              </GlassChip>
            )}
          </div>
          {relationship.description && (
            <p className="mt-2 whitespace-pre-wrap text-[12px] leading-relaxed text-cf-text-caption">
              {relationship.description}
            </p>
          )}
        </div>
        <GlassButton
          variant="danger"
          size="sm"
          onClick={onDelete}
          disabled={pending}
          aria-label="Удалить связь"
        >
          Удалить
        </GlassButton>
      </div>
    </li>
  )
}
