'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { History, RotateCcw, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { MarkdownRenderer } from '@/components/markdown-renderer'
import {
  listPassportVersionsAction,
  restorePassportVersionAction,
} from '@/lib/actions/studio-characters-v2'
import type { CharacterPassportVersion } from '@/lib/server/character-passport-versions'

/**
 * История ревизий паспорта — по образцу VersionHistory (components/studio/
 * version-history.tsx), но для паспорта: открывается Sheet, подгружает версии,
 * восстанавливает выбранную. Предпросмотр рендерится MarkdownRenderer-ом.
 */
export function PassportVersionHistory({
  characterId,
  hasHistory,
}: {
  characterId: string
  /** На старте неизвестно, есть ли версии — кнопка показывает это состояние. */
  hasHistory?: boolean
}) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [versions, setVersions] = useState<CharacterPassportVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  async function loadVersions() {
    setLoading(true)
    try {
      const data = await listPassportVersionsAction(characterId)
      setVersions(data)
    } catch {
      toast.error('Ошибка загрузки версий')
    } finally {
      setLoading(false)
    }
  }

  async function handleRestore(versionId: string) {
    setRestoring(versionId)
    try {
      await restorePassportVersionAction(characterId, versionId)
      toast.success('Версия восстановлена')
      router.refresh()
      setOpen(false)
    } catch {
      toast.error('Ошибка восстановления')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Sheet
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v && versions.length === 0) loadVersions()
      }}
    >
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="rounded-full text-neutral-500 hover:text-neutral-900"
          onClick={loadVersions}
        >
          <History className="mr-1.5 h-3.5 w-3.5" />
          Версии{hasHistory === false ? '' : ''}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px] overflow-y-auto">
        <SheetHeader>
          <SheetTitle>История паспорта</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-neutral-400">Загрузка…</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-neutral-400">Пока нет сохранённых версий</p>
          ) : (
            versions.map((v) => (
              <div
                key={v.id}
                className="rounded-xl border border-neutral-200 bg-white/70 p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium text-neutral-900">
                    Версия {v.version_number}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={restoring === v.id}
                    onClick={() => handleRestore(v.id)}
                  >
                    {restoring === v.id ? (
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    ) : (
                      <RotateCcw className="mr-1 h-3 w-3" />
                    )}
                    {restoring === v.id ? 'Восстанавливаю…' : 'Восстановить'}
                  </Button>
                </div>
                <p className="text-[11px] text-neutral-400">
                  {new Date(v.created_at).toLocaleString('ru-RU')}
                </p>
                <div className="mt-2 max-h-48 overflow-auto rounded-lg bg-neutral-50 p-3">
                  <MarkdownRenderer
                    content={v.content.slice(0, 800)}
                    className="prose-sm text-neutral-600"
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
