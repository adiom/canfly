'use client'

import dynamic from 'next/dynamic'
import { lazy, Suspense, useEffect, useRef, useState, type ReactNode } from 'react'

import type { V2Graph, V2MediaRelease } from '@/lib/server/v2'

const ConnectionGraph = lazy(() =>
  import('./connection-graph').then((module) => ({ default: module.ConnectionGraph })),
)
const MultimediaScene = lazy(() =>
  import('./multimedia-scene').then((module) => ({ default: module.MultimediaScene })),
)
const ParticleField = dynamic(
  () => import('./particle-field').then((module) => module.ParticleField),
  { ssr: false },
)

/** Код интерактивной сцены загружается при приближении к экрану, не на сервере. */
function useNearViewport() {
  const ref = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return
    if (!('IntersectionObserver' in window)) {
      const frame = requestAnimationFrame(() => setReady(true))
      return () => cancelAnimationFrame(frame)
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setReady(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px 0px' },
    )
    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return { ref, ready }
}

export function V2Atmosphere() {
  return <ParticleField />
}

export function ConnectionGraphLoader({ graph, fallback }: { graph: V2Graph; fallback: ReactNode }) {
  const { ref, ready } = useNearViewport()
  return (
    <div ref={ref}>
      <Suspense fallback={fallback}>
        {ready ? <ConnectionGraph graph={graph} /> : fallback}
      </Suspense>
    </div>
  )
}

export function MultimediaSceneLoader({ media, fallback }: { media: V2MediaRelease; fallback: ReactNode }) {
  const { ref, ready } = useNearViewport()
  return (
    <div ref={ref}>
      <Suspense fallback={fallback}>
        {ready ? <MultimediaScene media={media} /> : fallback}
      </Suspense>
    </div>
  )
}
