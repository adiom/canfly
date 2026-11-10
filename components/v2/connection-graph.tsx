'use client'

import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'

import type { V2Graph } from '@/lib/server/v2'
import { GRAPH_KIND_LABELS } from './graph-layout'
import { GraphVisual } from './graph-visual'
import styles from './v2.module.css'

/** Клиент добавляет только выбор узла, подсветку и описание. */
export function ConnectionGraph({ graph }: { graph: V2Graph }) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const triggerRef = useRef<HTMLButtonElement | null>(null)
  const selectedNode = graph.nodes.find((node) => node.id === selectedId)
  const close = useCallback(() => {
    setSelectedId(null)
    triggerRef.current?.focus()
  }, [])

  useEffect(() => {
    if (!selectedId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [selectedId, close])

  return (
    <GraphVisual
      graph={graph}
      selectedId={selectedId}
      onSelectNode={(id, trigger) => {
        triggerRef.current = trigger
        setSelectedId((current) => current === id ? null : id)
      }}
    >
      {selectedNode ? (
        <aside className={`${styles.detail} ${styles.detailShow}`} id="v2-graph-detail" aria-labelledby="v2-graph-detail-title" aria-live="polite">
          <button type="button" className={styles.detailClose} aria-label="Закрыть описание" onClick={close}>×</button>
          <span className={styles.eyebrow}>{GRAPH_KIND_LABELS[selectedNode.kind]}</span>
          <h3 className={styles.detailTitle} id="v2-graph-detail-title">{selectedNode.title}</h3>
          {selectedNode.description ? <p className={styles.detailText}>{selectedNode.description}</p> : null}
          <Link href={selectedNode.href} className={styles.detailLink}>Открыть на Canfly ↗</Link>
        </aside>
      ) : null}
    </GraphVisual>
  )
}
