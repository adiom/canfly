import { test, expect } from '@playwright/test'
import { AutosaveQueue } from '@/lib/studio/autosave-queue'
import { readTextStream } from '@/lib/chat/read-text-stream'

test.describe('Studio autosave regressions', () => {
  test('flush saves the latest title, cover and content before navigation', async () => {
    const writes: object[] = []
    const queue = new AutosaveQueue({ title: 'Начало', coverImage: '', content: '' }, async draft => { writes.push(draft) })
    queue.update({ content: 'Последняя правка' })
    queue.update({ title: 'Новый заголовок' })
    queue.update({ coverImage: '/new-cover.png' })
    expect(queue.getStatus()).toBe('pending')
    await queue.flush()
    expect(writes).toEqual([{ title: 'Новый заголовок', coverImage: '/new-cover.png', content: 'Последняя правка' }])
    expect(queue.isDirty()).toBe(false)
  })

  test('edits during a slow write are saved in order', async () => {
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    const writes: string[] = []
    const queue = new AutosaveQueue({ content: 'initial' }, async draft => {
      writes.push(draft.content)
      if (writes.length === 1) await blocked
    })
    queue.update({ content: 'first' })
    const pending = queue.flush()
    queue.update({ content: 'latest' })
    release()
    await pending
    expect(writes).toEqual(['first', 'latest'])
    expect(queue.getStatus()).toBe('saved')
  })

  test('reverting an edit while saving still protects against closing the tab', async () => {
    let release!: () => void
    const blocked = new Promise<void>(resolve => { release = resolve })
    const writes: string[] = []
    const queue = new AutosaveQueue({ content: 'initial' }, async draft => {
      writes.push(draft.content)
      if (writes.length === 1) await blocked
    })
    queue.update({ content: 'changed' })
    const pending = queue.flush()
    queue.update({ content: 'initial' })
    expect(queue.isDirty()).toBe(true)
    release()
    await pending
    expect(writes).toEqual(['changed', 'initial'])
    expect(queue.isDirty()).toBe(false)
  })

  test('failed writes remain dirty and can be retried', async () => {
    let fail = true
    const queue = new AutosaveQueue({ content: '' }, async () => {
      if (fail) throw new Error('offline')
    })
    queue.update({ content: 'Не терять' })
    await expect(queue.flush()).rejects.toThrow('offline')
    expect(queue.isDirty()).toBe(true)
    expect(queue.getStatus()).toBe('error')
    fail = false
    await queue.flush()
    expect(queue.getStatus()).toBe('saved')
  })
})

test.describe('character chat streaming', () => {
  test('Cyrillic and emoji survive a stream split at every byte', async () => {
    const text = 'Привет! Ёжик читает 📖 — всё сохранено.'
    const bytes = new TextEncoder().encode(text)
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const byte of bytes) controller.enqueue(new Uint8Array([byte]))
        controller.close()
      },
    })
    let received = ''
    for await (const chunk of readTextStream(stream)) received += chunk
    expect(received).toBe(text)
    expect(stream.locked).toBe(false)
  })
})
