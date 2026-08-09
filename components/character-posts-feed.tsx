import Image from 'next/image'

import type { CharacterPostType, CharacterPostWithCharacter } from '@/lib/types'

interface PostsFeedProps {
  posts: CharacterPostWithCharacter[]
}

const POST_TYPE_LABEL: Record<CharacterPostType, string> = {
  thought: 'мысль',
  announcement: 'объявление',
  question: 'вопрос',
}

export function CharacterPostsFeed({ posts }: PostsFeedProps) {
  if (posts.length === 0) {
    return <div className="py-8 text-center text-cf-text-3">Пока нет записей</div>
  }

  return (
    <div className="space-y-5">
      {posts.map((post) => (
        <article key={post.id} className="cf-glass overflow-hidden rounded-3xl p-6">
          <div className="mb-4 flex items-center gap-4">
            <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-full bg-cf-air-surface-2">
              {post.character.avatar ? (
                <Image
                  src={post.character.avatar}
                  alt={post.character.name}
                  fill
                  sizes="44px"
                  className="object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center text-sm font-medium uppercase text-cf-text-3">
                  {post.character.name.charAt(0)}
                </div>
              )}
            </div>
            <div className="min-w-0">
              <h3 className="truncate text-cf-text-heading">{post.character.name}</h3>
              <p className="text-xs text-cf-text-3">
                {new Date(post.created_at).toLocaleDateString('ru-RU', {
                  day: 'numeric',
                  month: 'long',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
            <span className="ml-auto shrink-0 rounded-full bg-cf-air-surface-2 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.18em] text-cf-air-accent-ink">
              {POST_TYPE_LABEL[post.post_type]}
            </span>
          </div>

          <p className="whitespace-pre-wrap leading-7 text-cf-text-2">{post.content}</p>

          {post.image_url ? (
            <div className="relative mt-4 h-64 w-full overflow-hidden rounded-2xl">
              <Image
                src={post.image_url}
                alt=""
                fill
                sizes="(max-width: 768px) 100vw, 640px"
                className="object-cover"
              />
            </div>
          ) : null}
        </article>
      ))}
    </div>
  )
}
