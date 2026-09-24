'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'
import { Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { deleteGameAction } from '@/lib/actions/studio-games'

export function DeleteGameButton({ id, title }: { id: string; title: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)

  async function handleDelete() {
    if (!confirm(`Удалить игру «${title}»? Файлы в public/games останутся на месте.`)) return

    setBusy(true)
    try {
      await deleteGameAction(id)
      toast.success('Игра удалена')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error(error instanceof Error ? error.message : 'Ошибка удаления')
      setBusy(false)
      router.refresh()
    }
  }

  return (
    <Button
      variant="outline"
      onClick={handleDelete}
      disabled={busy}
      className="rounded-xl border-red-200 text-red-600 hover:bg-red-50"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      {busy ? 'Удаление...' : 'Удалить'}
    </Button>
  )
}
