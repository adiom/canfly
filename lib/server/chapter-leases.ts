import { randomBytes } from 'node:crypto'
import type { PoolClient } from 'pg'
import { dbQuery, withTransaction } from '@/lib/db'
import { ChapterWriteError } from '@/lib/studio/chapter-write'
import {
  CHAPTER_LEASE_TTL_SECONDS,
  type ChapterLeaseActorKind,
} from '@/lib/studio/chapter-lease'

export { CHAPTER_LEASE_TTL_SECONDS }
export type { ChapterLeaseActorKind }

/**
 * Эксклюзивное редактирование главы.
 *
 * Единственный источник правды — таблица `chapter_edit_leases` в PostgreSQL,
 * поэтому право записи одинаково проверяется на любом инстансе Vercel.
 * Время берётся только из БД (`now()`), часы процесса и клиента не участвуют.
 *
 * Порядок блокировок (одинаковый для всех операций, чтобы не было deadlock):
 *   1. advisory lock состава издания — только create/reorder/удаление издания;
 *   2. строка lease (`FOR UPDATE`);
 *   3. строка главы (`FOR UPDATE`);
 *   4. вставка в `chapter_versions` и UPDATE главы.
 * Reorder и каскадное удаление блокируют строки глав в порядке `chapters.id`,
 * а lease-строки читают без `FOR UPDATE`, поэтому цикла с писателем нет.
 */
/** Достаточно `query`: подходит и PoolClient, и отдельный Client в тестах. */
type Queryable = Pick<PoolClient, 'query'>

export interface ChapterLeaseActor {
  /** null допустим только для статического MCP_TOKEN без привязки к пользователю. */
  userId: string | null
  actorKind: ChapterLeaseActorKind
}

export interface ChapterLeaseProof {
  sessionId: string
  token: string
  generation: number
}

/**
 * `session` — Studio-вкладка, которая уже держит lease и продлевает его heartbeat.
 * `implicit` — MCP: lease захватывается и освобождается внутри транзакции записи.
 */
export type ChapterLeaseGrant =
  | { mode: 'session'; actor: ChapterLeaseActor; proof: ChapterLeaseProof }
  | { mode: 'implicit'; actor: ChapterLeaseActor; sessionId: string }

export interface ChapterLease {
  chapterId: string
  userId: string | null
  actorKind: ChapterLeaseActorKind
  sessionId: string
  token: string
  generation: number
  expiresAt: string
}

export interface ChapterLeaseHolder {
  userId: string | null
  actorKind: ChapterLeaseActorKind
  displayName: string
  expiresAt: string
}

export interface ActiveChapterLease {
  chapterId: string
  chapterTitle: string
  displayName: string
  expiresAt: string
}

interface LeaseRow {
  chapter_id: string
  user_id: string | null
  actor_kind: ChapterLeaseActorKind
  session_id: string
  lease_token: string
  generation: string | number
  expires_at: Date
}

const leaseColumns = `chapter_id, user_id, actor_kind, session_id, lease_token, generation, expires_at`

function newLeaseToken() {
  return randomBytes(32).toString('hex')
}

/**
 * Ключ advisory-lock на главу. Его берут и захват lease, и структурные
 * операции (reorder/удаление издания), поэтому захват не может проскочить
 * между проверкой lease и изменением порядка/удалением. Ключи блокируются
 * в отсортированном порядке, чтобы не было deadlock.
 */
function chapterLeaseLockKey(chapterId: string) {
  return `canfly:chapter-lease:${chapterId}`
}

export async function lockChapterLeaseScopes(client: Queryable, chapterIds: string[]) {
  const ids = [...new Set(chapterIds)].sort()
  for (const id of ids) {
    await client.query(
      'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
      [chapterLeaseLockKey(id)],
    )
  }
}

