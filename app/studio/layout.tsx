import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { requireStudioSession, isStudioAdmin, isAuthorOrAdmin } from '@/lib/server/studio-auth'
import { SidebarProvider } from '@/components/ui/sidebar'
import { StudioSidebar } from '@/components/studio/studio-sidebar'
import { StudioFrame } from '@/components/studio/studio-frame'

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
      <StudioFrame sidebar={<StudioSidebar user={session.user} isAdmin={isAdmin} isAuthorOrAdmin={showPassport} />}>
        {children}
      </StudioFrame>
    </SidebarProvider>
  )
}
