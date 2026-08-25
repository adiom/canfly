'use client'

import { useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { ArrowLeft, ExternalLink, Trash2, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { deleteCharacterAction } from '@/lib/actions/studio-characters'
import { changeCharacterTypeAction } from '@/lib/actions/studio-characters-v2'
import { LifeStateDot, LifeStateLabel } from './life-state'
import type { LifeState } from '@/lib/server/character-completeness'
import type { Character, CharacterType } from '@/lib/types'

interface ControlBarProps {
  character: Character
  density: number
  summary: LifeState
  isAdmin: boolean
}

export function ControlBar({
  character,
  density,
  summary,
  isAdmin,
}: ControlBarProps) {
  const router = useRouter()
  const [pendingType, startType] = useTransition()

  function changeType(type: CharacterType) {
    startType(async () => {
      try {
        await changeCharacterTypeAction(character.id, type)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'Не удалось сменить тип')
      }
    })
  }

  async function handleDelete() {
    try {
      await deleteCharacterAction(character.id)
    } catch (e) {
      if (isRedirectError(e)) throw e
      toast.error('Не удалось удалить')
    }
  }

  return (
    <div className="sticky top-2 z-10 mx-auto flex max-w-5xl flex-wrap items-center gap-2 rounded-full border border-white/70 bg-white/72 px-3 py-2 shadow-[0_18px_60px_rgba(15,23,42,0.08)] backdrop-blur-2xl">
      <Link
        href="/studio/characters"
        className="inline-flex h-8 w-8 items-center justify-center rounded-full text-neutral-500 transition-colors hover:bg-white hover:text-neutral-900"
        aria-label="К списку"
      >
        <ArrowLeft className="h-4 w-4" />
      </Link>

      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span className="truncate text-[13px] font-medium text-neutral-900">
          {character.name}
        </span>
        <span className="font-mono text-[11px] text-neutral-400">@{character.slug}</span>
        <span className="hidden text-[11px] text-neutral-300 sm:inline">·</span>
        {isAdmin ? (
          <div className="hidden items-center rounded-full bg-neutral-100/80 p-0.5 sm:flex">
            {(['person', 'city'] as CharacterType[]).map((t) => {
              const active = character.character_type === t
              return (
                <button
                  key={t}
                  type="button"
                  disabled={pendingType || active}
                  onClick={() => changeType(t)}
                  className={`rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] transition-colors ${
                    active
                      ? 'bg-neutral-900 text-white'
                      : 'text-neutral-500 hover:text-neutral-900'
                  } disabled:cursor-not-allowed`}
                >
                  {t === 'person' ? 'герой' : 'город'}
                </button>
              )
            })}
            {pendingType && <Loader2 className="ml-1 h-3 w-3 animate-spin text-neutral-400" />}
          </div>
        ) : (
          <span className="hidden rounded-full bg-neutral-100/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-neutral-500 sm:inline">
            {character.character_type === 'person' ? 'герой' : 'город'}
          </span>
        )}
      </div>

      {/* Density bar — прогресс оживания дела (orbital density gradient). */}
      <div className="flex items-center gap-2">
        <div className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-neutral-200/70 md:block">
          <div
            className="h-full rounded-full"
            style={{
              width: `${Math.round(density * 100)}%`,
              backgroundImage: 'linear-gradient(to right, #38BDF8, #34D399, #A78BFA)',
            }}
          />
        </div>
        <span className="hidden items-center gap-1.5 sm:flex">
          <LifeStateDot state={summary} size={8} />
          <LifeStateLabel state={summary} />
        </span>
      </div>

      <div className="flex items-center gap-1">
        {character.character_type === 'person' && (
          <Button asChild variant="ghost" size="sm" className="rounded-full">
            <Link href={`/characters/${character.slug}`} target="_blank">
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        )}
        {isAdmin && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="sm"
                className="rounded-full text-neutral-400 hover:text-red-600 hover:bg-red-50/60"
                aria-label="Удалить персонажа"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="rounded-2xl border-neutral-200 bg-white shadow-xl">
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить {character.character_type === 'city' ? 'город' : 'персонажа'}?</AlertDialogTitle>
                <AlertDialogDescription>
                  Это необратимо: связи, посты, стена и версии паспорта будут удалены.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel className="rounded-full">Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="rounded-full bg-red-600 text-white hover:bg-red-700"
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
