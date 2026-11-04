import 'server-only'
import { dbQuery, dbQueryOne, withTransaction } from '@/lib/db'
import { sanitizePlainText } from '@/lib/sanitize'
import { chapterPlainText, highlightSource } from './highlight-source'
import { resolveAnchor } from '@/lib/highlights/anchor'
import type { HighlightMaterial, HighlightPublication, HighlightWorkshop, MaterialKind } from '@/lib/highlights/types'

export class WorkshopError extends Error {
  constructor(message: string, public status = 400) { super(message) }
}
export const publicSourceSQL = `EXISTS (SELECT 1 FROM chapters sc JOIN editions se ON se.id=sc.edition_id
  JOIN releases sr ON sr.id=se.release_id WHERE sc.id=h.chapter_id
  AND sc.status='published' AND se.status='published' AND sr.status='published')`

type MaterialRow = HighlightMaterial & { blob_path: string | null; legacy_image_url: string | null }
export function materialDTO(row: MaterialRow): HighlightMaterial {
  return { id: row.id, highlight_id: row.highlight_id, kind: row.kind, origin: row.origin,
    parent_id: row.parent_id, content: row.content, created_at: row.created_at,
    image_url: row.kind === 'image' ? `/api/chapter-highlights/${row.highlight_id}/materials/${row.id}/image` : null }
}
export async function listMaterials(id: string, userId: string, offset = 0) {
  const owner = await dbQueryOne('SELECT id FROM chapter_highlights WHERE id=$1 AND user_id=$2', [id, userId])
  if (!owner) throw new WorkshopError('Карточка не найдена', 404)
  const rows = await dbQuery<MaterialRow>('SELECT * FROM highlight_materials WHERE highlight_id=$1 ORDER BY created_at DESC, id DESC LIMIT 30 OFFSET $2', [id, offset])
  return rows.map(materialDTO)
}

export async function getWorkshop(id: string, userId: string | null): Promise<HighlightWorkshop | null> {
  const h = await dbQueryOne<HighlightWorkshop & { content: string }>(`SELECT h.id, h.chapter_id, h.user_id, h.text_content,
    h.note, h.draft_text, h.version, h.is_public, h.publication, h.anchor, h.likes_count,
    u.display_name AS user_name, ch.title AS chapter_title, ch.content,
    COALESCE(NULLIF(e.slug,''),e.id::text) AS edition_slug, r.title AS release_title, r.slug AS release_slug, r.authors,
    ${publicSourceSQL} AS source_available,
    EXISTS(SELECT 1 FROM chapter_highlight_likes l WHERE l.highlight_id=h.id AND l.user_id=$2) AS is_liked_by_me,
    EXISTS(SELECT 1 FROM highlight_saves s WHERE s.highlight_id=h.id AND s.user_id=$2) AS is_saved
    FROM chapter_highlights h JOIN users u ON u.id=h.user_id JOIN chapters ch ON ch.id=h.chapter_id
    JOIN editions e ON e.id=ch.edition_id JOIN releases r ON r.id=e.release_id
    WHERE h.id=$1 AND (h.user_id=$2 OR (h.is_public AND h.publication IS NOT NULL AND ${publicSourceSQL}))`, [id, userId])
  if (!h) return null
  const owner = h.user_id === userId
  const { content, ...data } = h
  const plain = chapterPlainText(content ?? '')
  const resolved = h.anchor ? resolveAnchor(plain, h.anchor) : resolveAnchor(plain, { exact: h.text_content, start: -1, end: -1, prefix: '', suffix: '' })
  return { ...data, note: owner ? h.note : h.publication?.note ?? null,
    draft_text: owner ? h.draft_text : '', version: owner ? h.version : 0,
    anchor: owner ? h.anchor : null,
    materials: owner ? await listMaterials(id, userId!) : h.publication?.materials ?? [],
    permissions: { edit: owner, publish: owner && h.source_available, save: !!userId && !owner && h.is_public && h.source_available },
    anchor_status: resolved?.status ?? 'missing' }
}

