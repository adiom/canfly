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
 * `null` означает, что оба хранилища недоступны/переполнены: вызывающий код
 * обязан сохранить текст в памяти и предложить копирование.
 */
export function storeMediaDraft(input: MediaDraftInput): MediaDraft | null {
  const previous = loadMediaDraft(input.kind, input.userId, input.chapterId)
  if (previous && previous.baseRevision === input.baseRevision && previous.title === input.title &&
      previous.content === input.content && JSON.stringify(previous.pendingAudio) === JSON.stringify(input.pendingAudio)) {
    return previous
  }
  const draft: MediaDraft = {
    ...input,
    version: 1,
    savedAt: Math.max(Date.now(), (previous?.savedAt ?? 0) + 1),
  }
  const key = mediaDraftKey(input.kind, input.userId, input.chapterId)
  for (const name of storageNames) {
    try {
      const target = storage(name)
      if (!target) continue
      target.setItem(key, JSON.stringify(draft))
      return draft
    } catch {
      // Пробуем следующее хранилище.
    }
  }
  return null
}

export function saveMediaDraft(input: MediaDraftInput): boolean {
  return storeMediaDraft(input) !== null
}

export function loadMediaDraft(kind: MediaDraftKind, userId: string, chapterId: string): MediaDraft | null {
  const key = mediaDraftKey(kind, userId, chapterId)
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
