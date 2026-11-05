'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowUpRight, Plus } from 'lucide-react'
import type { Release, Edition, Series, ReleaseSeries, ReleaseCharacter } from '@/lib/releases-types'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { CoverImageUploader } from '@/components/studio/cover-image-uploader'
import { EditionCard } from '@/components/studio/edition-card'
import { ReleaseDesignForm } from '@/components/studio/release-design-form'
import { ReleaseCharactersSection } from '@/components/studio/release-characters-section'
import { ReleaseDetailsForm } from '@/components/studio/release-details-form'
import { ReleasePublicationMenu } from '@/components/studio/release-publication-menu'
import { useReleaseForm } from '@/components/studio/use-release-form'
import { ReleaseReadiness } from '@/components/studio/release-readiness'
import { ReleaseWorldLinks, type WorldOption } from '@/components/studio/release-world-links'

const SECTIONS = [
  { value: 'main', label: 'Основное' },
  { value: 'editions', label: 'Издания' },
  { value: 'characters', label: 'Связи' },
  { value: 'design', label: 'Оформление' },
  { value: 'readiness', label: 'Готовность' },
] as const

type Section = typeof SECTIONS[number]['value']

export function ReleasePageClient({ release, editions, series, releaseSeries, characters, releaseCharacters, chapterCounts, metadata, world }: {
  release: Release
  editions: Edition[]
  series: Series[]
  releaseSeries: ReleaseSeries[]
  characters: { id: string; name: string; slug: string; avatar: string | null }[]
  releaseCharacters: ReleaseCharacter[]
  chapterCounts: Record<string, number>
  metadata: Metadata
  world: { canEdit: boolean; games: WorldOption[]; places: WorldOption[]; linkedGameIds: string[]; linkedPlaceIds: string[] }
}) {
  const form = useReleaseForm(release)
  const [activeSection, setActiveSection] = useState<Section>('main')
  const [visited, setVisited] = useState<Section[]>(['main'])
  const [publicationPending, setPublicationPending] = useState(false)
  const date = form.draft.release_date.split('-').reverse().join('.')
  const connections = releaseCharacters.length + releaseSeries.length + world.linkedGameIds.length + world.linkedPlaceIds.length
  const unavailableLinks = world.games.filter(game => !game.available && world.linkedGameIds.includes(game.id)).length

  function selectSection(value: string) {
    const section = value as Section
    setActiveSection(section)
    setVisited(previous => previous.includes(section) ? previous : [...previous, section])
  }

  return (
    <div className="paper-editor">
      <nav className="paper-chrome" aria-label="Навигация Студии">
        <Link href="/" className="paper-brand" aria-label="canfly — главная">canfly<span>.</span></Link>
        <span className="paper-chrome-divider" aria-hidden="true" />
        <Link href="/studio">Студия</Link>
        <Link href="/studio" className="paper-back"><ArrowLeft className="size-3.5" aria-hidden="true" />Все релизы</Link>
      </nav>
      <div className="paper-main">
        <header className="paper-masthead">
          <CoverImageUploader
            variant="paper"
            value={form.draft.cover_image || null}
            onChange={url => form.update('cover_image', url ?? '')}
            onUploadingChange={form.setUploading}
            disabled={form.saving || publicationPending}
          />
          <div className="paper-identity">
            <p className="paper-meta"><span>{form.draft.genre || 'Жанр не указан'}</span>{date && <span>{date}</span>}</p>
            <h1>{form.draft.title || 'Без названия'}</h1>
            <div className="paper-header-actions">
              <ReleasePublicationMenu release={release} series={series} releaseSeries={releaseSeries} disabled={form.saving || form.uploading} onPendingChange={setPublicationPending} />
              {release.status !== 'archived' && (
                <a href={`/release/${release.slug}`} target="_blank" rel="noopener noreferrer" className="paper-text-link">
                  {release.status === 'draft' ? 'Предпросмотр черновика' : 'Открыть на сайте'}<ArrowUpRight className="size-3.5" aria-hidden="true" />
                </a>
              )}
            </div>
          </div>
          <div className="paper-facts">
            <span>Изданий: {editions.length}</span>
            <span>Связей: {connections}</span>
          </div>
        </header>
        <Tabs value={activeSection} onValueChange={selectSection} className="paper-tabs">
          <TabsList className="paper-nav" aria-label="Разделы релиза">
            {SECTIONS.map(({ value, label }) => (
              <TabsTrigger key={value} value={value}>
                {label}
                {value === 'editions' && <span className="paper-count">{editions.length}</span>}
                {value === 'characters' && <span className="paper-count">{connections}</span>}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="main" forceMount hidden={activeSection !== 'main'} className="paper-sheet">
            <ReleaseDetailsForm form={form} disabled={publicationPending} />
          </TabsContent>
          <TabsContent value="editions" forceMount hidden={activeSection !== 'editions'} className="paper-sheet">
            {visited.includes('editions') && (
              <section aria-labelledby="release-editions-heading">
                <div className="paper-section-heading">
                  <div><h2 id="release-editions-heading">Издания</h2><p className="paper-help">Одна история — разные форматы.</p></div>
                  <Button asChild variant="outline" className="paper-button">
                    <Link href={`/studio/editions/new?releaseId=${release.id}`}><Plus className="size-4" aria-hidden="true" />Новое издание</Link>
                  </Button>
                </div>
                {editions.length === 0 ? <p className="paper-empty">Изданий пока нет. Создайте первое, чтобы добавить главы.</p> : (
                  <div className="paper-edition-list">{editions.map(edition => <EditionCard key={edition.id} edition={edition} variant="paper" />)}</div>
                )}
              </section>
            )}
          </TabsContent>
          <TabsContent value="characters" forceMount hidden={activeSection !== 'characters'} className="paper-sheet">
            {visited.includes('characters') && (
              <>
                <ReleaseCharactersSection releaseId={release.id} characters={characters} releaseCharacters={releaseCharacters} />
                <ReleaseWorldLinks releaseId={release.id} kind="game" options={world.games} linkedIds={world.linkedGameIds} canEdit={world.canEdit} />
                <ReleaseWorldLinks releaseId={release.id} kind="place" options={world.places} linkedIds={world.linkedPlaceIds} canEdit={world.canEdit} />
                <p className="paper-help mt-5">Серия и номер фазы настраиваются в меню публикации.</p>
              </>
            )}
          </TabsContent>
          <TabsContent value="design" forceMount hidden={activeSection !== 'design'} className="paper-sheet">
            {visited.includes('design') && <ReleaseDesignForm release={release} preview={form.draft} />}
          </TabsContent>
          <TabsContent value="readiness" className="paper-sheet">
            <ReleaseReadiness release={release} draft={form.draft} editions={editions} chapterCounts={chapterCounts}
              unavailableLinks={unavailableLinks} metadata={metadata} onNavigate={selectSection} />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
