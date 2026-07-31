'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen, Library, Home, PenTool, Users } from 'lucide-react'
import type { SessionUser } from '@/lib/server/session'
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@/components/ui/sidebar'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

const baseNav = [
  { title: 'Релизы', href: '/studio', icon: BookOpen },
  { title: 'Серии', href: '/studio/series', icon: Library },
]

const passportNav = [
  { title: 'Персонажи', href: '/studio/characters', icon: Users },
]

export function StudioSidebar({ user, isAdmin: _isAdmin = false, isAuthorOrAdmin = false }: { user: SessionUser; isAdmin?: boolean; isAuthorOrAdmin?: boolean }) {
  const pathname = usePathname()
  const navItems = [...baseNav, ...(isAuthorOrAdmin ? passportNav : [])]

  return (
    <Sidebar className="bg-white/50 backdrop-blur-xl border-r border-white/70 shadow-sm">
      <SidebarHeader className="border-b border-black/5 px-4 py-4">
        <Link href="/studio" className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-gradient-to-br from-violet-500 to-violet-700 text-white shadow-md shadow-violet-500/20">
            <PenTool className="h-4 w-4" />
          </div>
          <span className="text-lg font-black uppercase tracking-wide bg-gradient-to-r from-violet-700 to-violet-500 bg-clip-text text-transparent">Studio</span>
        </Link>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-gray-400 text-xs font-semibold uppercase tracking-widest">Навигация</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => {
                const isActive = item.href === '/studio'
                  ? pathname === '/studio'
                  : pathname.startsWith(item.href)

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton asChild isActive={isActive} className={
                      isActive
                        ? 'bg-violet-100/80 text-violet-700 rounded-xl font-medium shadow-sm shadow-violet-200/50'
                        : 'text-gray-500 hover:text-gray-700 hover:bg-black/5 rounded-xl'
                    }>
                      <Link href={item.href}>
                        <item.icon className={`h-4 w-4 ${isActive ? 'text-violet-600' : 'text-gray-400'}`} />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-black/5 p-4">
        <div className="flex items-center gap-3">
          <Avatar className="h-9 w-9 ring-2 ring-white/80 shadow-sm">
            <AvatarImage src={user.avatar ?? undefined} />
            <AvatarFallback className="bg-gradient-to-br from-violet-100 to-rose-100 text-violet-700 font-semibold text-sm">{user.display_name[0]}</AvatarFallback>
          </Avatar>
          <div className="flex-1 truncate">
            <p className="truncate text-sm font-medium text-gray-800">{user.display_name}</p>
          </div>
          <Link href="/" className="text-gray-400 hover:text-violet-600 transition-colors">
            <Home className="h-4 w-4" />
          </Link>
        </div>
      </SidebarFooter>
    </Sidebar>
  )
}