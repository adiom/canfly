'use client'

import { useEffect, useState, useTransition } from 'react'
import Image from 'next/image'

import { GlassButton } from '@/components/ui/glass-button'
import { GlassChip, type ChipTone } from '@/components/ui/glass-chip'
import {
  deleteCharacterReaderAction,
  setCharacterReaderStatusAction,
} from '@/lib/actions/studio-characters'
import type { CharacterFriendshipStatus } from '@/lib/types'

interface Reader {
  id: string
  user_id: string
  handle: string
  display_name: string
  avatar: string | null
  status: CharacterFriendshipStatus
  intimacy_level: number
  created_at: string
}

interface ReadersListProps {
  characterId: string
  initial: Reader[]
}

const STATUS_LABEL: Record<CharacterFriendshipStatus, string> = {
  pending: 'ждёт',
  accepted: 'друг',
  blocked: 'заблокирован',
}

const STATUS_TONE: Record<CharacterFriendshipStatus, ChipTone> = {
  pending: 'slow',
  accepted: 'on',
  blocked: 'quiet',
}

/**
 * Список Character↔User связей в Studio. Показывает pending/accepted/blocked
 * с переключателем статуса и кнопкой удаления. Стиль — orbital glass.
 */
export function ReadersList({ characterId, initial }: ReadersListProps) {
  const [items, setItems] = useState(initial)
  useEffect(() => setItems(initial), [initial])

  const groups: Record<CharacterFriendshipStatus, Reader[]> = {
    pending: [],
    accepted: [],
    blocked: [],
  }
  for (const r of items) groups[r.status].push(r)

  return (
    <div className="space-y-5">
      {(['pending', 'accepted', 'blocked'] as const).map((status) => {
        const list = groups[status]
        if (list.length === 0) return null
        return (
          <div key={status}>
            <div className="mb-3 flex items-center gap-2">
              <GlassChip tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</GlassChip>
              <span className="text-[12px] text-cf-text-4">{list.length}</span>
            </div>
            <ul className="space-y-2.5">
              {list.map((reader) => (
                <ReaderCard
                  key={reader.id}
                  characterId={characterId}
                  reader={reader}
                />
              ))}
            </ul>
          </div>
        )
      })}

      {items.length === 0 && (
        <p className="rounded-2xl bg-cf-air-surface px-4 py-6 text-center text-[13px] text-cf-text-3 backdrop-blur-xl">
          Пока никто не подружился с этим героем.
        </p>
      )}
    </div>
  )
}

function ReaderCard({
  characterId,
  reader,
}: {
  characterId: string
  reader: Reader
}) {
  const [pending, startTransition] = useTransition()

  function setStatus(status: CharacterFriendshipStatus) {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('characterId', characterId)
      fd.set('userId', reader.user_id)
      fd.set('status', status)
      try {
        await setCharacterReaderStatusAction(fd)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })
  }

  function onDelete() {
    startTransition(async () => {
      const fd = new FormData()
      fd.set('characterId', characterId)
      fd.set('userId', reader.user_id)
      try {
        await deleteCharacterReaderAction(fd)
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error(e)
      }
    })
  }

  return (
    <li className="flex items-center gap-3 rounded-3xl bg-white/75 p-3 ring-1 ring-cf-air-line backdrop-blur-2xl shadow-[var(--cf-air-shadow)] transition-all duration-300 hover:bg-white/90">
      <span className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2">
        {reader.avatar ? (
          <Image
            src={reader.avatar}
            alt={reader.display_name}
            width={36}
            height={36}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-[12px] text-cf-text-3">
            {reader.display_name[0]?.toUpperCase() ?? '·'}
          </span>
        )}
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-[14px] font-medium text-cf-text-heading">
          {reader.display_name}
        </p>
        <p className="font-mono text-[11px] text-cf-text-4">@{reader.handle}</p>
      </div>

      <div className="flex shrink-0 items-center gap-1.5">
        {(['pending', 'accepted', 'blocked'] as const).map((status) => {
          const active = reader.status === status
          return (
            <button
              key={status}
              type="button"
              disabled={pending || active}
              onClick={() => setStatus(status)}
              className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] transition-all duration-200 ${
                active
                  ? 'bg-cf-text-heading text-cf-bg'
                  : 'bg-white/70 text-cf-text-3 ring-1 ring-white/70 backdrop-blur-xl hover:bg-white/85 hover:text-cf-text-heading'
              } disabled:cursor-not-allowed`}
              aria-pressed={active}
            >
              {STATUS_LABEL[status]}
            </button>
          )
        })}
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
