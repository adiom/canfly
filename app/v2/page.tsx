import type { Metadata } from 'next'

import { ArtHero } from '@/components/v2/art-hero'
import { CharacterScene } from '@/components/v2/character-scene'
import { ConnectionScene } from '@/components/v2/connection-scene'
import { ExploreScene } from '@/components/v2/explore-scene'
import { V2Atmosphere } from '@/components/v2/lazy-scenes'
import { MediaScene } from '@/components/v2/media-scene'
import { ReleaseScene } from '@/components/v2/release-scene'
import { StatementSection } from '@/components/v2/statement-section'
import { V2Footer } from '@/components/v2/v2-footer'
import { V2Header } from '@/components/v2/v2-header'
import { Journal } from '@/components/v2/journal'
import styles from '@/components/v2/v2.module.css'
import { getV2PageData } from '@/lib/server/v2'
import { getV2FeedPage } from '@/lib/server/v2-feed'
import { buildMetadata } from '@/lib/seo/metadata'

/**
 * Художественная главная `/v2`.
 *
 * Отдельная публичная сцена с реальными данными БД. Текущая главная `/`,
 * глобальная навигация и sitemap не меняются; до утверждения страница
 * закрыта от индексации (`noindex, nofollow`), а ISR обновляет контент
 * по запросу после истечения минуты, без ручного обновления.
 */

export const revalidate = 60

const baseMetadata = buildMetadata({
  title: 'canfly — The Media Dimension',
  description:
    'Художественная главная canfly: релизы, персонажи, невидимые связи и разные формы одной истории — как единая медиа-вселенная.',
  path: '/v2',
})

/**
 * `buildMetadata` при `noindex` ставит `follow: true`; экспериментальная
 * страница закрыта полностью — до решения о публикации не должна отдавать
 * ссылки поисковому роботу.
 */
export const metadata: Metadata = {
  ...baseMetadata,
  robots: { index: false, follow: false },
}

export default async function V2Page() {
  const [data, feed] = await Promise.all([getV2PageData(), getV2FeedPage()])
  const sections = {
    releases: Boolean(data.featured),
    characters: data.characters.length > 0,
    connections: data.graph.nodes.length > 0,
    media: Boolean(data.media),
  }

  return (
    <div className={styles.page}>
      <V2Atmosphere />
      <V2Header sections={sections} />

      <main>
        <ArtHero hasFeatured={sections.releases} hasGraph={sections.connections} hasFeed />
        <Journal initialPage={feed} />
        <StatementSection />
        {data.featured ? <ReleaseScene release={data.featured} /> : null}
        <CharacterScene characters={data.characters} />
        <ConnectionScene graph={data.graph} />
        <MediaScene media={data.media} />
        <ExploreScene items={data.explore} />
      </main>

      <V2Footer />
    </div>
  )
}
