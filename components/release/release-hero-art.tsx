'use client'

import { useEffect, useRef, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import type { ReleaseHeroArtMode } from '@/lib/release-design'
import styles from './release.module.css'

const SCENE_WIDTH = 600
const SCENE_HEIGHT = 480
const CURVES = Array.from({ length: 24 }, (_, index) => {
  const offset = index * 13
  return {
    start: 42 + offset,
    first: 208 + offset / 4,
    second: 435 - offset,
    middle: 224 - offset / 3,
    third: 8 + offset,
    end: 162 + offset,
  }
})

function CanvasField() {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    const context = canvas?.getContext('2d')
    if (!canvas || !context) return

    const draw = () => {
      const width = canvas.clientWidth
      const height = canvas.clientHeight
      if (!width || !height) return

      const density = Math.min(window.devicePixelRatio || 1, 2)
      const scale = Math.max(width / SCENE_WIDTH, height / SCENE_HEIGHT)
      canvas.width = Math.round(width * density)
      canvas.height = Math.round(height * density)
      context.setTransform(
        scale * density, 0, 0, scale * density,
        (width - SCENE_WIDTH * scale) * density / 2,
        (height - SCENE_HEIGHT * scale) * density / 2,
      )
      context.strokeStyle = getComputedStyle(canvas).color
      context.lineWidth = 1 / scale
      context.beginPath()
      for (const curve of CURVES) {
        context.moveTo(-30, curve.start)
        context.bezierCurveTo(122, curve.first, 230, curve.second, 358, curve.middle)
        context.bezierCurveTo(486, 2 * curve.middle - curve.second, 552, curve.third, 650, curve.end)
      }
      context.stroke()
    }

    draw()
    const resize = new ResizeObserver(draw)
    resize.observe(canvas)
    return () => resize.disconnect()
  }, [])

  return <canvas ref={ref} />
}

export function ReleaseHeroArt({ mode, interactive = true }: {
  mode: Exclude<ReleaseHeroArtMode, 'none'>
  interactive?: boolean
}) {
  const field = useRef<HTMLDivElement>(null)
  const animation = useRef<Animation | null>(null)
  const [playing, setPlaying] = useState(false)

  useEffect(() => {
    if (!interactive) return

    const preference = window.matchMedia('(prefers-reduced-motion: reduce)')
    function stopForReducedMotion() {
      if (!preference.matches) return
      animation.current?.cancel()
      animation.current = null
      setPlaying(false)
    }

    preference.addEventListener('change', stopForReducedMotion)
    return () => {
      preference.removeEventListener('change', stopForReducedMotion)
      animation.current?.cancel()
      animation.current = null
    }
  }, [interactive])

  function toggleMotion() {
    const element = field.current
    if (!element?.animate || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    if (playing) {
      animation.current?.pause()
    } else if (animation.current) {
      animation.current.play()
    } else {
      animation.current = element.animate(
        [{ transform: 'scale(1)' }, { transform: 'rotate(7deg) scale(1.16)' }],
        { duration: 12000, iterations: Infinity, direction: 'alternate', easing: 'ease-in-out' },
      )
    }
    setPlaying(!playing)
  }

  return (
    <>
      <div className={styles.artLayer} aria-hidden="true" data-release-art={mode}>
        <div ref={field} className={styles.artField}>
          {mode === 'canvas' ? <CanvasField /> : (
            <svg viewBox={`0 0 ${SCENE_WIDTH} ${SCENE_HEIGHT}`} preserveAspectRatio="xMidYMid slice" fill="none" stroke="currentColor">
              {CURVES.map(curve => (
                <path
                  key={curve.start}
                  d={`M -30 ${curve.start} C 122 ${curve.first} 230 ${curve.second} 358 ${curve.middle} S 552 ${curve.third} 650 ${curve.end}`}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          )}
        </div>
      </div>
      {interactive ? (
        <button
          type="button"
          className={styles.motionButton}
          aria-label={playing ? 'Приостановить анимацию' : 'Запустить анимацию'}
          onClick={toggleMotion}
        >
          {playing ? <Pause size={15} aria-hidden="true" /> : <Play size={15} aria-hidden="true" />}
        </button>
      ) : null}
    </>
  )
}
