/**
 * Клиентские типы и тайминги lease. Модуль не импортирует серверные
 * зависимости, чтобы его можно было использовать в Client Components.
 */
export const CHAPTER_LEASE_TTL_SECONDS = 60
export const CHAPTER_LEASE_HEARTBEAT_MS = 20_000
export const CHAPTER_LEASE_RETRY_MS = 10_000

export type ChapterLeaseActorKind = 'studio' | 'mcp'

export interface ChapterLeaseProof {
  sessionId: string
  token: string
  generation: number
}

/** То, что вкладка получает при захвате и передаёт в каждую запись. */
export interface ChapterLeaseView extends ChapterLeaseProof {
  chapterId: string
  expiresAt: string
}

export interface ChapterLeaseHolderView {
  displayName: string
  actorKind: ChapterLeaseActorKind
  expiresAt: string
}

export type ChapterLeaseState =
  | { status: 'acquiring' }
  | { status: 'recovering'; holder: ChapterLeaseHolderView | null }
  | { status: 'active'; lease: ChapterLeaseView; degraded: boolean }
  | { status: 'read-only'; holder: ChapterLeaseHolderView | null }
  | { status: 'lost'; holder: ChapterLeaseHolderView | null }
  | { status: 'error'; message: string }

export function toLeaseProof(lease: ChapterLeaseView | null | undefined): ChapterLeaseProof | null {
  if (!lease) return null
  return { sessionId: lease.sessionId, token: lease.token, generation: lease.generation }
}
