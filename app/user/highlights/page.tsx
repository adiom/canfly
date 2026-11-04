import { redirect } from 'next/navigation'
import { getCurrentUser } from '@/lib/server/session'
import { HighlightCollection } from '@/components/highlights/collection'
export const dynamic = 'force-dynamic'
export default async function HighlightsPage() {
  if (!await getCurrentUser()) redirect('/login?redirect=/user/highlights')
  return <main className="mx-auto max-w-4xl px-5 py-12"><HighlightCollection /></main>
}
