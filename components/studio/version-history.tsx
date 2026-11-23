'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { ChapterVersion } from '@/lib/releases-types'
import { getChapterVersions } from '@/lib/actions/studio'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { History, RotateCcw } from 'lucide-react'

export function VersionHistory({ chapterId, onRestore }: {
  chapterId: string
  onRestore: (versionId: string) => Promise<void>
}) {
  const [versions, setVersions] = useState<ChapterVersion[]>([])
  const [loading, setLoading] = useState(false)
  const [restoring, setRestoring] = useState<string | null>(null)

  async function loadVersions() {
    setLoading(true)
    try {
      const data = await getChapterVersions(chapterId)
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
      await onRestore(versionId)
      toast.success('Версия восстановлена')
      await loadVersions()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Ошибка восстановления')
    } finally {
      setRestoring(null)
    }
  }

  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" onClick={loadVersions}>
          <History className="mr-2 h-4 w-4" />
          Версии
        </Button>
      </SheetTrigger>
      <SheetContent className="w-[400px] sm:w-[500px]">
        <SheetHeader>
          <SheetTitle>История версий</SheetTitle>
        </SheetHeader>
        <div className="mt-4 space-y-3">
          {loading ? (
            <p className="text-sm text-muted-foreground">Загрузка...</p>
          ) : versions.length === 0 ? (
            <p className="text-sm text-muted-foreground">Нет сохранённых версий</p>
          ) : (
            versions.map(v => (
              <div key={v.id} className="rounded-md border p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-medium">Версия {v.version_number}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={restoring !== null}
                    onClick={() => handleRestore(v.id)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" />
                    {restoring === v.id ? 'Восстанавливаю...' : 'Восстановить'}
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  {new Date(v.created_at).toLocaleString('ru-RU')}
                </p>
                <div
                  className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs"
                  dangerouslySetInnerHTML={{ __html: v.content.slice(0, 500) }}
                />
              </div>
            ))
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
