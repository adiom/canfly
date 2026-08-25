import Image from 'next/image'
import Link from 'next/link'
import { MessageCircle, Settings, UserRound } from 'lucide-react'
import type { ChapterHighlight } from '@/lib/releases-types'

import { fetchReaderProfileSummary } from '@/lib/server/users'
import { getCurrentUser } from '@/lib/server/session'
import { Button } from '@/components/ui/button'
import { HighlightVisibilityToggle } from '@/components/profile/highlight-visibility-toggle'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Профиль читателя | canfly',
  description: 'Личный профиль читателя canfly: роли, персонажи-друзья и диалоги.',
}

export default async function ProfilePage() {
  const user = await getCurrentUser()
  const summary = user ? await fetchReaderProfileSummary(user.id) : null

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <header className="border-b border-cf-text-1/10 bg-cf-bg/95 sticky top-0 z-50">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
            canfly
          </Link>
          <div className="flex items-center gap-4">
            <Link href="/profile/settings" className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cf-text-2 hover:text-cf-text-heading transition-colors">
              <Settings className="h-4 w-4" />
              Настройки
            </Link>
            <Link href="/characters" className="text-xs font-black uppercase tracking-[0.18em] text-cf-text-2 hover:text-cf-text-heading transition-colors">
              Персонажи
            </Link>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-12 md:px-8 md:py-16">
        <div className="mb-10 flex flex-col gap-6 border-b border-cf-text-1/10 pb-10 md:flex-row md:items-end md:justify-between">
          <div className="flex items-center gap-5">
            <div className="flex h-20 w-20 items-center justify-center border border-cf-text-1/10 bg-cf-bg-2">
              {user?.avatar ? (
                <Image src={user.avatar} alt={user.display_name} width={80} height={80} className="h-full w-full object-cover" />
              ) : (
                <UserRound className="h-9 w-9 text-cf-tan" />
              )}
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-cf-tan">Профиль</p>
              <h1 className="mt-2 text-4xl font-black uppercase md:text-5xl">
                {user?.display_name || 'Читатель canfly'}
              </h1>
              <p className="mt-2 text-sm text-cf-text-2">
                {user
                  ? user.login
                    ? `login: ${user.login}`
                    : `@${user.handle}`
                  : 'Профиль появится после входа, добавления персонажа в друзья или первого диалога.'}
              </p>
            </div>
          </div>

          {summary ? (
            <div className="flex flex-wrap gap-2">
              {summary.publicRole === 'author' && (
                <span
                  className="border border-cf-text-1/10 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-cf-warm"
                >
                  Автор
                </span>
              )}
            </div>
          ) : null}
        </div>

        {!user || !summary ? (
          <div className="max-w-2xl border border-cf-text-1/10 bg-cf-bg-2 p-6">
            <h2 className="text-2xl font-black uppercase">Пока пусто</h2>
            <p className="mt-3 leading-7 text-cf-text-2">
              Добавь персонажа в друзья или начни чат, и здесь появятся твои связи, роли и история диалогов.
            </p>
            <Button asChild className="mt-6 h-12 bg-cf-accent px-5 text-sm font-black uppercase text-white hover:bg-[#b01e1e]">
              <Link href="/login">Войти или создать профиль</Link>
            </Button>
          </div>
        ) : (
          <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
            <section>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">Персонажи-друзья</h2>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cf-blue">
                  {summary.friendships.length}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                {summary.friendships.map((friendship) => (
                  <Link
                    key={friendship.id}
                    href={`/characters/${friendship.character_slug}`}
                    className="group border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-colors hover:border-cf-warm/45"
                  >
                    <div className="flex gap-4">
                      <div className="relative h-16 w-16 flex-shrink-0 overflow-hidden border border-cf-text-1/10 bg-cf-bg">
                        {friendship.character_avatar ? (
                          <Image
                            src={friendship.character_avatar}
                            alt={friendship.character_name}
                            fill
                            className="object-cover"
                          />
                        ) : null}
                      </div>
                      <div>
                        <h3 className="font-black uppercase group-hover:text-cf-warm">
                          {friendship.character_name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm leading-6 text-cf-text-2">
                          {friendship.character_bio || 'Персонаж canfly'}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 h-1 bg-cf-bg">
                      <div
                        className="h-full bg-cf-accent"
                        style={{ width: `${Math.min(friendship.intimacy_level, 100)}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs uppercase tracking-[0.18em] text-cf-tan">
                      Близость {friendship.intimacy_level}/100
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <section>
              <div className="mb-5 flex items-center justify-between">
                <h2 className="text-2xl font-black uppercase">Мои цитаты</h2>
                <span className="text-xs font-black uppercase tracking-[0.18em] text-cf-blue">
                  {summary.highlights.length}
                </span>
              </div>
              <div className="space-y-4">
                {summary.highlights.map((highlight: ChapterHighlight) => (
                  <div
                    key={highlight.id}
                    className="border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-colors hover:border-cf-warm/45"
                  >
                    <p className="text-sm italic leading-6 text-cf-text-2">
                      «{highlight.text_content}»
                    </p>
                    {highlight.note && (
                      <p className="mt-2 text-sm text-cf-text-1">{highlight.note}</p>
                    )}
                    <div className="mt-3 flex items-center justify-between">
                      <HighlightVisibilityToggle
                        highlightId={highlight.id}
                        initialIsPublic={highlight.is_public}
                      />
                      <div className="flex items-center gap-3">
                        {highlight.likes_count > 0 && (
                          <span className="text-[10px] uppercase tracking-[0.18em] text-cf-accent">
                            ♥ {highlight.likes_count}
                          </span>
                        )}
                        <span className="text-[10px] uppercase tracking-[0.18em] text-cf-blue">
                          {new Date(highlight.created_at).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}

                {summary.highlights.length === 0 ? (
                  <p className="border border-cf-text-1/10 bg-cf-bg-2 p-4 text-sm text-cf-text-2">
                    Цитат пока нет. Выделите текст в читалке, чтобы сохранить цитату.
                  </p>
                ) : null}
              </div>
            </section>

            <section>
              <h2 className="mb-5 text-2xl font-black uppercase">Диалоги</h2>
              <div className="space-y-3">
                {summary.conversations.map((conversation) => (
                  <Link
                    key={conversation.id}
                    href={`/characters/${conversation.character_slug}/chat`}
                    className="flex gap-4 border border-cf-text-1/10 bg-cf-bg-2 p-4 transition-colors hover:border-cf-warm/45"
                  >
                    <MessageCircle className="mt-1 h-5 w-5 flex-shrink-0 text-cf-blue" />
                    <div>
                      <h3 className="font-black uppercase">{conversation.character_name}</h3>
                      <p className="mt-1 line-clamp-2 text-sm leading-6 text-cf-text-2">
                        {conversation.last_message || 'Диалог создан. Напиши первое сообщение.'}
                      </p>
                    </div>
                  </Link>
                ))}

                {summary.conversations.length === 0 ? (
                  <p className="border border-cf-text-1/10 bg-cf-bg-2 p-4 text-sm text-cf-text-2">
                    Диалогов пока нет.
                  </p>
                ) : null}
              </div>
            </section>
          </div>
        )}
      </section>
    </main>
  )
}
