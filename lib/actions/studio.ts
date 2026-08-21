'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { del, head } from '@vercel/blob'
import {
  requireStudioSession,
  requireStudioAdminSession,
  requireReleaseOwnership,
  requireEditionOwnership,
  requireChapterOwnership,
} from '@/lib/server/studio-auth'
import * as releasesDb from '@/lib/server/releases'
import * as editionsDb from '@/lib/server/editions'
import * as chaptersDb from '@/lib/server/chapters'
import * as seriesDb from '@/lib/server/series'
import { dbQuery } from '@/lib/db'
import { parseAudioBlobMetadata } from '@/lib/server/audio-metadata'
import type { QualityTier, ReleaseCharacterRole, ReleaseDesignConfig } from '@/lib/releases-types'
import {
  releaseFormSchema,
  editionFormSchema,
  chapterFormSchema,
  chapterUpdateSchema,
  seriesFormSchema,
  releaseStatusSchema,
  editionStatusSchema,
} from '@/lib/schemas/studio'

/** Безопасный парсинг enum-строки; возвращает значение или null. */
function parseEnum<T extends string>(
  schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false } },
  value: string,
): T | null {
  const result = schema.safeParse(value)
  return result.success ? result.data : null
}
const releaseStatusSchemaSafe = (v: string) => parseEnum(releaseStatusSchema, v)
const editionStatusSchemaSafe = (v: string) => parseEnum(editionStatusSchema, v)

async function requireAuth() {
  const session = await requireStudioSession()
  if (!session) redirect('/login')
  return session
}

/**
 * Серии — общий каталог вселенной, владельца у них нет. Мутации ограничены
 * админом: раньше любой author мог переименовать или удалить любую серию по UUID.
 */
async function requireSeriesAdmin() {
  const session = await requireStudioAdminSession()
  if (!session) redirect('/studio')
  return session
}

/**
 * Безопасно парсит JSON из FormData. Раньше был голый JSON.parse(... as string),
 * который падал на невалидном JSON и ронял весь action. Теперь fallback на [].
 */
function parseJsonArray<T = unknown>(value: FormDataEntryValue | null): T[] {
  const raw = typeof value === 'string' ? value : ''
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? (parsed as T[]) : []
  } catch {
    return []
  }
}

/**
 * Парсит FormData через zod-схему и выбрасывает Error с человекочитаемым
 * сообщением при невалидных данных. Код форм перехватывает и показывает toast.
 */
function validateForm<T>(
  schema: { safeParse: (d: unknown) => { success: true; data: T } | { success: false; error: { issues: { message: string }[] } } },
  formData: FormData,
): T {
  const result = schema.safeParse(Object.fromEntries(formData))
  if (!result.success) {
    const msg = result.error.issues[0]?.message ?? 'Ошибка валидации'
    throw new Error(msg)
  }
  return result.data
}

// === Releases ===

export async function getMyReleases() {
  const session = await requireAuth()
  if (session.roles.includes('admin')) {
    return releasesDb.listAllReleases()
  }
  return releasesDb.listReleasesByAuthor(session.user.id)
}

export async function getMyReleasesWithEditions() {
  const session = await requireAuth()
  if (session.roles.includes('admin')) {
    return releasesDb.listAllReleasesWithEditions()
  }
  return releasesDb.listReleasesByAuthorWithEditions(session.user.id)
}

export async function getRelease(id: string) {
  await requireReleaseOwnership(id)
  return releasesDb.fetchReleaseById(id)
}

export async function createReleaseAction(formData: FormData) {
  const { user } = await requireAuth()

  const data = validateForm(releaseFormSchema, formData)
  const release = await releasesDb.createRelease({
    title: data.title,
    slug: data.slug,
    description: data.description,
    cover_image: data.cover_image,
    genre: data.genre,
    release_date: data.release_date,
    isbn: data.isbn,
    authors: parseJsonArray(formData.get('authors')),
    annotation: data.annotation,
    editor_notes: data.editor_notes,
    status: 'draft',
  })

  if (release) {
    await dbQuery(
      `INSERT INTO release_collaborators (release_id, user_id, role) VALUES ($1, $2, 'owner'::collaborator_role)`,
      [release.id, user.id],
    )
  }

  revalidatePath('/studio')
  if (release) redirect(`/studio/releases/${release.id}`)
}

