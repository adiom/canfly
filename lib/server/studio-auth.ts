import { getCurrentUser, getSystemRoles } from '@/lib/server/session'
import { dbQueryOne } from '@/lib/db'
import { redirect } from 'next/navigation'
import type { PublicRole, SystemRole } from '@/lib/types'
import type { SessionUser } from '@/lib/server/session'

export interface StudioSession {
  user: SessionUser
  publicRole: PublicRole
  isAdmin: boolean
  systemRoles: SystemRole[]
}

/** Результат проверки владения: сессия + release_id, к которому привязан ресурс. */
export interface OwnershipContext {
  session: StudioSession
  releaseId: string
}

export async function requireStudioSession(): Promise<StudioSession | null> {
  const user = await getCurrentUser()
  if (!user) return null

  // Доступ к Studio: admin (флаг), автор (public_role) или системная роль editor.
  const systemRoles = await getSystemRoles(user.id)
  if (!user.is_admin && user.public_role !== 'author' && systemRoles.length === 0) {
    return null
  }

  return { user, publicRole: user.public_role, isAdmin: user.is_admin, systemRoles }
}

/**
 * Проверяет, что текущий пользователь — owner релиза (release_collaborators.role='owner')
 * либо admin. Возвращает OwnershipContext с releaseId для переиспользования в action.
 * Бросает 'denied' через redirect, если доступа нет — как requireAuth в studio.ts.
 *
 * Это закрывает IDOR-уязвимость: ранее любой author/editor мог мутировать чужой релиз,
 * зная его UUID.
 */
export async function requireReleaseOwnership(releaseId: string): Promise<OwnershipContext> {
  const session = await requireStudioSession()
  if (!session) redirect('/login')

  // admin всегда имеет доступ
  if (session.isAdmin) {
    return { session, releaseId }
  }

  const link = await dbQueryOne<{ role: string }>(
    `SELECT role FROM release_collaborators
     WHERE release_id = $1 AND user_id = $2
     LIMIT 1`,
    [releaseId, session.user.id],
  )

  if (!link || link.role !== 'owner') redirect('/studio')

  return { session, releaseId }
}

/**
 * Не-бросающая проверка доступа к draft-релизу на публичной странице.
 *
 * В отличие от `requireReleaseOwnership`, не редиректит на студию — возвращает
 * флаги, чтобы `app/release/[slug]/page.tsx` сам вызывал `notFound()`.
 *
 *   `canViewDraft` — право увидеть `/release/[slug]` черновика:
 *     - админ (`is_admin`);
 *     - коллаборант этого релиза с ролью `owner` или `editor`.
 *   `canEdit` — право открыть `/studio/releases/[id]` этого релиза
 *   (повторяет `requireReleaseOwnership`):
 *     - админ;
 *     - `owner`. Editor-коллаборатор видит черновик на сайте, но в Studio
 *       этот релиз открыть не может — значит и кнопка «Открыть в Studio»
 *       для него не нужна.
 *
 * Системная роль `editor` без привязки к релизу НЕ даёт доступа — модель
 * доступа строится на `release_collaborators`, а не на глобальных модераторах.
 */
export async function getReleaseViewer(releaseId: string): Promise<{
  session: StudioSession | null
  canViewDraft: boolean
  canEdit: boolean
}> {
  const session = await requireStudioSession()
  if (!session) return { session: null, canViewDraft: false, canEdit: false }
  if (session.isAdmin) return { session, canViewDraft: true, canEdit: true }

  const link = await dbQueryOne<{ role: 'owner' | 'editor' | 'viewer' }>(
    `SELECT role FROM release_collaborators
     WHERE release_id = $1 AND user_id = $2
     LIMIT 1`,
    [releaseId, session.user.id],
  )

  const role = link?.role ?? null
  return {
    session,
    canViewDraft: role === 'owner' || role === 'editor',
    canEdit: role === 'owner',
  }
}

/**
 * Извлекает release_id из editions.release_id и проверяет владение релизом.
 */
export async function requireEditionOwnership(editionId: string): Promise<OwnershipContext> {
  const edition = await dbQueryOne<{ release_id: string }>(
    'SELECT release_id FROM editions WHERE id = $1 LIMIT 1',
    [editionId],
  )
  if (!edition) redirect('/studio')
  return requireReleaseOwnership(edition.release_id)
}

/**
 * Извлекает цепочку chapter → edition → release и проверяет владение релизом.
 */
export async function requireChapterOwnership(chapterId: string): Promise<OwnershipContext> {
  const link = await dbQueryOne<{ release_id: string }>(
    `SELECT e.release_id
     FROM chapters c
     JOIN editions e ON e.id = c.edition_id
     WHERE c.id = $1
     LIMIT 1`,
    [chapterId],
  )
  if (!link) redirect('/studio')
  return requireReleaseOwnership(link.release_id)
}

export async function requireStudioAdminSession(): Promise<StudioSession | null> {
  const session = await requireStudioSession()
  if (!session) return null
  if (!session.isAdmin) return null
  return session
}

export async function requireAuthorOrAdminSession(): Promise<StudioSession | null> {
  const session = await requireStudioSession()
  if (!session) return null
  if (!session.isAdmin && session.publicRole !== 'author') return null
  return session
}

export function isStudioAdmin(session: StudioSession | null | undefined) {
  return !!session?.isAdmin
}

export function isAuthorOrAdmin(session: StudioSession | null | undefined) {
  return !!session && (session.isAdmin || session.publicRole === 'author')
}
