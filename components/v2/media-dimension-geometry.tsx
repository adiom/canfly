'use client'

import { useEffect, useRef } from 'react'

import styles from './v2.module.css'

/**
 * Геометрия первого экрана: сфера, две орбиты и призма.
 *
 * SVG рендерится на сервере как есть; клиент добавляет только мягкую
 * реакцию слоя на указатель. При `prefers-reduced-motion` смещение не
 * считается, анимации орбит выключает CSS.
 */
export function MediaDimensionGeometry() {
  const layerRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let rafId = 0
    const onPointerMove = (event: PointerEvent) => {
      const bounds = layer.getBoundingClientRect()
      if (motion.matches || document.hidden || bounds.bottom <= 0 || bounds.top >= window.innerHeight) return
      const nx = event.clientX / window.innerWidth - 0.5
      const ny = event.clientY / window.innerHeight - 0.5
      cancelAnimationFrame(rafId)
      rafId = requestAnimationFrame(() => {
        layer.style.transform = `translate3d(${(nx * -26).toFixed(2)}px, ${(ny * -18).toFixed(2)}px, 0)`
      })
    }
    const onPointerLeave = () => {
      cancelAnimationFrame(rafId)
      layer.style.transform = ''
    }
    const onMotionChange = () => {
      if (motion.matches) onPointerLeave()
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    motion.addEventListener('change', onMotionChange)
    return () => {
      cancelAnimationFrame(rafId)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      motion.removeEventListener('change', onMotionChange)
      layer.style.transform = ''
    }
  }, [])

  return (
    <svg
      ref={layerRef}
      className={`${styles.heroArtSvg} ${styles.pointerLayer}`}
      viewBox="0 0 700 700"
      aria-hidden="true"
    >
      <defs>
        <radialGradient id="v2-sphere" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--v2-fg)" stopOpacity="0.16" />
          <stop offset="38%" stopColor="var(--v2-warm)" stopOpacity="0.07" />
          <stop offset="100%" stopColor="var(--v2-fg)" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="v2-prism" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="var(--v2-fg)" stopOpacity="0.7" />
          <stop offset="50%" stopColor="var(--v2-warm)" stopOpacity="0.06" />
          <stop offset="100%" stopColor="var(--v2-fg)" stopOpacity="0.3" />
        </linearGradient>
      </defs>
      <circle cx="350" cy="350" r="320" fill="url(#v2-sphere)" />
      <g className={styles.orbital}>
        <ellipse
          cx="350"
          cy="350"
          rx="302"
          ry="135"
          transform="rotate(-29 350 350)"
          fill="none"
          stroke="var(--v2-fg)"
          strokeOpacity="0.28"
          strokeWidth="0.8"
        />
        <circle cx="604" cy="186" r="5" fill="var(--v2-fg)" fillOpacity="0.7" />
      </g>
      <g className={`${styles.orbital} ${styles.orbitalReverse}`}>
        <ellipse
          cx="350"
          cy="350"
          rx="300"
          ry="114"
          transform="rotate(63 350 350)"
          fill="none"
          stroke="var(--v2-blue)"
          strokeOpacity="0.34"
          strokeWidth="0.8"
        />
        <circle cx="140" cy="138" r="3.5" fill="var(--v2-blue)" fillOpacity="0.75" />
      </g>
      <g className={styles.prism}>
        <path
          d="M350 105 L550 473 L145 474 Z"
          fill="var(--v2-bg)"
          stroke="url(#v2-prism)"
          strokeWidth="2.2"
        />
        <path
          d="M350 105 L350 474 M145 474 L445 279 M550 473 L250 280"
          fill="none"
          stroke="var(--v2-fg)"
          strokeOpacity="0.18"
        />
        <circle
          cx="350"
          cy="349"
          r="46"
          fill="none"
          stroke="var(--v2-warm)"
          strokeOpacity="0.45"
        />
        <circle cx="350" cy="349" r="4" fill="var(--v2-warm)" />
      </g>
    </svg>
  )
}