export async function updateReleaseAction(id: string, formData: FormData) {
  await requireReleaseOwnership(id)

  const data = validateForm(releaseFormSchema, formData)
  await releasesDb.updateRelease(id, {
    title: data.title,
    slug: data.slug,
    description: data.description,
    cover_image: data.cover_image,
    genre: data.genre,
    release_date: data.release_date,
    isbn: data.isbn,
    authors: parseJsonArray(formData.get('authors')),
    annotation: data.annotation,
    editor_notes: data.editor_notes,
    status: data.status,
  })

  revalidatePath(`/studio/releases/${id}`)
}

export async function updateReleaseStatusAction(id: string, status: string) {
  await requireReleaseOwnership(id)
  const parsed = releaseStatusSchemaSafe(status)
  if (!parsed) throw new Error('Недопустимый статус релиза')
  await releasesDb.updateReleaseStatus(id, parsed)
  revalidatePath(`/studio/releases/${id}`)
  revalidatePath('/studio')
}

export async function updateReleaseSeriesAction(
  releaseId: string,
  seriesLinks: { series_id: string; phase_number: number | null }[],
) {
  await requireReleaseOwnership(releaseId)
  await releasesDb.setReleaseSeries(releaseId, seriesLinks)

  const release = await releasesDb.fetchReleaseById(releaseId)
  revalidatePath(`/studio/releases/${releaseId}`)
  if (release?.slug) {
    revalidatePath(`/release/${release.slug}`)
  }
}

export async function updateReleaseCharactersAction(
  releaseId: string,
  characterIds: { character_id: string; role: string }[],
) {
  await requireReleaseOwnership(releaseId)

  const allowedRoles: ReleaseCharacterRole[] = ['main', 'supporting', 'cameo']
  const normalized = characterIds
    .filter((c): c is { character_id: string; role: ReleaseCharacterRole } =>
      allowedRoles.includes(c.role as ReleaseCharacterRole),
    )
    .map(c => ({ character_id: c.character_id, role: c.role }))

  await releasesDb.setReleaseCharacters(releaseId, normalized)
  revalidatePath(`/studio/releases/${releaseId}`)
}

export async function deleteReleaseAction(id: string) {
  await requireReleaseOwnership(id)
  await releasesDb.deleteRelease(id)
  revalidatePath('/studio')
  redirect('/studio')
}

export async function updateReleaseDesignAction(id: string, config: ReleaseDesignConfig) {
  await requireReleaseOwnership(id)
  await releasesDb.updateReleaseDesign(id, config as Record<string, unknown>)
  revalidatePath(`/studio/releases/${id}`)
  // Инвалидируем публичную страницу по slug (раньше использовали UUID — не работало)
  const release = await releasesDb.fetchReleaseById(id)
  if (release?.slug) {
    revalidatePath(`/release/${release.slug}`)
  }
}

// === Editions ===

export async function getEditions(releaseId: string) {
  await requireReleaseOwnership(releaseId)
  return editionsDb.fetchEditionsByRelease(releaseId)
}

/**
 * Сквозной список изданий для раздела /studio/editions. Отдельной проверки
 * владения не нужно: выборка по автору сама ограничена release_collaborators.
 */
export async function getMyEditions() {
  const session = await requireAuth()
  if (session.roles.includes('admin')) {
    return editionsDb.listAllEditionsWithRelease()
  }
  return editionsDb.listEditionsByAuthorWithRelease(session.user.id)
}

export async function getReleaseSeries(releaseId: string) {
  await requireReleaseOwnership(releaseId)
  return releasesDb.fetchReleaseSeries(releaseId)
}

export async function getEdition(id: string) {
  await requireEditionOwnership(id)
  return editionsDb.fetchEditionById(id)
}

export async function createEditionAction(formData: FormData) {
  const data = validateForm(editionFormSchema, formData)
  // release_id приходит из формы — без этой проверки любой автор мог
  // создать издание в чужом релизе
  await requireReleaseOwnership(data.release_id)

  const edition = await editionsDb.createEdition({
    release_id: data.release_id,
    format: data.format,
    platform: data.platform,
    external_url: data.external_url,
    // slug не передаём: собирается на сервере из слага релиза
    status: 'draft',
    is_primary: data.is_primary,
    // Тираж раньше терялся — форма его присылала, но схема не описывала,
    // и zod срезал ключ: в БД уходил дефолтный 'standard'.
    quality_tier: data.quality_tier,
  })

  revalidatePath(`/studio/releases/${data.release_id}`)
  revalidatePath('/studio/editions')
  if (edition) redirect(`/studio/editions/${edition.id}/setup`)
}


