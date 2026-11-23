'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Edit, Trash2, Clock } from 'lucide-react'
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
import { deleteCharacterPostAction } from '@/lib/actions/studio-characters'
import { formatStudioDate } from '@/lib/studio/format-studio-date'
import type { CharacterPost } from '@/lib/types'

const postTypeLabels: Record<string, string> = {
  thought: 'Мысль',
  announcement: 'Анонс',
  question: 'Вопрос',
}

const postTypeBadgeStyles: Record<string, string> = {
  thought: 'bg-violet-50 text-violet-600 border-violet-200/80',
  announcement: 'bg-amber-50 text-amber-600 border-amber-200/80',
  question: 'bg-sky-50 text-sky-600 border-sky-200/80',
}

export function CharacterPostsTable({
  characterId,
  posts,
}: {
  characterId: string
  posts: CharacterPost[]
}) {
  const [now] = useState(() => Date.now())

  async function handleDelete(postId: string) {
    try {
      await deleteCharacterPostAction(postId)
      toast.success('Пост удалён')
    } catch (error) {
      if (isRedirectError(error)) throw error
      toast.error('Не удалось удалить')
    }
  }

  if (posts.length === 0) {
    return (
      <div className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-12 text-center">
        <p className="text-gray-400">Постов пока нет</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {posts.map((post) => {
        const scheduled = post.scheduled_at && new Date(post.scheduled_at).getTime() > now
        return (
          <div key={post.id} className="bg-white/60 backdrop-blur-md border border-white/70 rounded-2xl shadow-sm shadow-black/5 p-4 transition-all duration-200 hover:bg-white/80 hover:shadow-md">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 flex-1">
                <div className="mb-2 flex items-center gap-2">
                  <Badge variant="outline" className={`border px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] rounded-lg ${postTypeBadgeStyles[post.post_type] ?? 'bg-gray-100 text-gray-500 border-gray-200/80'}`}>
                    {postTypeLabels[post.post_type] ?? post.post_type}
                  </Badge>
                  {scheduled ? (
                    <Badge variant="outline" className="gap-1 border-violet-200/80 bg-violet-50 text-violet-600 rounded-lg px-2.5 py-0.5">
                      <Clock className="h-3 w-3" />
                      {formatStudioDate(post.scheduled_at!)}
                    </Badge>
                  ) : (
                    <span className="text-xs text-gray-400">
                      {formatStudioDate(post.created_at)}
                    </span>
                  )}
                </div>
                <p className="line-clamp-3 whitespace-pre-wrap text-sm text-gray-700">{post.content}</p>
                {post.image_url ? (
                  <p className="mt-2 text-xs text-gray-400">с изображением</p>
                ) : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button asChild variant="ghost" size="icon" className="rounded-xl text-gray-400 hover:text-violet-600 hover:bg-violet-50/50">
                  <Link href={`/studio/characters/${characterId}/posts/${post.id}/edit`}>
                    <Edit className="h-4 w-4" />
                  </Link>
                </Button>
                <AlertDialog>
                  <AlertDialogTrigger className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-red-50 hover:text-red-600">
                    <Trash2 className="h-4 w-4" />
                  </AlertDialogTrigger>
                  <AlertDialogContent className="bg-white/80 backdrop-blur-xl border-white/70 rounded-2xl shadow-xl">
                    <AlertDialogHeader>
                      <AlertDialogTitle className="text-gray-900">Удалить пост?</AlertDialogTitle>
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
        )
      })}
    </div>
  )
}