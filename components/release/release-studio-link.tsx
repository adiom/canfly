'use client'

import Link from 'next/link'
import { Pen } from 'lucide-react'
import { useSession } from 'next-auth/react'

export function ReleaseStudioLink({ releaseId }: { releaseId: string }) {
  const { data: session } = useSession()
  if (session?.user?.isAdmin !== true) return null

  return (
    <div className="mt-4">
      <Link
        href={`/studio/releases/${releaseId}`}
        className="inline-flex items-center gap-1.5 rounded border border-cf-text-1/15 bg-cf-text-1/6 px-3 py-1.5 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:border-cf-accent hover:bg-cf-accent/10 hover:text-cf-accent"
      >
        <Pen className="h-3 w-3" />
        Studio
      </Link>
    </div>
  )
}
