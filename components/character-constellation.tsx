'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'

import type { ConstellationNode } from '@/lib/character-constellation'

const GOLDEN_ANGLE = 2.39996323
const RING_RADII = [30, 43, 56]

interface CharacterConstellationProps {
  name: string
  avatar: string | null
  nodes: ConstellationNode[]
}

/**
 * Расширенный орбитальный портрет: вокруг героя дрейфуют не только связи,
 * но и релизы и рассказы (посты). Каждый узел соединён с центром мягкой
 * нитью — это и есть «покажем через связь»: чем ближе узел к герою, тем
 * плотнее нить. Hover на узле поднимает карточку и подсвечивает нить.
 *
 * Идея заимствована из `orbital/components/profile/gravitational-field.tsx`
 * и переведена на canfly-токены (`cf-air-*`, `cf-orbit-drift`, `cf-star-breathe`).
 * Не интерактивный граф — портрет вселенной вокруг персонажа.
 */
export function CharacterConstellation({
  name,
  avatar,
  nodes,
}: CharacterConstellationProps) {
  const [activeId, setActiveId] = useState<string | null>(null)

  const placed = useMemo(() => {
    return nodes.map((node, i) => {
      const ring = i % RING_RADII.length
      // Вес тянет ближе к центру: главные герои на внутреннем кольце.
      const radius = RING_RADII[ring] + (1 - node.weight) * 6
      const angle = i * GOLDEN_ANGLE
      const x = 50 + Math.cos(angle) * radius
      const y = 50 + Math.sin(angle) * radius
      const size = 6 + node.weight * 10
      return { node, x, y, size, index: i }
    })
  }, [nodes])

  if (placed.length === 0) {
    // Без узлов нет смысла рисовать поле — пусть будет простой портрет.
    return <SimplePortrait name={name} avatar={avatar} />
  }

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[460px]">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
        <title>Орбитальное поле персонажа</title>
        {/* Слабые орбиты — фон, не сетка */}
        {RING_RADII.map((r) => (
          <circle
            key={r}
            cx="50"
            cy="50"
            r={r}
            fill="none"
            stroke="var(--cf-air-line)"
            strokeWidth="0.15"
          />
        ))}
        {/* Нити от центра к каждому узлу. Релизы — главные нити поля:
            толще и ярче, чем к постам/связям. */}
        {placed.map(({ node, x, y }) => {
          const isActive = activeId === node.id
          const isRelease = node.kind === 'release'
          const baseWidth = isRelease ? 0.55 : 0.18
          const baseOpacity = isRelease ? 0.55 : 0.18
          return (
            <line
              key={`thread-${node.id}`}
              x1="50"
              y1="50"
              x2={x}
              y2={y}
              stroke="var(--cf-air-accent)"
              strokeWidth={
                isActive ? 0.6 : baseWidth + node.weight * (isRelease ? 0.25 : 0.15)
              }
              strokeOpacity={isActive ? 0.9 : baseOpacity + node.weight * (isRelease ? 0.3 : 0.2)}
              strokeLinecap="round"
              style={{
                transition: 'stroke-opacity 220ms ease-out, stroke-width 220ms ease-out',
              }}
            />
          )
        })}
        {/* Мягкое свечение вокруг центра */}
        <defs>
          <radialGradient id="cf-constellation-glow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="var(--cf-bg)" stopOpacity="0.9" />
            <stop offset="55%" stopColor="var(--cf-air-accent)" stopOpacity="0.18" />
            <stop offset="100%" stopColor="var(--cf-air-accent)" stopOpacity="0" />
          </radialGradient>
        </defs>
        <circle cx="50" cy="50" r="14" fill="url(#cf-constellation-glow)" />
      </svg>

      {/* Узлы */}
      {placed.map(({ node, x, y, size, index }) => (
        <NodeAnchor
          key={node.id}
          node={node}
          left={`${x}%`}
          top={`${y}%`}
          size={size}
          index={index}
          active={activeId === node.id}
          onActivate={() => setActiveId(node.id)}
          onLeave={() => setActiveId((current) => (current === node.id ? null : current))}
        />
      ))}

      {/* Центральная звезда */}
      <div className="cf-star absolute left-1/2 top-1/2 z-10 flex h-[104px] w-[104px] -translate-x-1/2 -translate-y-1/2 items-center justify-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--cf-bg) 92%, transparent) 0%, color-mix(in srgb, var(--cf-air-accent) 32%, transparent) 55%, transparent 72%)',
            transform: 'scale(2.2)',
          }}
        />
        <div className="relative h-[104px] w-[104px] overflow-hidden rounded-full bg-cf-air-surface-2 ring-1 ring-cf-air-line shadow-[0_18px_60px_rgba(26,24,22,0.18)]">
          {avatar ? (
            <Image
              src={avatar}
              alt={name}
              width={104}
              height={104}
              priority
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-2xl font-light text-cf-text-3">
              {name.trim()[0] ?? '·'}
            </div>
          )}
        </div>
      </div>

      {/* Карточка активного узла */}
      {activeId ? (
        <NodeCard
          node={nodes.find((n) => n.id === activeId)!}
          onClose={() => setActiveId(null)}
        />
      ) : null}
    </div>
  )
}

