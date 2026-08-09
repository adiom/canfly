import Link from 'next/link'
import { NAV_ITEMS as DEFAULT_NAV_ITEMS, LANDING_PATH, type NavItem } from '@/lib/nav'
import { ThemeToggle } from '@/components/theme-toggle'
import { MobileNav } from '@/components/mobile-nav'
import { SearchDialog } from '@/components/search/search-dialog'
import { HeaderAuth } from '@/components/header-auth'

interface SiteHeaderProps {
  activePath?: string
  navItems?: NavItem[]
  showSearch?: boolean
}

export function SiteHeader({
  activePath = '/',
  navItems = DEFAULT_NAV_ITEMS,
  showSearch = true,
}: SiteHeaderProps) {
  return (
    <header className="sticky top-0 z-[60] border-b border-cf-text-1/10 bg-cf-bg/92 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl h-14 items-center justify-between px-4 md:px-8">
        <Link href={LANDING_PATH} className="flex items-center gap-3" aria-label="Canfly home">
          <span className="flex h-9 w-16 items-center justify-center bg-cf-accent text-lg font-black uppercase tracking-[-0.04em] text-white">
            canfly
          </span>
        </Link>

        <nav className="hidden h-14 items-center lg:flex" aria-label="Главная навигация">
          {navItems.map((item) => {
            const isActive = activePath === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={
                  isActive
                    ? 'flex h-full items-center border-x border-cf-text-1/10 bg-cf-text-1/6 px-3 text-xs font-black uppercase tracking-[0.12em] text-cf-text-heading lg:px-4'
                    : 'flex h-full items-center border-x border-transparent px-3 text-xs font-black uppercase tracking-[0.12em] text-cf-text-2 transition-colors hover:border-cf-text-1/10 hover:bg-cf-text-1/6 hover:text-cf-text-heading lg:px-4'
                }
              >
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ThemeToggle />
          {showSearch && <SearchDialog />}
          <span className="hidden lg:flex">
            <HeaderAuth />
          </span>
          <MobileNav items={navItems} />
        </div>
      </div>
    </header>
  )
}
