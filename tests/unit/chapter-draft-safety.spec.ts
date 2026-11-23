import { expect, test } from '@playwright/test'
import { AutosaveQueue } from '@/lib/studio/autosave-queue'
import { saveChapterAutosave } from '@/lib/studio/chapter-autosave'
import { settleLeaseRenewal } from '@/lib/studio/chapter-lease-renewal'
import { planLeaseReacquire } from '@/lib/studio/chapter-reacquire'
import type { ChapterLeaseView } from '@/lib/studio/chapter-lease'

const lease: ChapterLeaseView = {
  chapterId: 'chapter-1',
  sessionId: 'session-1234',
  token: 'a'.repeat(64),
  generation: 2,
  expiresAt: new Date().toISOString(),
}

test('C1: отсутствие lease-proof не подтверждает сохранение и оставляет очередь грязной', async () => {
  let serverCalls = 0
  const queue = new AutosaveQueue({ title: 'Глава', content: 'Старый текст' }, async (draft, patch) => {
    const outcome = await saveChapterAutosave(draft, patch, {
      revision: 3,
      proof: null,
      archive: () => true,
      update: async () => {
        serverCalls += 1
        throw new Error('Сервер не должен вызываться без lease')
      },
    })
    return outcome.result
  })

  queue.update({ content: 'Новый текст' })
  await expect(queue.flush()).rejects.toThrow(/Редактирование недоступно/)
  expect(serverCalls).toBe(0)
  expect(queue.getStatus()).toBe('error')
  expect(queue.isDirty()).toBe(true)
  expect(queue.getSavedValue()).toEqual({ title: 'Глава', content: 'Старый текст' })
})

test('C2: ошибка сети при продлении lease не считается успешным продлением', async () => {
  await expect(settleLeaseRenewal(async () => {
    throw new Error('offline')
  })).resolves.toEqual({ status: 'degraded' })

  await expect(settleLeaseRenewal(async () => ({
    ok: false,
    code: 'error',
    message: 'auth expired',
  }))).resolves.toEqual({ status: 'degraded' })

  await expect(settleLeaseRenewal(async () => ({
    ok: false,
    code: 'lease-lost',
    message: 'lost',
  }))).resolves.toEqual({ status: 'lost' })

  await expect(settleLeaseRenewal(async () => ({ ok: true, lease })))
    .resolves.toEqual({ status: 'ok', lease })
})

test('H1: план повторного захвата сохраняет черновик при той же ревизии и перечитывает при новой', () => {
  expect(planLeaseReacquire({ dirty: true, currentRevision: 4, freshRevision: 4 })).toBe('retry')
  expect(planLeaseReacquire({ dirty: true, currentRevision: 4, freshRevision: 5 })).toBe('reload')
  expect(planLeaseReacquire({ dirty: false, currentRevision: 4, freshRevision: 4 })).toBe('none')
  expect(planLeaseReacquire({ dirty: false, currentRevision: 4, freshRevision: 5 })).toBe('reload')
})

test('H1: неудачный повтор сохраняет ошибку и не публикует ложное «Сохранено»', async () => {
  const queue = new AutosaveQueue({ title: 'Глава', content: 'Старый текст' }, async (draft, patch) => {
    const outcome = await saveChapterAutosave(draft, patch, {
      revision: 4,
      proof: { sessionId: 'session-1234', token: 'a'.repeat(64), generation: 2 },
      archive: () => true,
      update: async () => ({ ok: false, code: 'lease-lost', message: 'lease lost' }),
    })
    return outcome.result
  })

  queue.update({ content: 'Правка после потери lease' })
  await expect(queue.flush()).rejects.toThrow(/lease lost/)
  expect(queue.getStatus()).toBe('error')
  expect(queue.isDirty()).toBe(true)
})
