import { notFound } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'

import { fetchNewsPostById } from '@/lib/server/news'
import { generateNewsArticleSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { sanitizeChapterHtml } from '@/lib/sanitize'
import { ThemeToggle } from '@/components/theme-toggle'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export const dynamic = 'force-dynamic'

interface NewsPageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: NewsPageProps) {
  const { id } = await params
  const post = await fetchNewsPostById(id)

  if (!post) {
    return { title: 'Новость не найдена — canfly' }
  }

  const url = `${BASE_URL}/news/${post.id}`

  return {
    title: `${post.title} — canfly`,
    description: post.content?.slice(0, 160) ?? post.title,
    openGraph: {
      title: post.title,
      description: post.content?.slice(0, 160) ?? post.title,
      url,
      type: 'article',
      locale: 'ru_RU',
      siteName: 'canfly',
      images: post.cover_image ? [{ url: post.cover_image }] : undefined,
    },
    alternates: { canonical: url },
  }
}

export default async function NewsPage({ params }: NewsPageProps) {
  const { id } = await params
  const post = await fetchNewsPostById(id)

  if (!post || post.status !== 'published') {
    notFound()
  }

  const articleSchema = generateNewsArticleSchema(post, BASE_URL)
  const breadcrumbSchema = generateBreadcrumbSchema([
    { label: 'canfly', url: `${BASE_URL}/` },
    { label: 'Новости', url: `${BASE_URL}/news` },
    { label: post.title, url: `${BASE_URL}/news/${post.id}` },
  ])

  const date = post.published_at ?? post.created_at

  return (
    <main className="min-h-screen bg-cf-bg text-cf-text-1">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />

      <header className="sticky top-0 z-50 border-b border-cf-text-1/10 bg-cf-bg/92 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-4 md:px-8">
          <Link href="/" className="flex items-center gap-3">
            <span className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
              CF
            </span>
          </Link>
          <Link href="/news" className="text-sm font-black uppercase tracking-[0.12em] text-cf-text-2 hover:text-cf-text-heading">
            ← Новости
          </Link>
          <ThemeToggle />
        </div>
      </header>

      <article className="mx-auto max-w-3xl px-4 py-12 md:px-8 md:py-20">
        <p className="mb-4 text-xs font-black uppercase tracking-[0.22em] text-cf-blue">
          {post.section}
        </p>
        <h1 className="text-4xl font-black uppercase leading-none text-cf-text-heading md:text-6xl">
          {post.title}
        </h1>
        {post.tag && (
          <p className="mt-4 text-xs uppercase tracking-[0.14em] text-cf-text-4">{post.tag}</p>
        )}

        {post.cover_image && (
          <div className="relative mt-8 h-64 w-full overflow-hidden border border-cf-text-1/10 sm:h-96">
            <Image
              src={post.cover_image}
              alt={post.title}
              fill
              sizes="(max-width: 768px) 100vw, 768px"
              className="object-cover"
              priority
            />
          </div>
        )}

        {post.content && (
          <div
            className="mt-10 prose prose-lg max-w-none prose-headings:text-cf-text-heading prose-headings:font-black prose-headings:uppercase prose-p:mb-5 prose-p:text-cf-text-caption prose-p:leading-8 prose-blockquote:border-l-cf-accent prose-blockquote:text-cf-text-2 prose-strong:text-cf-text-1 prose-em:text-cf-text-2 prose-a:text-cf-warm prose-img:rounded-sm"
            dangerouslySetInnerHTML={{ __html: sanitizeChapterHtml(post.content) }}
          />
        )}

        <p className="mt-12 text-xs text-cf-text-4">
          {new Date(date).toLocaleDateString('ru-RU', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </article>

      <footer className="border-t border-cf-text-1/10 bg-cf-footer-bg px-4 py-8 md:px-8">
        <div className="mx-auto max-w-7xl text-center text-sm text-cf-text-4">
          <p>© 2005-2026 canfly | культура твоего сознания.</p>
        </div>
      </footer>
    </main>
  )
}
