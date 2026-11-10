'use client'

import { useEffect, useRef, type ReactNode } from 'react'

import styles from './v2.module.css'

interface SceneRevealProps {
  children: ReactNode
  className?: string
}

/**
 * Отложенное появление блока сцены.
 *
 * Серверный HTML всегда видим. После гидратации скрываем только блоки,
 * которые ещё не вошли в экран: первый экран не мигает, а отсутствие JS
 * или навигация через App Router не оставляют скрытых сцен.
 */
export function SceneReveal({ children, className }: SceneRevealProps) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const node = ref.current
    if (!node) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')
    const rect = node.getBoundingClientRect()
    if (motion.matches || (rect.top < window.innerHeight && rect.bottom > 0)) return
    if (!('IntersectionObserver' in window)) return

    node.dataset.v2Reveal = 'pending'
    const show = () => {
      delete node.dataset.v2Reveal
      observer.disconnect()
    }
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            show()
          }
        }
      },
      { threshold: 0.11 },
    )
    observer.observe(node)
    const onMotionChange = () => {
      if (motion.matches) show()
    }
    node.addEventListener('focusin', show)
    motion.addEventListener('change', onMotionChange)
    return () => {
      observer.disconnect()
      node.removeEventListener('focusin', show)
      motion.removeEventListener('change', onMotionChange)
      delete node.dataset.v2Reveal
    }
  }, [])

  const classes = [styles.reveal, className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <div ref={ref} className={classes}>
      {children}
    </div>
  )
}
