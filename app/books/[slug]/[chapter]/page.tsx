import { notFound, redirect } from 'next/navigation'
import type { Metadata } from 'next'

import { fetchBookBySlug } from '@/lib/server/books'
import { generateBookSchema, generateBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/schema'
import { BookReader } from '@/components/book-reader'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

interface BookChapterPageProps {
  params: Promise<{ slug: string; chapter: string }>
}

export async function generateMetadata({ params }: BookChapterPageProps): Promise<Metadata> {
  const { slug, chapter } = await params
  const book = await fetchBookBySlug(slug)

  if (!book) {
    return { title: 'Книга не найдена | canfly' }
  }

  const chapterIndex = parseInt(chapter) - 1
  const chapterData = book.chapters?.[chapterIndex]

  const typeLabel = book.type === 'comic' ? 'Комикс' : book.type === 'audiobook' ? 'Аудиокнига' : 'Книга'
  const title = chapterData
    ? `${chapterData.title} — ${book.title} | canfly`
    : `${book.title} — ${typeLabel} | canfly`
  const description = book.description || `${typeLabel} «${book.title}» от издательства canfly`
  const url = `${BASE_URL}/books/${book.slug}/${chapter}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url,
      type: 'book',
      locale: 'ru_RU',
      siteName: 'canfly',
      ...(book.cover_image && {
        images: [{ url: book.cover_image, width: 600, height: 900, alt: book.title }],
      }),
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      ...(book.cover_image && { images: [book.cover_image] }),
    },
    alternates: {
      canonical: url,
    },
  }
}

export default async function BookChapterPage({ params }: BookChapterPageProps) {
  const { slug, chapter } = await params
  const book = await fetchBookBySlug(slug)

  if (!book) {
    notFound()
  }

  const chapterIndex = parseInt(chapter) - 1

  // Валидация главы
  if (isNaN(chapterIndex) || chapterIndex < 0 || (book.chapters && chapterIndex >= book.chapters.length)) {
    redirect(`/books/${slug}/1`)
  }

  const bookSchema = generateBookSchema(book, BASE_URL)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { label: 'Главная', url: BASE_URL },
      { label: 'Книги', url: `${BASE_URL}/books` },
      { label: book.title, url: `${BASE_URL}/books/${book.slug}/1` },
      ...(book.chapters?.[chapterIndex] ? [{ label: book.chapters[chapterIndex].title, url: `${BASE_URL}/books/${book.slug}/${chapter}` }] : []),
    ],
  )

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(bookSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: serializeJsonLd(breadcrumbSchema) }}
      />
      <BookReader book={book} initialChapter={chapterIndex} />
    </>
  )
}
