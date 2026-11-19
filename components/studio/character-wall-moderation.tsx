'use client'

import { Eye, EyeOff, Trash2 } from 'lucide-react'
import { isRedirectError } from 'next/dist/client/components/redirect-error'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
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
import {
  deleteStudioWallPostAction,
  setWallPostHiddenAction,
} from '@/lib/actions/studio-characters'
import { formatStudioDate } from '@/lib/studio/format-studio-date'
import type { CharacterWallPostWithUser } from '@/lib/types'

export function CharacterWallModeration({
  wallPosts,
}: {
  wallPosts: CharacterWallPostWithUser[]
}) {
  async function toggleHidden(post: CharacterWallPostWithUser) {
    try {
      await setWallPostHiddenAction(post.id, !post.hidden)
      toast.success(post.hidden ? 'Показано' : 'Скрыто')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Не удалось обновить')
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteStudioWallPostAction(id)
      toast.success('Запись удалена')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Не удалось удалить')
    }
  }

  if (wallPosts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-gray-200/80 bg-white/30 backdrop-blur-sm py-16 text-center text-gray-400">
        На стене пока никто не оставлял сообщений
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {wallPosts.map((post) => (
        <div
          key={post.id}
          className={`bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-4 md:p-5 transition-all duration-300 ${post.hidden ? 'opacity-60 border-dashed' : 'hover:bg-white/80'}`}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-sm">
                <span className="font-semibold text-gray-900">{post.user.display_name}</span>
                <span className="text-gray-400">@{post.user.handle}</span>
                {post.hidden ? <Badge variant="outline" className="bg-gray-100 text-gray-400 border-gray-200/80 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg">Скрыто</Badge> : null}
                <span className="text-xs text-gray-400">
                  · {formatStudioDate(post.created_at)}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-sm text-gray-700">{post.content}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <Button variant="ghost" size="icon" onClick={() => toggleHidden(post)} className="rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50/50">
                {post.hidden ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
              </Button>
              <AlertDialog>
                <AlertDialogTrigger className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50/50 hover:text-red-600">
                  <Trash2 className="h-4 w-4" />
                </AlertDialogTrigger>
                <AlertDialogContent className="bg-white/80 backdrop-blur-xl border-white/70 rounded-2xl shadow-xl">
                  <AlertDialogHeader>
                    <AlertDialogTitle className="text-gray-900">Удалить запись?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Это действие необратимо.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel className="rounded-xl">Отмена</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleDelete(post.id)} className="rounded-xl bg-red-600 text-white">
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}