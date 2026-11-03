'use client'

import type { ReactNode } from 'react'
import { usePathname } from 'next/navigation'

export function StudioFrame({ children, sidebar }: { children: ReactNode; sidebar: ReactNode }) {
  const pathname = usePathname()
  const isReleaseEditor = /^\/studio\/releases\/(?!new(?:\/|$))[^/]+\/?$/.test(pathname)

  if (isReleaseEditor) {
    return (
      <div className="paper-theme paper-frame">
        <main className="min-w-0 w-full">{children}</main>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen w-full relative">
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute -top-40 -right-40 size-96 bg-violet-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
        <div className="absolute top-1/3 -left-20 size-72 bg-rose-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
        <div className="absolute -bottom-20 right-1/3 size-80 bg-amber-200/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
        <div className="absolute top-2/3 right-10 size-64 bg-emerald-100/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '14s' }} />
      </div>
      {sidebar}
      <main className="flex-1 overflow-auto bg-gradient-to-br from-violet-50/40 via-white to-amber-50/30 min-h-screen min-w-0">
        {children}
      </main>
    </div>
  )
}
