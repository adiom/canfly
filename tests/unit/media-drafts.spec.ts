import { expect, test } from '@playwright/test'
import {
  loadMediaDraft,
  mediaDraftKey,
  removeMediaDraft,
  saveMediaDraft,
  storeMediaDraft,
  type MediaDraftKind,
} from '@/lib/studio/media-drafts'

class FakeStorage {
  private data = new Map<string, string>()
  constructor(public fail = false) {}
  get length() { return this.data.size }
  key(index: number) { return [...this.data.keys()][index] ?? null }
  getItem(key: string) { return this.data.get(key) ?? null }
  setItem(key: string, value: string) {
    if (this.fail) throw new DOMException('QuotaExceededError', 'QuotaExceededError')
    this.data.set(key, value)
  }
  removeItem(key: string) { this.data.delete(key) }
  clear() { this.data.clear() }
}

function installWindow(local: FakeStorage, session: FakeStorage) {
  ;(globalThis as unknown as { window: unknown }).window = { localStorage: local, sessionStorage: session }
}

test.beforeEach(() => installWindow(new FakeStorage(), new FakeStorage()))
test.afterEach(() => {
  delete (globalThis as unknown as { window?: unknown }).window
})

const base = {
  kind: 'audio' as MediaDraftKind,
  chapterId: 'chapter-1',
  userId: 'user-1',
  baseRevision: 3,
  title: 'Черновик',
  content: '{"audio_metadata":{}}',
}

test('сохраняет и читает медиачерновик между «перезагрузками»', () => {
  expect(saveMediaDraft(base)).toBe(true)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')).toMatchObject({
    ...base,
    version: 1,
  })
  expect(mediaDraftKey('audio', 'user-1', 'chapter-1')).toContain('chapter-1')
})

test('переходит на sessionStorage, если localStorage переполнен', () => {
  installWindow(new FakeStorage(true), new FakeStorage())
  expect(saveMediaDraft(base)).toBe(true)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')).toMatchObject(base)
})

test('возвращает false, если недоступны оба хранилища', () => {
  installWindow(new FakeStorage(true), new FakeStorage(true))
  expect(saveMediaDraft(base)).toBe(false)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')).toBeNull()
})

test('восстанавливает новый fallback, даже если старая копия осталась в localStorage', () => {
  const local = new FakeStorage()
  const session = new FakeStorage()
  installWindow(local, session)
  expect(saveMediaDraft(base)).toBe(true)
  local.fail = true
  expect(saveMediaDraft({ ...base, title: 'Новая правка' })).toBe(true)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')?.title).toBe('Новая правка')
  local.fail = false
  expect(saveMediaDraft({ ...base, title: 'Последняя правка' })).toBe(true)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')?.title).toBe('Последняя правка')
})

test('подтверждение старого снимка не удаляет более новую правку', () => {
  const first = storeMediaDraft(base)
  expect(first).not.toBeNull()
  const latest = storeMediaDraft({ ...base, title: 'Новая правка' })
  expect(storeMediaDraft({ ...base, title: 'Новая правка' })).toEqual(latest)
  removeMediaDraft('audio', 'user-1', 'chapter-1', first!.savedAt)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')).toEqual(latest)
})

test('удаляет черновик и сохраняет pending audio', () => {
  const pendingAudio = {
    url: 'https://blob.example/audio.mp3',
    pathname: 'audio/chapters/chapter-1/audio.mp3',
    contentType: 'audio/mpeg',
    size: 1024,
  }
  expect(saveMediaDraft({ ...base, pendingAudio })).toBe(true)
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')?.pendingAudio).toEqual(pendingAudio)
  removeMediaDraft('audio', 'user-1', 'chapter-1')
  expect(loadMediaDraft('audio', 'user-1', 'chapter-1')).toBeNull()
})
