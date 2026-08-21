import { getMyEditions } from '@/lib/actions/studio'
import { requireStudioSession } from '@/lib/server/studio-auth'
import { EditionsPageClient } from '@/components/studio/editions-page-client'

/**
 * Сквозной раздел «Издания»: быстрый доступ ко всем изданиям без прохода через
 * страницу каждого релиза. Гвард студии стоит в app/studio/layout.tsx, здесь
 * сессия нужна только чтобы отличить админский список от авторского.
 */
export default async function StudioEditionsPage() {
  const session = await requireStudioSession()
  const isAdmin = session?.roles.includes('admin') ?? false
  const editions = await getMyEditions()

  return <EditionsPageClient editions={editions} isAdmin={isAdmin} />
}