function NodeAnchor({
  node,
  left,
  top,
  size,
  index,
  active,
  onActivate,
  onLeave,
}: {
  node: ConstellationNode
  left: string
  top: string
  size: number
  index: number
  active: boolean
  onActivate: () => void
  onLeave: () => void
}) {
  const duration = `${14 + (index % 5) * 3}s`
  const delay = `${-(index % 7) * 1.6}s`
  const color = accentFor(node)

  return (
    <Link
      href={node.href}
      aria-label={node.title}
      onMouseEnter={onActivate}
      onMouseLeave={onLeave}
      onFocus={onActivate}
      onBlur={onLeave}
      className="cf-orbit-dot absolute rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cf-air-accent"
      style={{
        left,
        top,
        width: size,
        height: size,
        marginLeft: -size / 2,
        marginTop: -size / 2,
        background: color,
        boxShadow: `0 0 ${size * 1.8}px ${color}`,
        animationDuration: duration,
        animationDelay: delay,
        transform: active ? 'scale(1.25)' : 'scale(1)',
        transition: 'transform 220ms ease-out',
      }}
    />
  )
}

function NodeCard({
  node,
  onClose,
}: {
  node: ConstellationNode
  onClose: () => void
}) {
  void onClose
  return (
    <div className="cf-glass pointer-events-none absolute left-1/2 top-[78%] z-20 w-[280px] -translate-x-1/2 rounded-2xl px-4 py-3 text-center">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cf-air-accent-ink">
        {kindLabel(node)}
      </p>
      <p className="mt-1 truncate text-[14px] font-medium text-cf-text-heading">
        {node.title}
      </p>
      {node.kind === 'post' ? (
        <p className="mt-1 line-clamp-2 text-[12px] text-cf-text-caption">
          {node.excerpt}
        </p>
      ) : null}
      {node.kind === 'relation' && node.subtitle ? (
        <p className="mt-1 text-[12px] text-cf-text-caption">{node.subtitle}</p>
      ) : null}
    </div>
  )
}

function SimplePortrait({ name, avatar }: { name: string; avatar: string | null }) {
  return (
    <div className="cf-star relative mx-auto flex h-[104px] w-[104px] items-center justify-center">
      <div
        aria-hidden
        className="absolute inset-0 rounded-full blur-2xl"
        style={{
          background:
            'radial-gradient(circle, color-mix(in srgb, var(--cf-bg) 92%, transparent) 0%, color-mix(in srgb, var(--cf-air-accent) 32%, transparent) 55%, transparent 72%)',
          transform: 'scale(2.2)',
        }}
      />
      <div className="relative h-[104px] w-[104px] overflow-hidden rounded-full bg-cf-air-surface-2 ring-1 ring-cf-air-line shadow-[0_18px_60px_rgba(26,24,22,0.18)]">
        {avatar ? (
          <Image src={avatar} alt={name} width={104} height={104} priority className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-2xl font-light text-cf-text-3">
            {name.trim()[0] ?? '·'}
          </div>
        )}
      </div>
    </div>
  )
}

function kindLabel(node: ConstellationNode): string {
  if (node.kind === 'release') {
    return node.role === 'main' ? 'главный герой · релиз' : 'участие · релиз'
  }
  if (node.kind === 'relation') return 'связь'
  return 'рассказ'
}

function accentFor(node: ConstellationNode): string {
  if (node.kind === 'release') {
    return node.role === 'main' ? 'var(--cf-air-accent)' : 'var(--cf-air-line)'
  }
  if (node.kind === 'relation') {
    return 'var(--cf-live-on)'
  }
  return 'var(--cf-live-slow)'
}
