import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { fetchBookBySlug } from '@/lib/server/books'
import { generateBookSchema, generateBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/schema'
import { BookReader } from '@/components/book-reader'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

interface BookPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BookPageProps): Promise<Metadata> {
  const { slug } = await params
  const book = await fetchBookBySlug(slug)

  if (!book) {
    return { title: 'Книга не найдена | canfly' }
  }

  const typeLabel = book.type === 'comic' ? 'Комикс' : book.type === 'audiobook' ? 'Аудиокнига' : 'Книга'
  const title = `${book.title} — ${typeLabel} | canfly`
  const description = book.description || `${typeLabel} «${book.title}» от издательства canfly`
  const url = `${BASE_URL}/books/${book.slug}`

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

export default async function BookPage({ params }: BookPageProps) {
  const { slug } = await params
  const book = await fetchBookBySlug(slug)

  if (!book) {
    notFound()
  }

  const bookSchema = generateBookSchema(book, BASE_URL)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { label: 'Главная', url: BASE_URL },
      { label: 'Книги', url: `${BASE_URL}/books` },
      { label: book.title, url: `${BASE_URL}/books/${book.slug}/1` },
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
      <BookReader book={book} initialChapter={0} />
    </>
  )
}
