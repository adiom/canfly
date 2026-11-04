import { cache } from 'react'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'
import { z } from 'zod'
import { getCurrentUser } from '@/lib/server/session'
import { getWorkshop } from '@/lib/server/highlight-workshop'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'
import { HighlightWorkshopView } from '@/components/highlights/workshop'
import { HighlightComposition } from '@/components/highlights/composition'
import { HighlightCardActions } from '@/components/highlights/card-actions'
export const dynamic = 'force-dynamic'
const load = cache((id: string, userId: string | null) => getWorkshop(id, userId))
type Props = { params: Promise<{ id: string }> }
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) return notFoundMetadata()
  const card = await load(id, null)
  if (!card) return { ...notFoundMetadata('Личная карточка'), robots: { index: false, follow: false } }
  return buildMetadata({ title: `«${card.text_content.slice(0, 70)}» — ${card.release_title}`,
    description: `Авторская карточка по мотивам «${card.release_title}»`, path: `/highlight/${id}`, generatedImage: true, ogType: 'article' })
}
export default async function HighlightPage({ params }: Props) {
  const { id } = await params
  if (!z.string().uuid().safeParse(id).success) notFound()
  const user = await getCurrentUser()
  const publicCard = await load(id, null)
  const card = user ? await load(id, user.id) : publicCard
  if (!card) notFound()
  if (card.permissions.edit) return <HighlightWorkshopView id={id} initial={card} />
  return <main className="mx-auto max-w-3xl space-y-8 px-5 py-12 text-cf-text-1">
    <header className="space-y-3"><p className="text-xs uppercase tracking-widest text-cf-accent">Выдели — и твори</p>
      <h1 className="font-serif text-3xl">{card.release_title}</h1>
      <p className="text-cf-text-3">{Array.isArray(card.authors) ? card.authors.map(a => typeof a === 'string' ? a : a.name).filter(Boolean).join(', ') : ''} · {card.chapter_title}</p>
      <p className="text-sm">Карточку создал(а): {card.user_name ?? 'Читатель'}</p>
    </header>
    <HighlightComposition quote={card.text_content} publication={card.publication} />
    <HighlightCardActions id={id} userId={user?.id ?? null} own={false} initialSaved={card.is_saved} initialLiked={card.is_liked_by_me} count={card.likes_count} />
    {card.anchor_status === 'missing' && <p className="text-sm text-cf-text-3">Исходный фрагмент изменён. Точное место не найдено.</p>}
    <footer className="flex flex-wrap gap-5 border-t border-cf-text-1/15 pt-6">
      <Link className="underline" href={`/vvvvv/${card.edition_slug}?highlight=${card.id}`}>Открыть в книге</Link>
      <Link className="underline" href={`/release/${card.release_slug}`}>О произведении</Link>
    </footer>
  </main>
}