export async function updateEditionStatusAction(id: string, status: string) {
  await requireEditionOwnership(id)
  const parsed = editionStatusSchemaSafe(status)
  if (!parsed) throw new Error('Недопустимый статус издания')
  await editionsDb.updateEditionStatus(id, parsed)
  const edition = await editionsDb.fetchEditionById(id)
  if (edition) {
    revalidatePath(`/studio/editions/${id}`)
    revalidatePath('/studio/editions')
    revalidatePath(`/studio/releases/${edition.release_id}`)
  }
}

export async function deleteEditionAction(id: string, releaseId: string) {
  await requireEditionOwnership(id)
  await editionsDb.deleteEdition(id)
  revalidatePath('/studio/editions')
  revalidatePath(`/studio/releases/${releaseId}`)
  redirect(`/studio/releases/${releaseId}`)
}

// === Chapters ===

export async function getChapters(editionId: string) {
  await requireEditionOwnership(editionId)
  return chaptersDb.fetchChaptersByEdition(editionId)
}

export async function getChapter(id: string) {
  await requireChapterOwnership(id)
  return chaptersDb.fetchChapterById(id)
}

export async function createChapterAction(formData: FormData) {
  const data = validateForm(chapterFormSchema, formData)
  await requireEditionOwnership(data.edition_id)

  const editionId = data.edition_id
  const existing = await chaptersDb.fetchChaptersByEdition(editionId)
  const nextIndex = existing.length > 0
    ? Math.max(...existing.map(c => c.chapter_index)) + 1
    : 1

  const chapter = await chaptersDb.createChapter({
    edition_id: editionId,
    title: data.title ?? `Глава ${nextIndex}`,
    content: null,
    chapter_index: nextIndex,
    status: 'draft',
    word_count: 0,
  })

  revalidatePath(`/studio/editions/${editionId}`)
  if (chapter) redirect(`/studio/editions/${editionId}/chapters/${chapter.id}`)
}

export async function reorderChaptersAction(editionId: string, chapterIds: string[]) {
  await requireEditionOwnership(editionId)
  if (!Array.isArray(chapterIds) || chapterIds.length === 0) {
    throw new Error('Неверные данные')
  }

  await chaptersDb.reorderChapters(editionId, chapterIds)
  revalidatePath(`/studio/editions/${editionId}`)
  return true
}

export async function updateChapterAction(id: string, data: {
  title?: string | null
  content?: string | null
  audio_url?: string | null
  audio_blob_path?: string | null
  duration_seconds?: number | null
  audio_metadata?: Record<string, unknown> | null
  audio_content_type?: string | null
  audio_file_size_bytes?: number | null
  audio_uploaded_at?: string | null
  chapter_index?: number
}) {
  await requireChapterOwnership(id)

  const parsed = chapterUpdateSchema.safeParse(data)
  if (!parsed.success) {
    throw new Error(parsed.error.issues[0]?.message ?? 'Ошибка валидации главы')
  }
  const valid = parsed.data

  const chapter = await chaptersDb.fetchChapterById(id)
  if (!chapter) return null

  const wordCount = valid.content
    ? valid.content.replace(/<[^>]*>/g, ' ').split(/\s+/).filter(Boolean).length
    : chapter.word_count

  if (valid.content && chapter.content && valid.content !== chapter.content) {
    await chaptersDb.createChapterVersion(id, chapter.content)
  }

  const updated = await chaptersDb.updateChapter(id, {
    title: valid.title ?? chapter.title,
    content: valid.content ?? chapter.content,
    audio_url: valid.audio_url ?? chapter.audio_url,
    audio_blob_path: valid.audio_blob_path ?? chapter.audio_blob_path,
    duration_seconds: valid.duration_seconds ?? chapter.duration_seconds,
    audio_metadata: valid.audio_metadata ?? chapter.audio_metadata,
    audio_content_type: valid.audio_content_type ?? chapter.audio_content_type,
    audio_file_size_bytes: valid.audio_file_size_bytes ?? chapter.audio_file_size_bytes,
    audio_uploaded_at: valid.audio_uploaded_at ?? chapter.audio_uploaded_at,
    chapter_index: valid.chapter_index ?? chapter.chapter_index,
    status: chapter.status,
    word_count: wordCount,
  })

  revalidatePath(`/studio/editions/${chapter.edition_id}`)
  return updated
}

