'use client'

import Link from 'next/link'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { Menu, X } from 'lucide-react'

import { ThemeToggle } from '@/components/theme-toggle'
import styles from './v2.module.css'

/**
 * Шапка художественной главной.
 *
 * Якорные ссылки ведут на секции самой страницы, CTA — на существующий
 * каталог `/releases`. `/v2` не попадает в глобальную навигацию: это
 * отдельная сцена со своей шапкой, `NAV_ITEMS` и `SiteHeader` не меняются.
 */
const ANCHOR_LINKS = [
  { id: 'releases', label: 'Релизы', href: '#releases' },
  { id: 'characters', label: 'Персонажи', href: '#characters' },
  { id: 'connections', label: 'Связи', href: '#connections' },
  { id: 'media', label: 'Медиа', href: '#media' },
] as const

type V2Sections = Record<typeof ANCHOR_LINKS[number]['id'], boolean>
const subscribeHydration = () => () => undefined
const hydratedSnapshot = () => true
const serverSnapshot = () => false

export function V2Header({ sections }: { sections: V2Sections }) {
  const hydrated = useSyncExternalStore(subscribeHydration, hydratedSnapshot, serverSnapshot)
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLButtonElement>(null)
  const links = ANCHOR_LINKS.filter((item) => sections[item.id])

  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setOpen(false)
        menuRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [open])

  return (
    <header className={styles.header}>
      <Link href="/" className={styles.brand} aria-label="Canfly — главная">
        canfly<span className={styles.brandDot}>.</span>
      </Link>

      <nav className={styles.nav} aria-label="Разделы страницы">
        {links.map((item) => (
          <a key={item.href} href={item.href} className={styles.navLink}>
            {item.label}
          </a>
        ))}
        <Link href="/releases" className={styles.navCta}>
          Открыть Canfly ↗
        </Link>
      </nav>

      <div className={styles.headerTools}>
        <span className={styles.themeSlot}>
          <ThemeToggle />
        </span>
        <button
          ref={menuRef}
          type="button"
          disabled={!hydrated}
          className={styles.menuButton}
          aria-expanded={open}
          aria-controls="v2-mobile-nav"
          onClick={() => setOpen((value) => !value)}
        >
          {open ? <X size={22} aria-hidden /> : <Menu size={22} aria-hidden />}
          <span className="sr-only">Меню разделов</span>
        </button>
      </div>

      <div
        id="v2-mobile-nav"
        className={`${styles.mobilePanel} ${open ? styles.mobilePanelOpen : ''}`}
      >
        {links.map((item) => (
          <a
            key={item.href}
            href={item.href}
            className={styles.mobileLink}
            onClick={() => setOpen(false)}
          >
            {item.label}
          </a>
        ))}
        <Link
          href="/releases"
          className={styles.mobileLink}
          onClick={() => setOpen(false)}
        >
          Открыть Canfly ↗
        </Link>
      </div>
    </header>
  )
}
