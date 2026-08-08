import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import Link from 'next/link'

import { fetchBookBySlug } from '@/lib/server/books'
import { generateBookSchema, generateBreadcrumbSchema, serializeJsonLd } from '@/lib/seo/schema'
import { MarkdownRenderer } from '@/components/markdown-renderer'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

interface BookFullPageProps {
  params: Promise<{ slug: string }>
}

export async function generateMetadata({ params }: BookFullPageProps): Promise<Metadata> {
  const { slug } = await params
  const book = await fetchBookBySlug(slug)

  if (!book) {
    return { title: 'Книга не найдена | canfly' }
  }

  const typeLabel = book.type === 'comic' ? 'Комикс' : book.type === 'audiobook' ? 'Аудиокнига' : 'Книга'
  const title = `${book.title} (полная версия) — ${typeLabel} | canfly`
  const description = book.description || `${typeLabel} «${book.title}» от издательства canfly`
  const url = `${BASE_URL}/books/${book.slug}/full`

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

export default async function BookFullPage({ params }: BookFullPageProps) {
  const { slug } = await params
  const book = await fetchBookBySlug(slug)

  if (!book) {
    notFound()
  }

  const chapters = book.chapters || []

  const bookSchema = generateBookSchema(book, BASE_URL)
  const breadcrumbSchema = generateBreadcrumbSchema(
    [
      { label: 'Главная', url: BASE_URL },
      { label: 'Книги', url: `${BASE_URL}/books` },
      { label: book.title, url: `${BASE_URL}/books/${book.slug}/1` },
      { label: 'Полная версия', url: `${BASE_URL}/books/${book.slug}/full` },
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
      
      <main className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950">
        {/* Header */}
        <header className="border-b border-slate-800 backdrop-blur-sm sticky top-0 z-50">
          <div className="max-w-7xl mx-auto px-4 py-6 flex justify-between items-center">
            <Link href="/" className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              Canfly
            </Link>
            <div className="flex gap-4 items-center">
              <Link href={`/books/${book.slug}/1`} className="text-slate-300 hover:text-white transition-colors text-sm">
                ← Постраничный режим
              </Link>
            </div>
          </div>
        </header>

        {/* Content */}
        <article className="max-w-4xl mx-auto px-4 py-12">
          <header className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold text-white mb-4">{book.title}</h1>
            {book.description && (
              <p className="text-slate-400 text-lg max-w-2xl mx-auto">{book.description}</p>
            )}
          </header>

          {/* Все главы */}
          {chapters.map((chapter, index) => (
            <section key={index} id={`chapter-${index + 1}`} className="mb-16">
              <h2 className="text-2xl md:text-3xl font-bold text-white mb-6 pb-4 border-b border-slate-700">
                {chapter.title}
              </h2>
              <MarkdownRenderer content={chapter.content} className="prose prose-invert max-w-none" />
            </section>
          ))}

          {chapters.length === 0 && (
            <div className="text-center py-12">
              <p className="text-slate-400">Содержимое книги недоступно</p>
            </div>
          )}
        </article>

        {/* Footer */}
        <footer className="border-t border-slate-800 py-8 bg-slate-950/50">
          <div className="max-w-7xl mx-auto px-4 text-center text-slate-400 text-sm">
            <p>2026 &copy; Canfly</p>
          </div>
        </footer>
      </main>
    </>
  )
}
