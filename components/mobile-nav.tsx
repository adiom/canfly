'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { Menu } from 'lucide-react'

import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { safeInternalPath } from '@/lib/safe-redirect'

const STUDIO_ROLES = ['editor']

const linkClass =
  'flex h-12 items-center rounded-sm px-4 text-sm font-black uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:bg-cf-text-1/6 hover:text-cf-text-heading'

interface MobileNavItem {
  label: string
  href: string
}

interface MobileNavProps {
  items: MobileNavItem[]
}

export function MobileNav({ items }: MobileNavProps) {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  const user = status === 'authenticated' ? session?.user : null
  const isAdmin = user?.isAdmin === true
  const isAuthor = user?.publicRole === 'author'
  const hasEditorRole = (user?.roles ?? []).includes('editor')
  const showStudio = isAdmin || isAuthor || hasEditorRole

  return (
    <Sheet>
      <SheetTrigger className="flex h-10 w-10 cursor-pointer touch-manipulation items-center justify-center text-cf-text-1 hover:text-cf-text-heading lg:hidden" aria-label="Открыть меню">
        <Menu className="h-5 w-5" />
      </SheetTrigger>
      <SheetContent side="left" className="w-72 border-r border-cf-text-1/10 bg-cf-bg p-0">
        <SheetTitle className="sr-only">Навигация</SheetTitle>
        <div className="flex h-14 items-center border-b border-cf-text-1/10 px-4">
          <span className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
            canfly
          </span>
        </div>
        <nav className="flex flex-col gap-1 p-3">
          {items.map((item) => (
            <SheetClose asChild key={item.href}>
              <Link
                href={item.href}
                className={linkClass}
              >
                {item.label}
              </Link>
            </SheetClose>
          ))}

          <div className="my-2 h-px bg-cf-text-1/10" />

          {status === 'loading' ? null : user ? (
            <>
              <SheetClose asChild>
                <Link href="/profile" className={linkClass}>Профиль</Link>
              </SheetClose>
              <SheetClose asChild>
                <Link href="/profile/settings" className={linkClass}>Настройки</Link>
              </SheetClose>
              {showStudio && (
                <SheetClose asChild>
                  <Link href="/studio" className={linkClass}>Studio</Link>
                </SheetClose>
              )}
              <SheetClose asChild>
                <button
                  type="button"
                  onClick={() => signOut({ redirectTo: '/' })}
                  className={`${linkClass} w-full cursor-pointer text-left`}
                >
                  Выйти
                </button>
              </SheetClose>
            </>
          ) : (
            <SheetClose asChild>
              <Link
                href={`/login?redirect=${encodeURIComponent(safeInternalPath(pathname, '/'))}`}
                className={linkClass}
              >
                Войти
              </Link>
            </SheetClose>
          )}
        </nav>
      </SheetContent>
    </Sheet>
  )
}
