import { notFound } from 'next/navigation'
import { redirect } from 'next/navigation'
import { fetchReleaseBySlug } from '@/lib/server/releases'
import { fetchEditionBySlug } from '@/lib/server/editions'
import { fetchPublishedChaptersByEdition } from '@/lib/server/chapters'

export default async function EditionPublicPage({
  params,
}: {
  params: Promise<{ slug: string; editionSlug: string }>
}) {
  const { slug, editionSlug } = await params
  const release = await fetchReleaseBySlug(slug)
  if (!release || release.status !== 'published') notFound()

  const edition = await fetchEditionBySlug(editionSlug)
  if (!edition || edition.release_id !== release.id || edition.status !== 'published') notFound()

  // Redirect book editions to the new SEO-friendly URL structure
  if (edition.format === 'book') {
    redirect(`/release/${slug}/book/${edition.quality_tier}/1`)
  }

  const chapters = await fetchPublishedChaptersByEdition(edition.id)

  if (chapters.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-cf-text-3">
        Содержимое ещё не опубликовано
      </div>
    )
  }

  redirect(`/release/${slug}/${editionSlug}/1`)
}