export type MediaDraftKind = 'audio' | 'comic'

export interface PendingAudioUpload {
  url: string
  pathname: string
  contentType?: string | null
  size?: number | null
}

export interface MediaDraft {
  version: 1
  kind: MediaDraftKind
  chapterId: string
  userId: string
  baseRevision: number
  savedAt: number
  title: string
  content: string
  pendingAudio?: PendingAudioUpload
}

export interface MediaDraftInput {
  kind: MediaDraftKind
  chapterId: string
  userId: string
  baseRevision: number
  title: string
  content: string
  pendingAudio?: PendingAudioUpload
}

const storageNames = ['localStorage', 'sessionStorage'] as const
// Переходы App Router сохраняют документ, даже если редактор размонтирован.
const memoryDrafts = new WeakMap<Window, Map<string, MediaDraft>>()

export function mediaDraftKey(kind: MediaDraftKind, userId: string, chapterId: string) {
  return `cf-media-draft:${kind}:${userId}:${chapterId}`
}

function storage(name: (typeof storageNames)[number]): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window[name]
  } catch {
    return null
  }
}

function parseDraft(raw: string | null, kind: MediaDraftKind, userId: string, chapterId: string): MediaDraft | null {
  if (!raw) return null
  try {
    const draft = JSON.parse(raw) as MediaDraft
    if (draft?.version !== 1 || draft.kind !== kind || draft.chapterId !== chapterId ||
        draft.userId !== userId || typeof draft.content !== 'string' ||
        !Number.isInteger(draft.baseRevision) || !Number.isFinite(draft.savedAt)) {
      return null
    }
    return draft
  } catch {
    return null
  }
}

/**
 * Пытается сохранить черновик в localStorage, затем в sessionStorage.
 * При отказе обоих хранилищ снимок остаётся в памяти текущего документа.
 * Вызывающий код предлагает копирование, пока persisted === false.
 */
export function storeMediaDraft(input: MediaDraftInput): { draft: MediaDraft; persisted: boolean } {
  const key = mediaDraftKey(input.kind, input.userId, input.chapterId)
  const stored = loadStoredDraft(key, input.kind, input.userId, input.chapterId)
  const memory = typeof window === 'undefined' ? undefined : memoryDrafts.get(window)
  const pending = memory?.get(key)
  const previous = pending && (!stored || pending.savedAt > stored.savedAt) ? pending : stored
  const unchanged = previous && previous.baseRevision === input.baseRevision && previous.title === input.title &&
    previous.content === input.content && JSON.stringify(previous.pendingAudio) === JSON.stringify(input.pendingAudio)
  if (unchanged && previous === stored && stored) {
    memory?.delete(key)
    return { draft: stored, persisted: true }
  }
  const draft: MediaDraft = unchanged && previous ? previous : {
    ...input,
    version: 1,
    savedAt: Math.max(Date.now(), (previous?.savedAt ?? 0) + 1),
  }
  for (const name of storageNames) {
    try {
      const target = storage(name)
      if (!target) continue
      target.setItem(key, JSON.stringify(draft))
      memory?.delete(key)
      return { draft, persisted: true }
    } catch {
      // Пробуем следующее хранилище.
    }
  }
  if (typeof window !== 'undefined') {
    const drafts = memory ?? new Map<string, MediaDraft>()
    drafts.set(key, draft)
    if (!memory) memoryDrafts.set(window, drafts)
  }
  return { draft, persisted: false }
}

export function saveMediaDraft(input: MediaDraftInput): boolean {
  return storeMediaDraft(input).persisted
}

export function loadMediaDraft(kind: MediaDraftKind, userId: string, chapterId: string): MediaDraft | null {
  const key = mediaDraftKey(kind, userId, chapterId)
  const stored = loadStoredDraft(key, kind, userId, chapterId)
  const pending = typeof window === 'undefined' ? undefined : memoryDrafts.get(window)?.get(key)
  return pending && (!stored || pending.savedAt > stored.savedAt) ? pending : stored
}

export function isMemoryMediaDraft(draft: MediaDraft): boolean {
  return typeof window !== 'undefined' &&
    memoryDrafts.get(window)?.get(mediaDraftKey(draft.kind, draft.userId, draft.chapterId)) === draft
}

function loadStoredDraft(key: string, kind: MediaDraftKind, userId: string, chapterId: string): MediaDraft | null {
  let latest: MediaDraft | null = null
  for (const name of storageNames) {
    try {
      const draft = parseDraft(storage(name)?.getItem(key) ?? null, kind, userId, chapterId)
      if (draft && (!latest || draft.savedAt > latest.savedAt)) latest = draft
    } catch {
      // Пробуем следующее хранилище.
    }
  }
  return latest
}

/** При подтверждении записи удаляем только этот снимок и более старые копии. */
export function removeMediaDraft(kind: MediaDraftKind, userId: string, chapterId: string, through?: number) {
  const key = mediaDraftKey(kind, userId, chapterId)
  const memory = typeof window === 'undefined' ? undefined : memoryDrafts.get(window)
  const pending = memory?.get(key)
  if (pending && (through === undefined || pending.savedAt <= through)) memory?.delete(key)
  for (const name of storageNames) {
    try {
      const target = storage(name)
      if (!target) continue
      if (through !== undefined) {
        const draft = parseDraft(target.getItem(key), kind, userId, chapterId)
        if (!draft || draft.savedAt > through) continue
      }
      target.removeItem(key)
    } catch {
      // Недоступное хранилище не мешает очистить второе.
    }
  }
}
