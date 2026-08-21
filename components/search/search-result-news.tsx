import Link from 'next/link'
import { SearchResultNews } from '@/lib/server/search'
import { highlight } from '@/lib/search-highlight'

interface SearchResultNewsRowProps {
  item: SearchResultNews
  query?: string
}

export function SearchResultNewsRow({ item, query = '' }: SearchResultNewsRowProps) {
  return (
    <li>
      <Link
        href={`/news/${item.slug}`}
        className="group flex items-start gap-4 rounded-sm px-3 py-3 transition-colors hover:bg-[#f4efe5]/6"
      >
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#9f978b]">
              {item.section}
            </span>
            {item.tag && (
              <>
                <span className="text-[#9f978b]">·</span>
                <span className="rounded-sm bg-[#f4efe5]/8 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[#ded7cc]">
                  {item.tag}
                </span>
              </>
            )}
          </div>
          <p className="truncate text-sm font-bold text-[#f4efe5] group-hover:text-white">{highlight(item.title, query)}</p>
          {item.snippet && (
            <p className="mt-1 line-clamp-1 text-xs text-[#6b6560]">{highlight(item.snippet, query)}</p>
          )}
        </div>
      </Link>
    </li>
  )
}
