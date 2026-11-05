import type { Metadata } from 'next'
import type { Edition, Release } from '@/lib/releases-types'
import type { ReleaseDraft } from '@/components/studio/use-release-form'
import { Button } from '@/components/ui/button'
import { canOpenEdition, isExternalEditionUrl } from '@/lib/utils/editions'

type Check = { label: string; ok: boolean; severity: 'Ошибка' | 'Предупреждение' | 'Рекомендация'; section: 'main' | 'editions' | 'characters' }

export function ReleaseReadiness({ release, draft, editions, chapterCounts, unavailableLinks, metadata, onNavigate }: {
  release: Release
  draft: ReleaseDraft
  editions: Edition[]
  chapterCounts: Record<string, number>
  unavailableLinks: number
  metadata: Metadata
  onNavigate: (section: Check['section']) => void
}) {
  const checks: Check[] = [
    { label: 'Название и адрес страницы', ok: Boolean(draft.title.trim()) && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(draft.slug), severity: 'Ошибка', section: 'main' },
    { label: 'Описание и аннотация', ok: Boolean(draft.description.trim() && draft.annotation.trim()), severity: 'Рекомендация', section: 'main' },
    { label: 'Авторство', ok: release.authors.some(author => Boolean(author.name.trim())), severity: 'Предупреждение', section: 'main' },
    { label: 'Обложка', ok: Boolean(draft.cover_image), severity: 'Рекомендация', section: 'main' },
    { label: 'Жанр', ok: Boolean(draft.genre.trim()), severity: 'Рекомендация', section: 'main' },
    { label: 'Издания', ok: editions.some(edition => edition.status !== 'archived'), severity: 'Предупреждение', section: 'editions' },
    { label: 'Доступный опубликованный контент', ok: editions.some(edition => canOpenEdition(edition, chapterCounts[edition.id] ?? 0)), severity: 'Предупреждение', section: 'editions' },
    { label: 'Внешние ссылки', ok: editions.every(edition => edition.status === 'archived' || (edition.format === 'digital' || edition.external_url ? isExternalEditionUrl(edition.external_url) : true)), severity: 'Ошибка', section: 'editions' },
    { label: 'Метаданные страницы', ok: Boolean(metadata.title && metadata.description && metadata.alternates?.canonical), severity: 'Предупреждение', section: 'main' },
    { label: 'Доступность связанных объектов', ok: unavailableLinks === 0, severity: 'Предупреждение', section: 'characters' },
  ]

  return (
    <section aria-labelledby="release-readiness-title">
      <div className="paper-section-heading">
        <div>
          <h2 id="release-readiness-title">Готовность релиза</h2>
          <p className="paper-help">{checks.filter(check => check.ok).length} из {checks.length} проверок пройдено. Список помогает подготовить страницу к публикации.</p>
        </div>
      </div>
      <ul className="grid gap-2">
        {checks.map(check => (
          <li key={check.label} className="flex flex-wrap items-center justify-between gap-2 border-b border-cf-text-1/10 pb-2">
            <span>{check.label}<span className="paper-help block">{check.ok ? 'Готово' : check.severity}</span></span>
            {!check.ok && <Button type="button" variant="ghost" size="sm" onClick={() => onNavigate(check.section)}>Перейти к разделу</Button>}
          </li>
        ))}
      </ul>
      <details className="paper-details mt-5">
        <summary>SEO сохранённой страницы</summary>
        <dl className="paper-details-body grid gap-3 break-words">
          <div><dt className="font-semibold">Title</dt><dd>{typeof metadata.title === 'string' ? metadata.title : '—'}</dd></div>
          <div><dt className="font-semibold">Description</dt><dd>{metadata.description ?? '—'}</dd></div>
          <div><dt className="font-semibold">Canonical</dt><dd>{typeof metadata.alternates?.canonical === 'string' ? metadata.alternates.canonical : '—'}</dd></div>
          <div><dt className="font-semibold">Open Graph</dt><dd>{typeof metadata.openGraph?.title === 'string' ? metadata.openGraph.title : '—'}</dd></div>
          <div><dt className="font-semibold">Доступность</dt><dd>{release.status === 'published' ? 'Публичный релиз, допускается индексация' : release.status === 'draft' ? 'Приватный черновик, noindex' : 'Архив, страница закрыта'}</dd></div>
        </dl>
      </details>
    </section>
  )
}