/**
 * Блокирует существующие lease-строки (включая истёкшие) в порядке chapter_id.
 * Структурные операции вызывают это ДО блокировки строк глав: иначе писатель,
 * успевший проверить ещё живой lease и ждущий строку главы, мог бы образовать
 * цикл с каскадным удалением, которое ждёт его lease-строку.
 */
export async function lockChapterLeaseRows(client: Queryable, chapterIds: string[]) {
  const ids = [...new Set(chapterIds)].sort()
  if (ids.length === 0) return
  await client.query(
    `SELECT chapter_id FROM chapter_edit_leases
     WHERE chapter_id = ANY($1::uuid[])
     ORDER BY chapter_id
     FOR UPDATE`,
    [ids],
  )
}

/**
 * Блокировка состава релиза. Её берут createEdition и deleteRelease, чтобы
 * между проверкой полного состава и удалением не появилось новое издание
 * или глава.
 */
export async function lockReleaseComposition(client: Queryable, releaseId: string) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`canfly:release-composition:${releaseId}`],
  )
}

function toLease(row: LeaseRow): ChapterLease {
  return {
    chapterId: row.chapter_id,
    userId: row.user_id,
    actorKind: row.actor_kind,
    sessionId: row.session_id,
    token: row.lease_token,
    generation: Number(row.generation),
    expiresAt: row.expires_at.toISOString(),
  }
}

async function readHolder(client: Queryable, chapterId: string): Promise<ChapterLeaseHolder | null> {
  const { rows } = await client.query<{
    user_id: string | null
    actor_kind: ChapterLeaseActorKind
    display_name: string | null
    expires_at: Date
  }>(
    `SELECT l.user_id, l.actor_kind, u.display_name, l.expires_at
     FROM chapter_edit_leases l
     LEFT JOIN users u ON u.id = l.user_id
     WHERE l.chapter_id = $1 AND l.expires_at > now()
     LIMIT 1`,
    [chapterId],
  )
  const row = rows[0]
  if (!row) return null
  return {
    userId: row.user_id,
    actorKind: row.actor_kind,
    displayName: row.display_name ?? 'MCP-клиент',
    expiresAt: row.expires_at.toISOString(),
  }
}

/**
 * Атомарный захват. Свободная или истёкшая строка перехватывается, generation
 * растёт, поэтому все запросы прежнего владельца становятся недействительными.
 * Активный чужой lease не вытесняется: возвращается `{ ok: false, holder }`.
 */
export async function acquireChapterLeaseOnClient(
  client: Queryable,
  input: { chapterId: string; sessionId: string; actor: ChapterLeaseActor },
): Promise<{ ok: true; lease: ChapterLease } | { ok: false; holder: ChapterLeaseHolder | null }> {
  const { chapterId, sessionId, actor } = input
  const token = newLeaseToken()

  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [chapterLeaseLockKey(chapterId)],
  )

  let rows: LeaseRow[]
  try {
    ({ rows } = await client.query<LeaseRow>(
      `INSERT INTO chapter_edit_leases AS l (
         chapter_id, user_id, actor_kind, session_id, lease_token, generation,
         acquired_at, expires_at, released_at, updated_at
       )
       VALUES ($1, $2, $3, $4, $5, 1, now(), now() + make_interval(secs => $6), NULL, now())
       ON CONFLICT (chapter_id) DO UPDATE SET
         user_id = EXCLUDED.user_id,
         actor_kind = EXCLUDED.actor_kind,
         session_id = EXCLUDED.session_id,
         lease_token = EXCLUDED.lease_token,
         generation = l.generation + 1,
         acquired_at = now(),
         expires_at = EXCLUDED.expires_at,
         released_at = NULL,
         updated_at = now()
       WHERE l.expires_at <= now()
          OR (l.user_id IS NOT DISTINCT FROM EXCLUDED.user_id AND l.session_id = EXCLUDED.session_id)
       RETURNING ${leaseColumns}`,
      [chapterId, actor.userId, actor.actorKind, sessionId, token, CHAPTER_LEASE_TTL_SECONDS],
    ))
  } catch (error) {
    if ((error as { code?: string }).code === '23503') throw new ChapterWriteError('not-found')
    throw error
  }

  const row = rows[0]
  if (!row) return { ok: false, holder: await readHolder(client, chapterId) }
  return { ok: true, lease: toLease(row) }
}

