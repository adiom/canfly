import Image from 'next/image'

import type { CharacterRelationshipWithTarget } from '@/lib/types'

export interface FieldDot {
  id: string
  /** 0..1 — насколько связь весома: задаёт размер точки */
  weight: number
  tone: 'accent' | 'on' | 'slow' | 'quiet'
}

interface OrbitalPortraitProps {
  name: string
  avatar: string | null
  dots: FieldDot[]
}

// Радиусы колец в % от половины поля; они же рисуют слабые орбиты.
const RING_RADII = [30, 43, 56]
// Золотой угол разводит точки без всякой случайности — поле стабильно на SSR.
const GOLDEN_ANGLE = 2.39996323

const TONE_VAR: Record<FieldDot['tone'], string> = {
  accent: 'var(--cf-air-accent)',
  on: 'var(--cf-live-on)',
  slow: 'var(--cf-live-slow)',
  quiet: 'var(--cf-live-quiet)',
}

/**
 * Персонаж как центр собственного созвездия: аватар — тихо дышащая звезда,
 * связи дрейфуют вокруг него. Это портрет, а не граф: точки не кликабельны,
 * они лишь показывают, насколько густо герой вплетён во вселенную.
 */
export function OrbitalPortrait({ name, avatar, dots }: OrbitalPortraitProps) {
  const placed = dots.map((dot, i) => {
    const ring = i % RING_RADII.length
    // Весомые связи притягиваются ближе к центру
    const radius = RING_RADII[ring] + (1 - dot.weight) * 6
    const angle = i * GOLDEN_ANGLE
    const size = 5 + dot.weight * 9

    return {
      id: dot.id,
      color: TONE_VAR[dot.tone],
      left: `${50 + Math.cos(angle) * radius}%`,
      top: `${50 + Math.sin(angle) * radius}%`,
      size,
      // Разный ритм у каждой точки: поле дышит, а не пульсирует в такт
      duration: `${14 + (i % 5) * 3}s`,
      delay: `${-(i % 7) * 1.6}s`,
    }
  })

  return (
    <div className="relative mx-auto flex aspect-square w-full max-w-[440px] items-center justify-center">
      <svg
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full"
        viewBox="0 0 100 100"
        preserveAspectRatio="xMidYMid meet"
      >
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
      </svg>

      {placed.map((dot) => (
        <span
          key={dot.id}
          className="cf-orbit-dot absolute rounded-full"
          style={{
            left: dot.left,
            top: dot.top,
            width: dot.size,
            height: dot.size,
            marginLeft: -dot.size / 2,
            marginTop: -dot.size / 2,
            background: dot.color,
            boxShadow: `0 0 ${dot.size * 1.6}px color-mix(in srgb, ${dot.color} 55%, transparent)`,
            animationDuration: dot.duration,
            animationDelay: dot.delay,
          }}
        />
      ))}

      <div className="cf-star relative z-10 flex items-center justify-center">
        <div
          aria-hidden
          className="absolute inset-0 rounded-full blur-2xl"
          style={{
            background:
              'radial-gradient(circle, color-mix(in srgb, var(--cf-bg) 90%, transparent) 0%, color-mix(in srgb, var(--cf-air-accent) 30%, transparent) 55%, transparent 72%)',
            transform: 'scale(2.1)',
          }}
        />
        <div className="relative h-[104px] w-[104px] overflow-hidden rounded-full bg-cf-air-surface-2 ring-1 ring-cf-air-line">
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
    </div>
  )
}

/** Вес связи по её описанию: раскрытая связь весит больше безымянной. */
export function relationshipDots(
  relationships: CharacterRelationshipWithTarget[],
): FieldDot[] {
  return relationships.map((rel) => ({
    id: rel.id,
    weight: Math.min(1, 0.3 + (rel.description?.length ?? 0) / 220),
    tone: rel.related_type === 'city' ? 'slow' : 'accent',
  }))
}
