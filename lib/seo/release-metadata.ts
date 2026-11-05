import type { Release } from '@/lib/releases-types'
import { buildMetadata, notFoundMetadata } from '@/lib/seo/metadata'

export function getReleaseMetadata(release: Release) {
  if (release.status === 'archived') return notFoundMetadata()
  const draft = release.status === 'draft'
  return buildMetadata({
    title: draft ? `${release.title} · черновик | canfly` : `${release.title} | canfly`,
    description: draft
      ? `Черновик «${release.title}» — предпросмотр для команды релиза.`
      : release.annotation || release.description || `«${release.title}» на canfly`,
    path: `/release/${release.slug}`,
    generatedImage: true,
    ogType: 'website',
    publishedTime: draft ? undefined : release.release_date ?? release.created_at,
    modifiedTime: draft ? undefined : release.updated_at,
    noindex: draft,
  })
}