export async function acquireChapterLease(input: {
  chapterId: string
  sessionId: string
  actor: ChapterLeaseActor
}) {
  return withTransaction(client => acquireChapterLeaseOnClient(client, input))
}

export async function renewChapterLeaseOnClient(
  client: Queryable,
  input: { chapterId: string; sessionId: string; actor: ChapterLeaseActor; proof: ChapterLeaseProof },
): Promise<ChapterLease | null> {
  const { chapterId, sessionId, actor, proof } = input
  const { rows } = await client.query<LeaseRow>(
    `UPDATE chapter_edit_leases
     SET expires_at = now() + make_interval(secs => $7), updated_at = now()
     WHERE chapter_id = $1
       AND session_id = $2
       AND lease_token = $3
       AND generation = $4
       AND actor_kind = $5
       AND user_id IS NOT DISTINCT FROM $6
       AND expires_at > now()
     RETURNING ${leaseColumns}`,
    [chapterId, sessionId, proof.token, proof.generation, actor.actorKind, actor.userId, CHAPTER_LEASE_TTL_SECONDS],
  )
  return rows[0] ? toLease(rows[0]) : null
}

export async function renewChapterLease(input: {
  chapterId: string
  sessionId: string
  actor: ChapterLeaseActor
  proof: ChapterLeaseProof
}) {
  const lease = await withTransaction(client => renewChapterLeaseOnClient(client, input))
  return lease ? { ok: true as const, lease } : { ok: false as const }
}

/**
 * Освобождение вкладкой. Запись остаётся в таблице с `expires_at = now()`,
 * чтобы generation росла монотонно и запоздавшие запросы отклонялись по токену.
 */
export async function releaseChapterLeaseOnClient(
  client: Queryable,
  input: { chapterId: string; sessionId: string; actor: ChapterLeaseActor; proof: ChapterLeaseProof },
) {
  const { chapterId, sessionId, actor, proof } = input
  const { rowCount } = await client.query(
    `UPDATE chapter_edit_leases
     SET expires_at = now(), released_at = now(), updated_at = now()
     WHERE chapter_id = $1
       AND session_id = $2
       AND lease_token = $3
       AND generation = $4
       AND actor_kind = $5
       AND user_id IS NOT DISTINCT FROM $6
       AND expires_at > now()`,
    [chapterId, sessionId, proof.token, proof.generation, actor.actorKind, actor.userId],
  )
  return (rowCount ?? 0) > 0
}

export async function releaseChapterLease(input: {
  chapterId: string
  sessionId: string
  actor: ChapterLeaseActor
  proof: ChapterLeaseProof
}) {
  return withTransaction(client => releaseChapterLeaseOnClient(client, input))
}

export async function fetchChapterLease(chapterId: string): Promise<ChapterLeaseHolder | null> {
  return withTransaction(client => readHolder(client, chapterId))
}

export async function fetchActiveLeasesByEdition(editionId: string): Promise<ActiveChapterLease[]> {
  const rows = await dbQuery<{
    chapter_id: string
    title: string
    display_name: string | null
    expires_at: Date
  }>(
    `SELECT l.chapter_id, c.title, u.display_name, l.expires_at
     FROM chapter_edit_leases l
     JOIN chapters c ON c.id = l.chapter_id
     LEFT JOIN users u ON u.id = l.user_id
     WHERE c.edition_id = $1 AND l.expires_at > now()
     ORDER BY c.chapter_index ASC, c.id ASC`,
    [editionId],
  )
  return rows.map(row => ({
    chapterId: row.chapter_id,
    chapterTitle: row.title,
    displayName: row.display_name ?? 'MCP-клиент',
    expiresAt: row.expires_at.toISOString(),
  }))
}

