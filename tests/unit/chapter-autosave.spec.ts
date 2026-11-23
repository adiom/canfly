import { expect, test } from '@playwright/test'
import { AutosaveQueue } from '@/lib/studio/autosave-queue'
import { chapterUpdateSchema } from '@/lib/schemas/studio'

test('title updates expose only the changed field and retain the full snapshot for existing callers', async () => {
  const saveCalls: unknown[][] = []
  const queue = new AutosaveQueue({ title: 'Original', content: '<p>Text</p>' }, async (...args) => {
    saveCalls.push(args)
  })

  queue.update({ title: 'Renamed' })
  await queue.flush()
  expect(saveCalls).toEqual([[{ title: 'Renamed', content: '<p>Text</p>' }, { title: 'Renamed' }]])
})

test('patches follow the last acknowledged write, including a revert during a write', async () => {
  let release!: () => void
  const blocked = new Promise<void>(resolve => { release = resolve })
  const patches: object[] = []
  const queue = new AutosaveQueue({ title: 'Original', content: 'Text' }, async (_draft, patch) => {
    patches.push(patch)
    if (patches.length === 1) await blocked
  })

  queue.update({ content: 'New text' })
  const pending = queue.flush()
  queue.update({ content: 'Text', title: 'Renamed' })
  release()
  await pending
  expect(patches).toEqual([{ content: 'New text' }, { title: 'Renamed', content: 'Text' }])
})

test('rejects empty titles while accepting omitted titles and empty content', () => {
  for (const title of ['', '   ', null]) {
    expect(chapterUpdateSchema.safeParse({ title }).success).toBe(false)
  }
  expect(chapterUpdateSchema.parse({ content: '' })).toEqual({ content: '' })
  expect(chapterUpdateSchema.parse({ title: '  Глава  ' })).toEqual({ title: 'Глава' })
})

test('acknowledges saved text while retaining the invalid title for a later retry', async () => {
  const writes: object[] = []
  const queue = new AutosaveQueue({ title: 'Original', content: 'Text' }, async (_value, patch) => {
    writes.push(patch)
    if (patch.title === '') return {
      acknowledged: { content: patch.content },
      error: new Error('Invalid title'),
    }
  })
  queue.update({ title: '', content: 'New text' })
  await expect(queue.flush()).rejects.toThrow('Invalid title')
  expect(queue.getSavedValue()).toEqual({ title: 'Original', content: 'New text' })
  expect(queue.getValue()).toEqual({ title: '', content: 'New text' })
  expect(queue.getStatus()).toBe('error')

  queue.update({ title: 'Corrected' })
  await queue.flush()
  expect(writes).toEqual([{ title: '', content: 'New text' }, { title: 'Corrected' }])
  expect(queue.isDirty()).toBe(false)
})
