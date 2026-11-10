import Link from 'next/link'

import type { V2Graph } from '@/lib/server/v2'
import { GRAPH_EDGE_LABELS } from './graph-layout'
import styles from './v2.module.css'

/** Постоянная серверная альтернатива: раскрытие не сбрасывается при lazy-load. */
export function GraphTextAlternative({ graph }: { graph: V2Graph }) {
  const nodesById = new Map(graph.nodes.map((node) => [node.id, node]))
  return (
    <details className={styles.graphAlt}>
      <summary className={styles.graphAltSummary}>Текстовая схема связей</summary>
      <ul className={styles.graphAltList}>
        {graph.edges.map((edge) => {
          const from = nodesById.get(edge.from)
          const to = nodesById.get(edge.to)
          if (!from || !to) return null
          return (
            <li key={`${edge.kind}:${edge.from}:${edge.to}`} className={styles.graphAltItem}>
              <span className={styles.graphAltKind}>{GRAPH_EDGE_LABELS[edge.kind]}</span>
              <Link href={from.href}>{from.title}</Link> — {edge.label} —{' '}
              <Link href={to.href}>{to.title}</Link>
            </li>
          )
        })}
      </ul>
    </details>
  )
}
