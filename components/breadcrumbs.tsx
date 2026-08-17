import Link from 'next/link'
import { JsonLd } from '@/components/seo/json-ld'
import { generateBreadcrumbSchema } from '@/lib/seo/schema'

interface BreadcrumbItem {
  label: string
  url: string
}

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (items.length === 0) return null

  return (
    <>
      <nav aria-label="Навигация" className="text-xs text-cf-text-3">
        <ol className="flex flex-wrap items-center gap-1">
          {items.map((item, index) => {
            const isLast = index === items.length - 1
            return (
              <li key={item.url + item.label} className="flex items-center">
                {index > 0 && <span className="mx-1">›</span>}
                {isLast ? (
                  <span className="text-cf-text-2">{item.label}</span>
                ) : (
                  <Link href={item.url} className="hover:text-cf-accent transition-colors">
                    {item.label}
                  </Link>
                )}
              </li>
            )
          })}
        </ol>
      </nav>
      <JsonLd
        schemas={[
          generateBreadcrumbSchema(
            items.map(item => ({
              label: item.label,
              url: `${BASE_URL}${item.url}`,
            })),
          ),
        ]}
      />
    </>
  )
}
