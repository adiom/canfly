import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { requireStudioSession } from '@/lib/server/studio-auth'
import { getNewsForEdit } from '@/lib/actions/studio-news'
import { NewsEditor } from '@/components/studio/news-editor'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditNewsPage({ params }: PageProps) {
  const { id } = await params
  const session = await requireStudioSession()
  if (!session) notFound()

  const news = await getNewsForEdit(id)
  if (!news) notFound()

  return (
    <div className="min-h-screen bg-cf-bg">
      <div className="mx-auto max-w-2xl px-4 py-10 md:px-8 md:py-14">
        <Link
          href="/studio/news"
          className="mb-8 inline-flex items-center gap-2 text-xs font-black uppercase tracking-[0.12em] text-cf-text-3 hover:text-cf-text-1 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          К новостям
        </Link>

        <NewsEditor news={news} />
      </div>
    </div>
  )
}
