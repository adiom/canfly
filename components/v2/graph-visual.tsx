import Link from 'next/link'
import type { CSSProperties, ReactNode } from 'react'

import type { V2Graph } from '@/lib/server/v2'
import { GRAPH_HEIGHT, GRAPH_KIND_LABELS, GRAPH_WIDTH, LABEL_FLIP_RATIO, graphPosition } from './graph-layout'
import styles from './v2.module.css'

interface GraphVisualProps {
  graph: V2Graph
  selectedId?: string | null
  onSelectNode?: (id: string, trigger: HTMLButtonElement) => void
  children?: ReactNode
}

/** Общая геометрия для серверного fallback и интерактивной карты. */
export function GraphVisual({ graph, selectedId = null, onSelectNode, children }: GraphVisualProps) {
  const edges = (mobile: boolean) => graph.edges.map((edge) => {
    const from = graphPosition(edge.from, mobile)
    const to = graphPosition(edge.to, mobile)
    const active = selectedId === edge.from || selectedId === edge.to
    return (
      <line
        key={`${edge.kind}:${edge.from}:${edge.to}`}
        x1={from.x}
        y1={from.y}
        x2={to.x}
        y2={to.y}
        className={`${styles.edge} ${active ? styles.edgeActive : ''}`}
        vectorEffect="non-scaling-stroke"
      />
    )
  })

  return (
    <div className={styles.graphStage}>
      <svg className={styles.graphSvg} viewBox={`0 0 ${GRAPH_WIDTH} ${GRAPH_HEIGHT}`} preserveAspectRatio="none" aria-hidden="true">
        <g className={styles.graphDesktopEdges}>{edges(false)}</g>
        <g className={styles.graphMobileEdges}>{edges(true)}</g>
      </svg>

      {graph.nodes.map((node) => {
        const position = graphPosition(node.id)
        const mobile = graphPosition(node.id, true)
        const classes = [
          styles.node,
          node.kind === 'release' ? styles.nodeRelease : '',
          node.kind === 'place' ? styles.nodePlace : '',
          node.kind === 'series' ? styles.nodeSeries : '',
          position.x / GRAPH_WIDTH >= LABEL_FLIP_RATIO ? styles.nodeEnd : '',
          mobile.x / GRAPH_WIDTH >= LABEL_FLIP_RATIO ? styles.nodeMobileEnd : '',
          selectedId === node.id ? styles.nodeSelected : '',
        ].filter(Boolean).join(' ')
        const positionStyle = {
          '--v2-node-x': `${position.x / GRAPH_WIDTH * 100}%`,
          '--v2-node-y': `${position.y / GRAPH_HEIGHT * 100}%`,
          '--v2-node-mobile-x': `${mobile.x / GRAPH_WIDTH * 100}%`,
          '--v2-node-mobile-y': `${mobile.y / GRAPH_HEIGHT * 100}%`,
        } as CSSProperties
        const label = (
          <>
            <span className={styles.nodeMarker} aria-hidden="true"><span className={styles.nodeDot} /></span>
            <span>
              <span className={styles.nodeLabel}>{node.title}</span>
              <span className={styles.nodeKind}>{GRAPH_KIND_LABELS[node.kind]}</span>
            </span>
          </>
        )

        return onSelectNode ? (
          <button
            key={node.id}
            type="button"
            className={classes}
            style={positionStyle}
            aria-pressed={selectedId === node.id}
            aria-controls={selectedId === node.id ? 'v2-graph-detail' : undefined}
            onClick={(event) => onSelectNode(node.id, event.currentTarget)}
          >{label}</button>
        ) : (
          <Link key={node.id} href={node.href} className={classes} style={positionStyle}>{label}</Link>
        )
      })}

      <p className={styles.graphAnnotation}>CANFLY / RELATIONSHIP STUDY</p>
      {children}
    </div>
  )
}
