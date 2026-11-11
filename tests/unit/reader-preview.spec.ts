import { test, expect } from '@playwright/test'
import { rejects } from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { resolve } from 'node:path'
import { runInNewContext } from 'node:vm'
import { Children, isValidElement, type ReactNode } from 'react'
import ts from 'typescript'
import type { Metadata } from 'next'
import type { SpreadReaderProps } from '../../components/spread-reader'

const nativeRequire = createRequire(resolve('package.json'))
const params = { params: Promise.resolve({ slug: 'private-edition' }), searchParams: Promise.resolve({}) }

// Run the actual Server Component with isolated auth/repository boundaries, no database writes.
function readerHarness(options: {
  admin?: boolean
  signedIn?: boolean
  editionStatus?: string
  releaseStatus?: string
  format?: string
  empty?: boolean
  missing?: 'edition' | 'release'
} = {}) {
  const calls: string[] = []
  const user = options.admin || options.signedIn
    ? { id: 'user', is_admin: options.admin === true, public_role: 'author' }
    : null
  const edition = { id: 'edition', release_id: 'release', slug: 'private-edition', format: options.format ?? 'book', status: options.editionStatus ?? 'published', artwork_url: '/art.jpg' }
  const release = { id: 'release', slug: 'private-release', title: 'Private release', status: options.releaseStatus ?? 'published' }
  const chapters = options.empty ? [] : [
    { id: 'published', status: 'published', title: 'Published text' },
    { id: 'draft', status: 'draft', title: 'Secret draft' },
  ]
  const component = () => null
  const modules: Record<string, unknown> = {
    react: { ...nativeRequire('react'), cache: (fn: unknown) => fn },
    'next/navigation': { notFound: () => { throw new Error('404') } },
    '@/lib/server/editions': { fetchEditionByIdOrSlug: async () => options.missing === 'edition' ? null : edition },
    '@/lib/server/releases': { fetchReleaseById: async () => options.missing === 'release' ? null : release, fetchReleaseSeries: async () => [] },
    '@/lib/server/chapters': {
      fetchAllChaptersByEdition: async () => { calls.push('all'); return chapters },
      fetchPublishedChaptersByEdition: async () => { calls.push('published'); return chapters.filter(chapter => chapter.status === 'published') },
    },
    '@/lib/server/session': { getCurrentUser: async () => user, getSystemRoles: async () => ['editor'] },
    '@/lib/server/chapter-highlights': { canManageChapterEditorialNotes: async () => false, fetchChapterHighlights: async () => [] },
    '@/lib/server/reading-progress': { fetchReadingProgress: async () => null },
    '@/lib/server/series': { fetchSeriesById: async () => null },
    '@/components/vvvvv/reader-preview-notice': { ReaderPreviewNotice: 'preview-notice' },
    '@/components/spread-reader': { SpreadReader: 'spread-reader' },
    '@/components/release-comic-reader': { ReleaseComicReader: 'comic-reader' },
    '@/components/release-audio-player': { ReleaseAudioPlayer: 'audio-reader' },
    '@/components/artwork-viewer': { ArtworkViewer: 'artwork-viewer' },
    '@/components/seo/json-ld': { JsonLd: 'json-ld' },
    '@/components/breadcrumbs': { Breadcrumbs: component },
    '@/lib/seo/schema': { generateEditionSchema: () => ({}) },
    '@/lib/seo/metadata': { buildMetadata: () => ({ title: 'Public metadata' }), notFoundMetadata: () => ({ title: 'Not found' }), stripHtml: () => '' },
    '@/lib/utils/editions': { computeEditionMeta: () => ({}), EDITION_FORMAT_LABELS: {}, isAudioFormat: () => false },
  }
  const source = readFileSync(resolve('app/vvvvv/[slug]/page.tsx'), 'utf8')
  const compiled = ts.transpileModule(source, { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.ReactJSX,
  } }).outputText
  const exports: { default?: (props: typeof params) => Promise<ReactNode>; generateMetadata?: (props: typeof params) => Promise<Metadata> } = {}
  runInNewContext(compiled, { exports, require: (id: string) => modules[id] ?? nativeRequire(id) })
  return { page: () => exports.default!(params), metadata: () => exports.generateMetadata!(params), calls }
}

function findElement(node: ReactNode, type: string): Record<string, unknown> | null {
  for (const child of Children.toArray(node)) {
    if (!isValidElement<{ children?: ReactNode }>(child)) continue
    if (child.type === type) return child.props
    const nested = findElement(child.props.children, type)
    if (nested) return nested
  }
  return null
}

test.describe('VVVVV admin preview access', () => {
  for (const signedIn of [false, true]) {
    for (const field of ['editionStatus', 'releaseStatus'] as const) {
      for (const status of ['draft', 'archived']) {
        test(`${signedIn ? 'non-admin author/editor' : 'guest'} cannot read ${field}=${status}`, async () => {
          const app = readerHarness({ signedIn, [field]: status })
          await rejects(app.page(), /404/)
          expect(app.calls).toEqual([])
          expect((await app.metadata()).title).toBe('Not found')
        })
      }
    }
    test(`${signedIn ? 'non-admin' : 'guest'} only receives published chapters`, async () => {
      const app = readerHarness({ signedIn })
      const page = await app.page()
      const reader = findElement(page, 'spread-reader')!
      expect(reader.chapters).toEqual([expect.objectContaining({ id: 'published' })])
      expect(reader.previewNotice).toBeNull()
      expect(app.calls).toEqual(['published'])
    })
  }

  for (const editionStatus of ['draft', 'published', 'archived']) {
    for (const releaseStatus of ['draft', 'published', 'archived']) {
      test(`admin reads ${releaseStatus}/${editionStatus} and every chapter with notice`, async () => {
        const app = readerHarness({ admin: true, editionStatus, releaseStatus })
        const page = await app.page()
        const reader = findElement(page, 'spread-reader') as unknown as SpreadReaderProps
        expect(reader.chapters).toHaveLength(2)
        expect(findElement(reader.previewNotice, 'preview-notice')).toEqual({ releaseStatus, editionStatus, unpublishedChapterCount: 1 })
        expect(app.calls).toEqual(['all'])
        expect(findElement(page, 'json-ld')).toBeNull()
      })
    }
  }

  for (const format of ['comic', 'audiobook', 'audiorelease', 'album', 'artwork']) {
    test(`admin preview mark also appears for ${format}`, async () => {
      const page = await readerHarness({ admin: true, editionStatus: 'draft', format }).page()
      expect(findElement(page, 'preview-notice')).toMatchObject({ editionStatus: 'draft' })
      expect(findElement(page, 'json-ld')).toBeNull()
    })
  }

  test('empty draft has a preview notice instead of 404', async () => {
    const page = await readerHarness({ admin: true, editionStatus: 'draft', empty: true }).page()
    expect(findElement(page, 'preview-notice')).not.toBeNull()
    expect(findElement(page, 'p')?.children).toBe('В этом издании пока нет глав.')
  })

  test('private metadata has no title or description from the manuscript', async () => {
    const metadata = await readerHarness({ admin: true, editionStatus: 'draft' }).metadata()
    expect(metadata.title).toBe('Предпросмотр администратора | canfly')
    expect(metadata.description).toBeUndefined()
    expect(metadata.robots).toEqual({ index: false, follow: false })
  })

  for (const missing of ['edition', 'release'] as const) {
    test(`admin still receives 404 for missing ${missing}`, async () => {
      await rejects(readerHarness({ admin: true, missing }).page(), /404/)
    })
  }
})
