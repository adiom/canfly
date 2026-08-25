'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { signOut, useSession } from 'next-auth/react'
import { LogOut, Settings, UserRound, PenLine } from 'lucide-react'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { safeInternalPath } from '@/lib/safe-redirect'

const STUDIO_ROLES = ['editor']

/**
 * Вход/выход в шапке. Раньше выхода из аккаунта в интерфейсе не было вовсе:
 * signOut жил только в legacy-/admin и на /studio-access-denied, то есть
 * обычный читатель, войдя один раз, не мог ни выйти, ни сменить аккаунт.
 *
 * Компонент клиентский намеренно: SiteHeader рендерится в том числе на главной
 * с `revalidate = 60`, и серверный auth() утянул бы её в динамику, сломав ISR.
 */
export function HeaderAuth() {
  const { data: session, status } = useSession()
  const pathname = usePathname()

  if (status === 'loading') {
    return <div className="h-9 w-9 animate-pulse rounded-full bg-cf-text-1/10" aria-hidden />
  }

  if (status !== 'authenticated' || !session?.user) {
    const redirect = safeInternalPath(pathname, '/')
    return (
      <Link
        href={`/login?redirect=${encodeURIComponent(redirect)}`}
        className="flex h-9 items-center px-3 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:text-cf-text-heading"
      >
        Войти
      </Link>
    )
  }

  const user = session.user
  const name = user.name || (user.handle ? `@${user.handle}` : 'Профиль')
  // Роли берутся из JWT и могут быть устаревшими — это подсказка в меню,
  // а не право доступа: Studio всё равно перепроверяет роль по БД в layout.
  const isAdmin = user.isAdmin === true
  const isAuthor = user.publicRole === 'author'
  const hasEditorRole = (user.roles ?? []).includes('editor')
  const showStudio = isAdmin || isAuthor || hasEditorRole

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full"
        aria-label="Меню профиля"
      >
        <Avatar className="h-9 w-9 border border-cf-text-1/10">
          {user.image ? <AvatarImage src={user.image} alt={name} /> : null}
          <AvatarFallback className="bg-cf-bg-2 text-cf-text-2">
            <UserRound className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="truncate">{name}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link href="/profile">
            <UserRound className="mr-2 h-4 w-4" />
            Профиль
          </Link>
        </DropdownMenuItem>

        <DropdownMenuItem asChild>
          <Link href="/profile/settings">
            <Settings className="mr-2 h-4 w-4" />
            Настройки
          </Link>
        </DropdownMenuItem>

        {showStudio && (
          <DropdownMenuItem asChild>
            <Link href="/studio">
              <PenLine className="mr-2 h-4 w-4" />
              Studio
            </Link>
          </DropdownMenuItem>
        )}

        <DropdownMenuSeparator />

        <DropdownMenuItem onSelect={() => signOut({ redirectTo: '/' })}>
          <LogOut className="mr-2 h-4 w-4" />
          Выйти
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
