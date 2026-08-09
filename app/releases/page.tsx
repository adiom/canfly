import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { fetchReleasesPage } from '@/lib/server/releases'
import type { EditionFormat } from '@/lib/releases-types'
import { ReleasesPageBookmate } from '@/components/releases-page-bookmate'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const VALID_CATEGORIES: (EditionFormat | 'all')[] = [
  'all',
  'comic',
  'book',
  'audiobook',
  'magazine',
  'album',
  'digital',
]

const PAGE_SIZE = 24

interface ReleasesPageProps {
  searchParams: Promise<{
    page?: string
    category?: string
  }>
}

function parseParams(searchParams: {
  page?: string
  category?: string
}) {
  const requestedCategory = (searchParams.category ?? 'all').toLowerCase()
  const category: EditionFormat | 'all' = VALID_CATEGORIES.includes(
    requestedCategory as EditionFormat | 'all',
  )
    ? (requestedCategory as EditionFormat | 'all')
    : 'all'

  const requestedPage = Number.parseInt(searchParams.page ?? '1', 10)
  const page = Number.isFinite(requestedPage) && requestedPage > 0 ? requestedPage : 1

  return { category, page }
}

export async function generateMetadata({
  searchParams,
}: ReleasesPageProps): Promise<Metadata> {
  const sp = await searchParams
  const { category, page } = parseParams(sp)

  const CATEGORY_LABELS: Record<EditionFormat | 'all', string> = {
    all: '',
    comic: ' · комиксы',
    book: ' · книги',
    audiobook: ' · аудиокниги',
    audiorelease: ' · аудиорелизы',
    magazine: ' · журналы',
    album: ' · альбомы',
    digital: ' · цифровые релизы',
  }
  const categoryLabel = CATEGORY_LABELS[category]

  const title = page > 1 ? `Релизы${categoryLabel} — стр. ${page}` : `Релизы${categoryLabel}`

  const params = new URLSearchParams()
  if (category !== 'all') params.set('category', category)
  if (page > 1) params.set('page', String(page))
  const canonical = params.toString()
    ? `${BASE_URL}/releases?${params}`
    : `${BASE_URL}/releases`

  return {
    title: `${title} | canfly`,
    description:
      'Каталог всех релизов вселенной canfly: комиксы, книги, аудиокниги и многое другое.',
    alternates: { canonical },
    openGraph: {
      title: `${title} | canfly`,
      description:
        'Каталог всех релизов вселенной canfly: комиксы, книги, аудиокниги и многое другое.',
      url: canonical,
      siteName: 'canfly',
      locale: 'ru_RU',
      type: 'website',
    },
    twitter: { card: 'summary_large_image' },
  }
}

export default async function ReleasesPage({ searchParams }: ReleasesPageProps) {
  const sp = await searchParams
  const { category, page } = parseParams(sp)

  const data = await fetchReleasesPage({
    status: 'published',
    format: category,
    page,
    pageSize: PAGE_SIZE,
  })

  // Запрошена несуществующая страница → redirect на последнюю валидную
  if (page > data.totalPages) {
    const params = new URLSearchParams()
    if (category !== 'all') params.set('category', category)
    if (data.totalPages > 1) params.set('page', String(data.totalPages))
    const target = params.toString() ? `/releases?${params}` : '/releases'
    redirect(target)
  }

  return (
    <ReleasesPageBookmate data={data} category={category} page={data.page} />
  )
}
