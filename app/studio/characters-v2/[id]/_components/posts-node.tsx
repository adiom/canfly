import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CharacterNode } from './character-node'
import type { LifeState } from '@/lib/server/character-completeness'
import type { CharacterPost } from '@/lib/types'

const TYPE_LABEL: Record<string, string> = {
  thought: 'мысль',
  announcement: 'анонс',
  question: 'вопрос',
}

const TYPE_TONE: Record<string, string> = {
  thought: 'bg-sky-50 text-sky-600 border-sky-200',
  announcement: 'bg-amber-50 text-amber-600 border-amber-200',
  question: 'bg-violet-50 text-violet-600 border-violet-200',
}

/**
 * Посты — обзорный узел. Composer (создание/редактирование с загрузкой картинок
 * и scheduled_at) живёт в старом редакторе и редиректит на старый путь, поэтому
 * здесь только список + ссылка на управление. Глубокий CRUD постов можно
 * перенести в v2 отдельной итерацией.
 */
export function PostsNode({
  characterId,
  state,
  posts,
}: {
  characterId: string
  state: LifeState
  posts: CharacterPost[]
}) {
  return (
    <CharacterNode
      id="posts"
      title="Посты"
      eyebrow="08 · посты"
      state={state}
      aside={
        <Link
          href={`/studio/characters/${characterId}#posts`}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Управление
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      }
    >
      {posts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white/40 py-8 text-center text-[12px] text-neutral-400">
          Постов пока нет
        </p>
      ) : (
        <ul className="space-y-2">
          {posts.slice(0, 6).map((post) => (
            <li
              key={post.id}
              className="rounded-xl border border-neutral-200 bg-white/60 p-3"
            >
              <div className="mb-1.5 flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`border px-2 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em] ${TYPE_TONE[post.post_type] ?? 'bg-neutral-50 text-neutral-500 border-neutral-200'}`}
                >
                  {TYPE_LABEL[post.post_type] ?? post.post_type}
                </Badge>
                {post.scheduled_at && (
                  <span className="text-[10px] text-neutral-400">
                    {new Date(post.scheduled_at).toLocaleString('ru-RU')}
                  </span>
                )}
                {!post.scheduled_at && (
                  <span className="text-[10px] text-neutral-400">
                    {new Date(post.created_at).toLocaleString('ru-RU')}
                  </span>
                )}
              </div>
              <p className="line-clamp-2 whitespace-pre-wrap text-[13px] text-neutral-700">
                {post.content}
              </p>
            </li>
          ))}
          {posts.length > 6 && (
            <li className="pt-1 text-center text-[11px] text-neutral-400">
              и ещё {posts.length - 6} — в управлении
            </li>
          )}
        </ul>
      )}
    </CharacterNode>
  )
}