async function lockSessionLease(
  client: Queryable,
  chapterId: string,
  actor: ChapterLeaseActor,
  proof: ChapterLeaseProof,
) {
  const { rows } = await client.query<LeaseRow & { live: boolean }>(
    `SELECT ${leaseColumns}, expires_at > now() AS live
     FROM chapter_edit_leases
     WHERE chapter_id = $1
     FOR UPDATE`,
    [chapterId],
  )
  const row = rows[0]
  if (
    !row ||
    !row.live ||
    Number(row.generation) !== proof.generation ||
    row.lease_token !== proof.token ||
    row.session_id !== proof.sessionId ||
    row.actor_kind !== actor.actorKind ||
    row.user_id !== actor.userId
  ) {
    throw new ChapterWriteError('lease-lost')
  }
  return row
}

/**
 * Единая точка проверки права записи. Вызывается внутри транзакции записи
 * непосредственно перед блокировкой строки главы.
 */
export async function withChapterLease<T>(
  client: Queryable,
  chapterId: string,
  grant: ChapterLeaseGrant,
  fn: (lease: { generation: number }) => Promise<T>,
): Promise<T> {
  if (grant.mode === 'session') {
    // Права проверяются в той же транзакции, что lease и ревизия: Studio-action
    // уже вызвал requireChapterOwnership, но репозиторий не полагается на это.
    if (grant.actor.userId) {
      const { rows: [access] } = await client.query<{ is_admin: boolean; role: string | null }>(
        `SELECT u.is_admin, rc.role
         FROM chapters c
         JOIN editions e ON e.id = c.edition_id
         JOIN users u ON u.id = $2
         LEFT JOIN release_collaborators rc
           ON rc.release_id = e.release_id AND rc.user_id = $2
         WHERE c.id = $1`,
        [chapterId, grant.actor.userId],
      )
      if (!access) throw new ChapterWriteError('not-found')
      if (!access.is_admin && access.role !== 'owner') throw new ChapterWriteError('lease-required')
    }
    const row = await lockSessionLease(client, chapterId, grant.actor, grant.proof)
    return fn({ generation: Number(row.generation) })
  }

  const acquired = await acquireChapterLeaseOnClient(client, {
    chapterId,
    sessionId: grant.sessionId,
    actor: grant.actor,
  })
  if (!acquired.ok) throw new ChapterWriteError('lease-held')

  const result = await fn({ generation: acquired.lease.generation })
  await releaseChapterLeaseOnClient(client, {
    chapterId,
    sessionId: acquired.lease.sessionId,
    actor: grant.actor,
    proof: {
      sessionId: acquired.lease.sessionId,
      token: acquired.lease.token,
      generation: acquired.lease.generation,
    },
  })
  return result
}

/** Reorder и каскадное удаление: живые lease запрещают структурную запись. */
export async function assertNoActiveChapterLeases(client: Queryable, chapterIds: string[]) {
  if (chapterIds.length === 0) return
  const { rows } = await client.query<{ chapter_id: string }>(
    `SELECT chapter_id FROM chapter_edit_leases
     WHERE chapter_id = ANY($1::uuid[]) AND expires_at > now()`,
    [chapterIds],
  )
  if (rows.length > 0) throw new ChapterWriteError('lease-held')
}

/**
 * Сериализует изменение состава издания (create/reorder/удаление): без этого
 * параллельные операции могут назначить одинаковый `chapter_index`.
 */
export async function lockEditionComposition(client: Queryable, editionId: string) {
  await client.query(
    'SELECT pg_advisory_xact_lock(hashtextextended($1, 0))',
    [`canfly:chapter-composition:${editionId}`],
  )
}