export async function updateComicChapterPagesAction(chapterId: string, pages: string[]) {
  await requireChapterOwnership(chapterId)
  const content = JSON.stringify(pages)
  const chapter = await chaptersDb.fetchChapterById(chapterId)
  if (!chapter) throw new Error('Глава не найдена')

  if (chapter.content !== content) {
    await chaptersDb.createChapterVersion(chapterId, chapter.content ?? '')
  }

  const updated = await chaptersDb.updateChapter(chapterId, {
    title: chapter.title,
    content,
    chapter_index: chapter.chapter_index,
    status: chapter.status,
    word_count: 0,
  })

  revalidatePath(`/studio/editions/${chapter.edition_id}`)
  return updated
}

export async function finalizeAudioChapterUploadAction(id: string, data: {
  url: string
  pathname: string
  contentType?: string | null
  size?: number | null
}) {
  await requireChapterOwnership(id)

  const chapter = await chaptersDb.fetchChapterById(id)
  if (!chapter) return null

  if (!data.pathname.startsWith(`audio/chapters/${id}/`)) {
    throw new Error('Некорректный путь аудиофайла')
  }

  const blobToken = process.env.BLOB_READ_WRITE_TOKEN
  const blobInfo = await head(data.pathname, { token: blobToken })
  if (blobInfo.url !== data.url) {
    throw new Error('Blob URL не соответствует загруженному файлу')
  }

  const parsed = await parseAudioBlobMetadata({
    url: blobInfo.url,
    pathname: blobInfo.pathname,
    contentType: blobInfo.contentType ?? data.contentType ?? null,
    size: blobInfo.size ?? data.size ?? null,
    chapterId: id,
  })

  const previousPath = chapter.audio_blob_path
  const updated = await chaptersDb.updateChapter(id, {
    title: parsed.metadata.title ?? chapter.title,
    content: chapter.content,
    audio_url: blobInfo.url,
    audio_blob_path: blobInfo.pathname,
    duration_seconds: parsed.durationSeconds ?? chapter.duration_seconds,
    audio_metadata: parsed.metadata,
    audio_content_type: blobInfo.contentType ?? data.contentType ?? null,
    audio_file_size_bytes: blobInfo.size ?? data.size ?? null,
    audio_uploaded_at: blobInfo.uploadedAt.toISOString(),
    chapter_index: chapter.chapter_index,
    status: chapter.status,
    word_count: chapter.word_count,
  })

  if (previousPath && previousPath !== blobInfo.pathname && previousPath.startsWith(`audio/chapters/${id}/`)) {
    await del(previousPath, { token: blobToken }).catch(() => undefined)
  }

  revalidatePath(`/studio/editions/${chapter.edition_id}`)
  return { chapter: updated, coverUrl: parsed.coverUrl }
}

export async function applyAudioCoverToReleaseAction(chapterId: string, coverUrl: string) {
  await requireChapterOwnership(chapterId)
  const chapter = await chaptersDb.fetchChapterById(chapterId)
  if (!chapter) return null
  const edition = await editionsDb.fetchEditionById(chapter.edition_id)
  if (!edition) return null
  const release = await releasesDb.fetchReleaseById(edition.release_id)
  if (!release) return null

  const updated = await releasesDb.updateRelease(release.id, {
    title: release.title,
    slug: release.slug,
    description: release.description,
    cover_image: coverUrl,
    genre: release.genre,
    release_date: release.release_date,
    isbn: release.isbn,
    authors: release.authors,
    annotation: release.annotation,
    editor_notes: release.editor_notes,
    status: release.status,
  })

  revalidatePath(`/studio/editions/${chapter.edition_id}`)
  revalidatePath(`/studio/releases/${release.id}`)
  return updated
}

export async function removeAudioChapterFileAction(id: string) {
  await requireChapterOwnership(id)
  const chapter = await chaptersDb.fetchChapterById(id)
  if (!chapter) return null

  if (chapter.audio_blob_path?.startsWith(`audio/chapters/${id}/`)) {
    await del(chapter.audio_blob_path, { token: process.env.BLOB_READ_WRITE_TOKEN }).catch(() => undefined)
  }

  const updated = await chaptersDb.updateChapter(id, {
    title: chapter.title,
    content: chapter.content,
    audio_url: null,
    audio_blob_path: null,
    duration_seconds: null,
    audio_metadata: {},
    audio_content_type: null,
    audio_file_size_bytes: null,
    audio_uploaded_at: null,
    chapter_index: chapter.chapter_index,
    status: chapter.status,
    word_count: chapter.word_count,
  })

  revalidatePath(`/studio/editions/${chapter.edition_id}`)
  return updated
}

