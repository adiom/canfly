import { Cormorant_Garamond } from 'next/font/google'
import ColorsPageClient from './colors-client'
import { JsonLd } from '@/components/seo/json-ld'
import { generateCollectionSchema, generateBreadcrumbSchema } from '@/lib/seo/schema'
import { buildMetadata } from '@/lib/seo/metadata'
import { CANFLY_COLORS } from '@/lib/canfly-colors'
import { CATALOG_PATH } from '@/lib/nav'

const cormorant = Cormorant_Garamond({
  subsets: ['latin', 'cyrillic'],
  weight: ['300', '400', '600'],
  style: ['normal', 'italic'],
  variable: '--font-cormorant',
  display: 'swap',
})

const BASE_URL = process.env.NEXT_PUBLIC_BASE_URL || 'https://canfly.org'

const COLORS_DESCRIPTION =
  'Палитра литературной вселенной canfly — цвета с именами, историями и происхождением.'

export const metadata = buildMetadata({
  title: 'Canfly Colors | canfly',
  description: COLORS_DESCRIPTION,
  path: '/colors',
})

export default function ColorsPage() {
  const collectionSchema = generateCollectionSchema({
    name: 'Canfly Colors',
    description: COLORS_DESCRIPTION,
    path: '/colors',
    items: CANFLY_COLORS.map(color => ({
      name: `${color.name} — ${color.fullName}`,
      url: `${BASE_URL}/colors#${color.id}`,
    })),
  })

  return (
    <div className={cormorant.variable}>
      <JsonLd
        schemas={[
          collectionSchema,
          generateBreadcrumbSchema([
            { label: 'canfly', url: `${BASE_URL}${CATALOG_PATH}` },
            { label: 'Colors', url: `${BASE_URL}/colors` },
          ]),
        ]}
      />
      <ColorsPageClient
        breadcrumbs={[{ label: 'canfly', url: '/' }, { label: 'Colors', url: '/colors' }]}
      />
    </div>
  )
}
