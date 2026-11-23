export type ChapterDraft = { title: string; content: string }

export type ArchivedChapterDraft = ChapterDraft & {
  key: string
  revision: number
  archivedAt: number
}

const storageNames = ['localStorage', 'sessionStorage'] as const

function readDrafts(storage: Storage, prefix: string): ArchivedChapterDraft[] {
  const drafts: ArchivedChapterDraft[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (!key?.startsWith(prefix)) continue
    try {
      const draft = JSON.parse(storage.getItem(key) ?? 'null') as Omit<ArchivedChapterDraft, 'key'> | null
      if (draft && typeof draft.title === 'string' && typeof draft.content === 'string' &&
          Number.isInteger(draft.revision) && Number.isFinite(draft.archivedAt)) {
        drafts.push({ ...draft, key })
      }
    } catch { /* A damaged record must not hide other drafts. */ }
  }
  return drafts
}

export function listArchivedChapterDrafts(prefix: string) {
  return storageNames.flatMap(name => {
    try { return readDrafts(window[name], prefix) } catch { return [] }
  }).sort((a, b) => b.archivedAt - a.archivedAt)
}

export function archiveChapterDraft(prefix: string, draft: ChapterDraft, revision: number) {
  if (listArchivedChapterDrafts(prefix).some(saved =>
    saved.revision === revision && saved.title === draft.title && saved.content === draft.content,
  )) return true

  for (const name of storageNames) {
    try {
      const key = `${prefix}${crypto.randomUUID()}`
      window[name].setItem(key, JSON.stringify({ ...draft, revision, archivedAt: Date.now() }))
      return true
    } catch { /* Keep the source draft if neither storage is writable. */ }
  }
  return false
}

export function removeArchivedChapterDraft(key: string) {
  for (const name of storageNames) {
    try { window[name].removeItem(key) } catch { /* Read-only storage can retain its copy. */ }
  }
}
