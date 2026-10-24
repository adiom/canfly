import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireStudioSession, isStudioAdmin, isAuthorOrAdmin } from '@/lib/server/studio-auth'
import { SidebarProvider } from '@/components/ui/sidebar'
import { StudioSidebar } from '@/components/studio/studio-sidebar'

export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const session = await requireStudioSession()
  if (!session) redirect('/studio-access-denied')

  const isAdmin = isStudioAdmin(session)
  const showPassport = isAuthorOrAdmin(session)

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full relative">
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
          <div className="absolute -top-40 -right-40 w-96 h-96 bg-violet-200/30 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '8s' }} />
          <div className="absolute top-1/3 -left-20 w-72 h-72 bg-rose-200/20 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '12s' }} />
          <div className="absolute -bottom-20 right-1/3 w-80 h-80 bg-amber-200/25 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '10s' }} />
          <div className="absolute top-2/3 right-10 w-64 h-64 bg-emerald-100/15 rounded-full blur-3xl animate-pulse" style={{ animationDuration: '14s' }} />
        </div>
        <StudioSidebar user={session.user} isAdmin={isAdmin} isAuthorOrAdmin={showPassport} />
        <main className="flex-1 overflow-auto bg-gradient-to-br from-violet-50/40 via-white to-amber-50/30 min-h-screen">
          {children}
        </main>
      </div>
    </SidebarProvider>
  )
}
