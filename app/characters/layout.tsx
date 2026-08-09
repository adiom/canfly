import Link from 'next/link'

/**
 * Раздел персонажей живёт без общего хрома: ни SiteHeader, ни SiteFooter.
 * Между читателем и героем не должно стоять меню — остаётся только тихий
 * возврат в угол экрана. Ambient-градиент даёт ту же среду, что и остальной
 * воздушный слой (.cf-air-field), но на всю высоту раздела.
 */
export default function CharactersLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="cf-air-field relative min-h-screen bg-cf-bg text-cf-text-1">
      <Link
        href="/"
        className="fixed left-6 top-6 z-30 text-[11px] uppercase tracking-[0.34em] text-cf-text-3 transition-colors hover:text-cf-text-heading"
      >
        canfly
      </Link>

      {children}
    </div>
  )
}
