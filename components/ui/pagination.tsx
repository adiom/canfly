import Link from 'next/link'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

interface PaginationProps {
  page: number
  totalPages: number
  basePath: string
  query?: Record<string, string | undefined>
}

function buildHref(
  basePath: string,
  query: Record<string, string | undefined>,
  page: number,
) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value) params.set(key, value)
  }
  if (page > 1) params.set('page', String(page))
  else params.delete('page')
  const qs = params.toString()
  return qs ? `${basePath}?${qs}` : basePath
}

/**
 * Окно номеров с эллипсисом: 1 … 4 [5] 6 … 20
 */
function getPageWindow(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)

  const pages: (number | 'ellipsis')[] = [1]
  const start = Math.max(2, current - 1)
  const end = Math.min(total - 1, current + 1)

  if (start > 2) pages.push('ellipsis')
  for (let i = start; i <= end; i++) pages.push(i)
  if (end < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}

export function Pagination({
  page,
  totalPages,
  basePath,
  query = {},
}: PaginationProps) {
  if (totalPages <= 1) return null

  const window = getPageWindow(page, totalPages)
  const hasPrev = page > 1
  const hasNext = page < totalPages

  const btnBase =
    'inline-flex h-10 min-w-10 items-center justify-center px-2 text-sm font-bold transition-colors'

  return (
    <nav
      aria-label="Пагинация"
      className="flex items-center gap-1.5 select-none"
    >
      {hasPrev ? (
        <Link
          href={buildHref(basePath, query, page - 1)}
          aria-label="Предыдущая страница"
          className={cn(
            btnBase,
            'border border-cf-text-1/18 text-cf-text-2 hover:bg-cf-text-1/8 hover:text-cf-text-heading',
          )}
        >
          <ChevronLeft className="h-4 w-4" />
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(btnBase, 'border border-cf-text-1/10 text-cf-text-4/50 cursor-not-allowed')}
        >
          <ChevronLeft className="h-4 w-4" />
        </span>
      )}

      {window.map((p, i) =>
        p === 'ellipsis' ? (
          <span
            key={`e${i}`}
            className="inline-flex h-10 min-w-10 items-center justify-center text-sm text-cf-text-3"
          >
            …
          </span>
        ) : p === page ? (
          <span
            key={p}
            aria-current="page"
            className={cn(btnBase, 'bg-cf-accent text-white')}
          >
            {p}
          </span>
        ) : (
          <Link
            key={p}
            href={buildHref(basePath, query, p)}
            className={cn(
              btnBase,
              'border border-cf-text-1/18 text-cf-text-2 hover:bg-cf-text-1/8 hover:text-cf-text-heading',
            )}
          >
            {p}
          </Link>
        ),
      )}

      {hasNext ? (
        <Link
          href={buildHref(basePath, query, page + 1)}
          aria-label="Следующая страница"
          className={cn(
            btnBase,
            'border border-cf-text-1/18 text-cf-text-2 hover:bg-cf-text-1/8 hover:text-cf-text-heading',
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </Link>
      ) : (
        <span
          aria-disabled
          className={cn(btnBase, 'border border-cf-text-1/10 text-cf-text-4/50 cursor-not-allowed')}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      )}
    </nav>
  )
}
