import type { LifeState } from '@/lib/server/character-completeness'

/**
 * Orbital life-state индикатор: точка + мягкое свечение + caps-label.
 * Используется в шапке каждого узла «дела» персонажа, чтобы показать
 * заполненность секции. Чистый серверный компонент — без интерактива.
 *
 * Палитра и свечение — из orbital DESIGN.md:
 *   quiet   #D6D3D1  rgba(148,163,184,0.16)  «тихо»
 *   born    #38BDF8  rgba(96,165,250,0.22)    «родилось»
 *   alive   #34D399  rgba(16,185,129,0.24)    «живёт»
 *   settled #A78BFA  rgba(168,85,247,0.20)    «созревает»
 */

const STATES: Record<LifeState, { dot: string; glow: string; label: string }> = {
  quiet: { dot: '#D6D3D1', glow: 'rgba(148,163,184,0.16)', label: 'тихо' },
  born: { dot: '#38BDF8', glow: 'rgba(96,165,250,0.22)', label: 'родилось' },
  alive: { dot: '#34D399', glow: 'rgba(16,185,129,0.24)', label: 'живёт' },
  settled: { dot: '#A78BFA', glow: 'rgba(168,85,247,0.20)', label: 'созревает' },
}

export function LifeStateDot({
  state,
  size = 10,
}: {
  state: LifeState
  size?: number
}) {
  const s = STATES[state]
  return (
    <span
      aria-hidden
      style={{
        backgroundColor: s.dot,
        width: size,
        height: size,
        boxShadow: `0 0 10px ${s.glow}, 0 0 18px ${s.glow}`,
      }}
      className="inline-block rounded-full"
    />
  )
}

export function LifeStateLabel({ state }: { state: LifeState }) {
  const s = STATES[state]
  return (
    <span className="text-[10px] font-medium uppercase tracking-[0.2em] text-neutral-400">
      {s.label}
    </span>
  )
}

/**
 * Полный индикатор: точка + caps-label. Применяется в шапке узла.
 * `size` уменьшаем для плотных мест (density bar и т. п.).
 */
export function LifeStateIndicator({
  state,
  withLabel = true,
  size = 10,
}: {
  state: LifeState
  withLabel?: boolean
  size?: number
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <LifeStateDot state={state} size={size} />
      {withLabel && <LifeStateLabel state={state} />}
    </span>
  )
}

export { STATES as LIFE_STATES }
