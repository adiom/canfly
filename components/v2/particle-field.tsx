'use client'

import { useEffect, useRef } from 'react'

import styles from './v2.module.css'

interface DustParticle {
  x: number
  y: number
  r: number
  v: number
  phase: number
}

/**
 * Атмосферная пыль поверх страницы: декоративный canvas без зависимостей.
 *
 * Движение считается в `requestAnimationFrame` и останавливается, когда
 * вкладка скрыта или секция ушла из вида; при `prefers-reduced-motion`
 * анимация не запускается вовсе. DPR и размеры пересчитываются на resize,
 * обработчики снимаются при размонтировании.
 */
export function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) return
    const motion = window.matchMedia('(prefers-reduced-motion: reduce)')

    let width = 0
    let height = 0
    let dpr = 1
    let particles: DustParticle[] = []
    let frame = 0
    let rafId = 0
    let pageVisible = !document.hidden
    let inView = true
    let color = ''
    let litColor = ''
    const pointer = { x: -1000, y: -1000 }

    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2)
      width = window.innerWidth
      height = window.innerHeight
      canvas.width = Math.round(width * dpr)
      canvas.height = Math.round(height * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      const count = Math.min(100, Math.round((width * height) / 14500))
      particles = Array.from({ length: count }, (_, i) => ({
        x: ((i * 73.17) % 1) * width,
        y: ((i * 51.77) % 1) * height,
        r: 0.4 + (i % 4) * 0.28,
        v: 0.1 + (i % 3) * 0.055,
        phase: i * 0.47,
      }))
    }

    const paint = () => {
      ctx.clearRect(0, 0, width, height)
      for (const particle of particles) {
        const x = particle.x + Math.sin(frame * 0.004 + particle.phase) * 7
        const y = (particle.y + frame * particle.v) % height
        const distance = Math.hypot(x - pointer.x, y - pointer.y)
        ctx.beginPath()
        ctx.arc(x, y, particle.r + (distance < 150 ? 0.5 : 0), 0, Math.PI * 2)
        ctx.fillStyle = distance < 190 ? litColor : color
        ctx.globalAlpha = distance < 190 ? 0.55 : 0.28
        ctx.fill()
      }
      ctx.globalAlpha = 1
    }

    const shouldAnimate = () => pageVisible && inView && !motion.matches
    const stop = () => {
      cancelAnimationFrame(rafId)
      rafId = 0
    }
    const draw = () => {
      rafId = 0
      if (!shouldAnimate()) return
      // Каждый второй кадр — пыль движется спокойно и экономит CPU.
      if (++frame % 2 === 0) paint()
      rafId = requestAnimationFrame(draw)
    }
    const updatePlayback = () => {
      if (!shouldAnimate()) {
        stop()
        if (pageVisible && inView) paint()
      } else if (!rafId) {
        rafId = requestAnimationFrame(draw)
      }
    }
    const updateColors = () => {
      const style = getComputedStyle(canvas)
      color = style.getPropertyValue('--v2-particle').trim()
      litColor = style.getPropertyValue('--v2-particle-lit').trim()
      paint()
    }
    const onResize = () => {
      resize()
      paint()
    }

    const onPointerMove = (event: PointerEvent) => {
      pointer.x = event.clientX
      pointer.y = event.clientY
    }
    const onPointerLeave = () => {
      pointer.x = -1000
      pointer.y = -1000
    }
    const onVisibilityChange = () => {
      pageVisible = !document.hidden
      updatePlayback()
    }

    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        inView = entry.isIntersecting
      }
      updatePlayback()
    })
    const themeObserver = new MutationObserver(updateColors)

    resize()
    updateColors()
    observer.observe(canvas)
    themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    window.addEventListener('resize', onResize, { passive: true })
    window.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerleave', onPointerLeave)
    document.addEventListener('visibilitychange', onVisibilityChange)
    motion.addEventListener('change', updatePlayback)
    updatePlayback()

    return () => {
      stop()
      observer.disconnect()
      themeObserver.disconnect()
      window.removeEventListener('resize', onResize)
      window.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerleave', onPointerLeave)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      motion.removeEventListener('change', updatePlayback)
      ctx.clearRect(0, 0, width, height)
    }
  }, [])

  return <canvas ref={canvasRef} className={styles.dust} aria-hidden="true" />
}