export async function saveDraft(id: string, userId: string, data: { version: number; note: string | null; text: string; requestId: string; parentId?: string | null }) {
  return withTransaction(async client => {
    const locked = await client.query<{ version: number; draft_text: string }>('SELECT version, draft_text FROM chapter_highlights WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId])
    const row = locked.rows[0]
    if (!row) throw new WorkshopError('Карточка не найдена', 404)
    const previous = await client.query('SELECT id FROM highlight_materials WHERE highlight_id=$1 AND request_id=$2', [id, data.requestId])
    if (previous.rowCount) return { version: row.version }
    if (row.version !== data.version) throw new WorkshopError('Карточка изменена в другой вкладке. Ваш текст сохранён в редакторе; перечитайте серверную версию.', 409)
    if (data.parentId) {
      const parent = await client.query('SELECT id FROM highlight_materials WHERE id=$1 AND highlight_id=$2 AND kind<>\'image\'', [data.parentId, id])
      if (!parent.rowCount) throw new WorkshopError('Исходный вариант не найден')
    }
    const text = sanitizePlainText(data.text)
    if (text.trim() && text !== row.draft_text) await client.query(`INSERT INTO highlight_materials(highlight_id,kind,origin,content,parent_id,request_id)
      VALUES($1,'text','manual',$2,$3,$4)`, [id, text, data.parentId ?? null, data.requestId])
    await client.query('UPDATE chapter_highlights SET note=$3, draft_text=$4, version=version+1 WHERE id=$1 AND user_id=$2', [id, userId, data.note === null ? null : sanitizePlainText(data.note), text])
    return { version: row.version + 1 }
  })
}

export async function addMaterial(id: string, userId: string, data: {
  kind: MaterialKind; origin: 'ai' | 'upload'; content?: string; blobPath?: string; requestId: string
}) {
  const rows = await dbQuery<MaterialRow>(`INSERT INTO highlight_materials(highlight_id,kind,origin,content,blob_path,request_id)
    SELECT id,$3,$4,$5,$6,$7 FROM chapter_highlights WHERE id=$1 AND user_id=$2
    ON CONFLICT(highlight_id,request_id) DO UPDATE SET request_id=EXCLUDED.request_id RETURNING *`,
  [id, userId, data.kind, data.origin, sanitizePlainText(data.content ?? ''), data.blobPath ?? null, data.requestId])
  if (!rows[0]) throw new WorkshopError('Карточка не найдена', 404)
  return { material: materialDTO(rows[0]), blobPath: rows[0].blob_path }
}

export async function publishWorkshop(id: string, userId: string, data: { version: number; published: boolean; includeNote: boolean; materialIds: string[] }) {
  return withTransaction(async client => {
    const locked = await client.query<{ note: string | null; version: number; chapter_id: string }>('SELECT note, version, chapter_id FROM chapter_highlights WHERE id=$1 AND user_id=$2 FOR UPDATE', [id, userId])
    const row = locked.rows[0]
    if (!row) throw new WorkshopError('Карточка не найдена', 404)
    if (row.version !== data.version) throw new WorkshopError('Карточка изменилась. Обновите данные перед публикацией.', 409)
    let publication: HighlightPublication | null = null
    if (data.published) {
      const source = await client.query(`SELECT ch.id FROM chapters ch JOIN editions e ON e.id=ch.edition_id JOIN releases r ON r.id=e.release_id
        WHERE ch.id=$1 AND ch.status='published' AND e.status='published' AND r.status='published' FOR SHARE OF ch,e,r`, [row.chapter_id])
      if (!source.rowCount) throw new WorkshopError('Источник не опубликован', 403)
      const variants = await client.query<MaterialRow>('SELECT * FROM highlight_materials WHERE highlight_id=$1 AND id=ANY($2::uuid[])', [id, data.materialIds])
      if (variants.rows.length !== data.materialIds.length || new Set(data.materialIds).size !== data.materialIds.length) throw new WorkshopError('Выберите существующие варианты своей карточки')
      if (variants.rows.filter(m => m.kind === 'image').length > 1) throw new WorkshopError('Выберите одно изображение')
      if (variants.rows.some(m => m.kind === 'image' && !m.blob_path)) throw new WorkshopError('Старое изображение нужно загрузить заново в приватное хранилище')
      publication = { note: data.includeNote ? row.note : null,
        materials: data.materialIds.map(mid => materialDTO(variants.rows.find(m => m.id === mid)!)), published_at: new Date().toISOString() }
    }
    await client.query('UPDATE chapter_highlights SET is_public=$3, publication=$4::jsonb, version=version+1 WHERE id=$1 AND user_id=$2', [id, userId, data.published, publication ? JSON.stringify(publication) : null])
    return { version: row.version + 1 }
  })
}

export async function setSavedHighlight(id: string, userId: string, saved: boolean) {
  if (!saved) { await dbQuery('DELETE FROM highlight_saves WHERE highlight_id=$1 AND user_id=$2', [id, userId]); return }
  const row = await dbQueryOne(`INSERT INTO highlight_saves(highlight_id,user_id)
    SELECT h.id,$2 FROM chapter_highlights h WHERE h.id=$1 AND h.user_id<>$2 AND h.is_public AND h.publication IS NOT NULL AND ${publicSourceSQL}
    ON CONFLICT(user_id,highlight_id) DO UPDATE SET user_id=EXCLUDED.user_id RETURNING highlight_id`, [id, userId])
  if (!row) throw new WorkshopError('Карточка недоступна', 404)
}

export async function collection(userId: string, saved: boolean, offset: number, editionId?: string) {
  return dbQuery<{ id: string; text_content: string | null; chapter_id: string | null; paragraph_index: number | null; is_public: boolean; unavailable: boolean }>(`SELECT h.id,
    CASE WHEN h.user_id=$1 OR (h.is_public AND ${publicSourceSQL}) THEN h.text_content ELSE NULL END AS text_content,
    CASE WHEN h.user_id=$1 OR (h.is_public AND ${publicSourceSQL}) THEN h.chapter_id ELSE NULL END AS chapter_id,
    CASE WHEN h.user_id=$1 OR (h.is_public AND ${publicSourceSQL}) THEN h.paragraph_index ELSE NULL END AS paragraph_index,
    h.is_public, NOT(h.user_id=$1 OR (h.is_public AND ${publicSourceSQL})) AS unavailable
    FROM chapter_highlights h ${saved ? 'JOIN highlight_saves s ON s.highlight_id=h.id AND s.user_id=$1' : ''}
    WHERE ${saved ? 'TRUE' : 'h.user_id=$1'} AND ($3::uuid IS NULL OR EXISTS(SELECT 1 FROM chapters ch WHERE ch.id=h.chapter_id AND ch.edition_id=$3))
    ORDER BY ${saved ? 's.created_at' : 'h.created_at'} DESC,h.id DESC LIMIT 30 OFFSET $2`, [userId, offset, editionId ?? null])
}

export async function claimGeneration(id: string, userId: string, requestId: string) {
  const workshop = await getWorkshop(id, userId)
  if (!workshop?.permissions.edit) throw new WorkshopError('Карточка не найдена', 404)
  const source = await highlightSource(workshop.chapter_id, userId)
  if (!source?.allowed) throw new WorkshopError('Источник недоступен', 403)
  const existing = await dbQueryOne<MaterialRow>('SELECT * FROM highlight_materials WHERE highlight_id=$1 AND request_id=$2', [id, requestId])
  if (existing) return { text: workshop.text_content, existing: materialDTO(existing) }
  const claimed = await dbQueryOne(`INSERT INTO highlight_generation_requests(highlight_id,request_id,state) VALUES($1,$2,'running')
    ON CONFLICT(highlight_id,request_id) DO UPDATE SET state='running',created_at=NOW()
    WHERE highlight_generation_requests.state='failed' OR highlight_generation_requests.created_at<NOW()-INTERVAL '3 minutes'
    RETURNING request_id`, [id, requestId])
  if (!claimed) throw new WorkshopError('Этот запрос уже выполняется', 409)
  return { text: workshop.text_content, existing: null }
}
export async function finishGeneration(id: string, requestId: string, state: 'complete' | 'failed') {
  await dbQuery('UPDATE highlight_generation_requests SET state=$3 WHERE highlight_id=$1 AND request_id=$2', [id, requestId, state])
}

export async function accessibleImage(id: string, materialId: string, userId: string | null) {
  return dbQueryOne<MaterialRow>(`SELECT m.* FROM highlight_materials m JOIN chapter_highlights h ON h.id=m.highlight_id
    WHERE h.id=$1 AND m.id=$2 AND m.kind='image' AND (h.user_id=$3 OR (h.is_public AND ${publicSourceSQL}
    AND EXISTS(SELECT 1 FROM jsonb_array_elements(h.publication->'materials') p WHERE p->>'id'=m.id::text)))`, [id, materialId, userId])
}
