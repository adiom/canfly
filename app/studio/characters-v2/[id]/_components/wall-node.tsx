import Link from 'next/link'
import { ArrowUpRight } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { CharacterNode } from './character-node'
import type { LifeState } from '@/lib/server/character-completeness'
import type { CharacterWallPostWithUser } from '@/lib/types'

/**
 * Стена — обзорный узел. Модерация (hide/delete) живёт в старом редакторе,
 * поэтому здесь только список + ссылка на модерацию. Полная модерация
 * переносится в v2 отдельной итерацией.
 */
export function WallNode({
  characterId,
  state,
  wallPosts,
}: {
  characterId: string
  state: LifeState
  wallPosts: CharacterWallPostWithUser[]
}) {
  return (
    <CharacterNode
      id="wall"
      title="Стена"
      eyebrow="09 · стена"
      state={state}
      aside={
        <Link
          href={`/studio/characters/${characterId}#wall`}
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] text-neutral-500 transition-colors hover:text-neutral-900"
        >
          Модерация
          <ArrowUpRight className="h-3 w-3" />
        </Link>
      }
    >
      {wallPosts.length === 0 ? (
        <p className="rounded-xl border border-dashed border-neutral-200 bg-white/40 py-8 text-center text-[12px] text-neutral-400">
          На стене пока ничего нет
        </p>
      ) : (
        <ul className="space-y-2">
          {wallPosts.slice(0, 6).map((post) => (
            <li
              key={post.id}
              className={`rounded-xl border border-neutral-200 bg-white/60 p-3 ${post.hidden ? 'opacity-60' : ''}`}
            >
              <div className="mb-1 flex items-center gap-2 text-[11px]">
                <span className="font-medium text-neutral-900">{post.user.display_name}</span>
                <span className="text-neutral-400">@{post.user.handle}</span>
                {post.hidden && (
                  <Badge variant="outline" className="bg-neutral-100 text-neutral-400 border-neutral-200 px-2 py-0.5 text-[9px] uppercase tracking-[0.12em]">
                    скрыто
                  </Badge>
                )}
                <span className="text-neutral-400">
                  · {new Date(post.created_at).toLocaleString('ru-RU')}
                </span>
              </div>
              <p className="whitespace-pre-wrap text-[13px] text-neutral-700">{post.content}</p>
            </li>
          ))}
          {wallPosts.length > 6 && (
            <li className="pt-1 text-center text-[11px] text-neutral-400">
              и ещё {wallPosts.length - 6} — в модерации
            </li>
          )}
        </ul>
      )}
    </CharacterNode>
  )
}
