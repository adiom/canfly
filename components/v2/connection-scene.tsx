import type { V2Graph } from '@/lib/server/v2'
import { GraphTextAlternative } from './graph-text-alternative'
import { GraphVisual } from './graph-visual'
import { ConnectionGraphLoader } from './lazy-scenes'
import { SceneReveal } from './scene-reveal'
import styles from './v2.module.css'

/**
 * Сцена 04 — карта связей.
 *
 * Узлы и рёбра — только реальные данные из `lib/server/v2.ts`: связи
 * персонажей, состав релизов, серии и места. Вся схема продублирована
 * текстовым списком в `details` ниже — доступна без JS и со скринридеров.
 */
interface ConnectionSceneProps {
  graph: V2Graph
}

export function ConnectionScene({ graph }: ConnectionSceneProps) {
  if (graph.nodes.length === 0) return null

  return (
    <section className={`${styles.shell} ${styles.network}`} id="connections">
      <div className={styles.sectionHead}>
        <small className={styles.sectionHeadSmall}>03 / A living constellation</small>
        <small className={styles.sectionHeadSmall}>Touch the nodes</small>
      </div>

      <SceneReveal>
        <h2 className={styles.peopleLead}>
          У историй есть <i className={styles.peopleLeadI}>невидимые нити.</i>
        </h2>
        <p className={styles.networkDesc}>
          Это не карта случайных рекомендаций. Релизы и персонажи соединяются
          через свои истории. Нажми на точку, чтобы исследовать фрагмент
          вселенной.
        </p>
      </SceneReveal>

      <SceneReveal>
        <ConnectionGraphLoader graph={graph} fallback={<GraphVisual graph={graph} />} />
        <GraphTextAlternative graph={graph} />
      </SceneReveal>
    </section>
  )
}