export async function publishChapterAction(id: string) {
  await requireChapterOwnership(id)
  const chapter = await chaptersDb.publishChapter(id)
  if (chapter) revalidatePath(`/studio/editions/${chapter.edition_id}`)
  return chapter
}

export async function deleteChapterAction(id: string) {
  await requireChapterOwnership(id)
  const chapter = await chaptersDb.fetchChapterById(id)
  if (!chapter) return
  await chaptersDb.deleteChapter(id)
  revalidatePath(`/studio/editions/${chapter.edition_id}`)
  redirect(`/studio/editions/${chapter.edition_id}`)
}

// === Chapter Versions ===

export async function getChapterVersions(chapterId: string) {
  await requireChapterOwnership(chapterId)
  return chaptersDb.fetchChapterVersions(chapterId)
}

export async function restoreChapterVersionAction(chapterId: string, versionId: string) {
  await requireChapterOwnership(chapterId)
  const chapter = await chaptersDb.restoreChapterVersion(chapterId, versionId)
  if (chapter) revalidatePath(`/studio/editions/${chapter.edition_id}/chapters/${chapterId}`)
  return chapter
}

// === Series ===

export async function getAllSeries() {
  await requireAuth()
  return seriesDb.fetchAllSeries()
}

export async function createSeriesAction(formData: FormData) {
  await requireSeriesAdmin()
  const data = validateForm(seriesFormSchema, formData)
  await seriesDb.createSeries({
    title: data.title,
    slug: data.slug,
    description: data.description,
  })
  revalidatePath('/studio/series')
}

export async function updateSeriesAction(id: string, formData: FormData) {
  await requireSeriesAdmin()
  const data = validateForm(seriesFormSchema, formData)
  await seriesDb.updateSeries(id, {
    title: data.title,
    slug: data.slug,
    description: data.description,
  })
  revalidatePath('/studio/series')
}

export async function deleteSeriesAction(id: string) {
  await requireSeriesAdmin()
  await seriesDb.deleteSeries(id)
  revalidatePath('/studio/series')
}

// === Edition Setup ===

export async function getEditionSetupData(editionId: string) {
  await requireEditionOwnership(editionId)
  const edition = await editionsDb.fetchEditionById(editionId)
  if (!edition) return null

  const release = await releasesDb.fetchReleaseById(edition.release_id)
  return { edition, release }
}

export async function updateEditionSetupAction(
  editionId: string,
  data: {
    slug?: string
    platform?: string | null
    external_url?: string | null
    quality_tier?: QualityTier
    cover_image?: string | null
    annotation?: string | null
  },
) {
  await requireEditionOwnership(editionId)
  const edition = await editionsDb.fetchEditionById(editionId)
  if (!edition) return null

  // Передаём только пришедшие поля: updateEdition делает частичный UPDATE,
  // поэтому подставлять текущие значения не нужно. Раньше здесь не было
  // is_primary — и каждое сохранение настроек сбрасывало флаг в false.
  await editionsDb.updateEdition(editionId, {
    platform: data.platform,
    external_url: data.external_url,
    slug: data.slug,
    quality_tier: data.quality_tier,
  })

  if (data.cover_image !== undefined || data.annotation !== undefined) {
    const release = await releasesDb.fetchReleaseById(edition.release_id)
    if (release) {
      await releasesDb.updateRelease(release.id, {
        title: release.title,
        slug: release.slug,
        description: release.description,
        cover_image: data.cover_image ?? release.cover_image,
        genre: release.genre,
        release_date: release.release_date,
        isbn: release.isbn,
        authors: release.authors,
        annotation: data.annotation ?? release.annotation,
        editor_notes: release.editor_notes,
        status: release.status,
      })
    }
  }

  revalidatePath(`/studio/editions/${editionId}`)
  revalidatePath(`/studio/editions/${editionId}/setup`)
  revalidatePath('/studio/editions')
  revalidatePath(`/studio/releases/${edition.release_id}`)
}
