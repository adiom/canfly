import { test, expect } from '@playwright/test'
import { MockLanguageModelV3 } from 'ai/test'
import { simulateReadableStream } from 'ai'
import { mergeCharacterAiRuntimeConfig } from '../../lib/ai/character-chat/config'
import { createCharacterReplyStream } from '../../lib/ai/character-chat/generate'
import { deferred } from './fixtures/character-chat'

type ModelStreamPart = Awaited<ReturnType<MockLanguageModelV3['doStream']>>['stream'] extends ReadableStream<infer Part> ? Part : never
type StreamInput = Parameters<typeof createCharacterReplyStream>[0]

const finish: ModelStreamPart = {
  type: 'finish',
  finishReason: { unified: 'stop', raw: 'stop' },
  usage: {
    inputTokens: { total: 3, noCache: 3, cacheRead: undefined, cacheWrite: undefined },
    outputTokens: { total: 4, text: 4, reasoning: undefined },
  },
}

function parts(text = 'Привет 🌿'): ModelStreamPart[] {
  return [
    { type: 'stream-start', warnings: [] },
    { type: 'text-start', id: 'text' },
    { type: 'text-delta', id: 'text', delta: text },
    { type: 'text-end', id: 'text' },
    finish,
  ]
}

function modelWithParts(chunks: ModelStreamPart[]) {
  return new MockLanguageModelV3({
    doStream: async () => ({ stream: simulateReadableStream({ chunks, initialDelayInMs: 0, chunkDelayInMs: 0 }) }),
  })
}

function openModel(text?: string) {
  let signal: AbortSignal | undefined
  const model = new MockLanguageModelV3({
    doStream: async (options) => {
      signal = options.abortSignal
      return {
        stream: new ReadableStream<ModelStreamPart>({
          start(controller) {
            controller.enqueue({ type: 'stream-start', warnings: [] })
            controller.enqueue({ type: 'text-start', id: 'text' })
            if (text) controller.enqueue({ type: 'text-delta', id: 'text', delta: text })
            if (signal?.aborted) controller.error(signal.reason)
            else signal?.addEventListener('abort', () => controller.error(signal?.reason), { once: true })
          },
        }),
      }
    },
  })
  return { model, getSignal: () => signal }
}

function harness(model: MockLanguageModelV3, overrides: Partial<Omit<StreamInput, 'model'>> = {}) {
  const saved: Array<{ text: string; metadata: Record<string, unknown> }> = []
  const failed: string[] = []
  const diagnostics: string[] = []
  const stream = createCharacterReplyStream({
    model,
    config: { ...mergeCharacterAiRuntimeConfig(null), totalTimeoutMs: 1000, chunkTimeoutMs: 500 },
    system: 'Тестовая инструкция, не литературный канон',
    messages: [{ role: 'user', content: 'Привет' }],
    signal: new AbortController().signal,
    metadata: { settingsSource: 'defaults', settingsRevision: null, canon: null },
    save: async (text, metadata) => { saved.push({ text, metadata }); return true },
    fail: async (code) => { failed.push(code) },
    diagnose: (event) => { diagnostics.push(event) },
    ...overrides,
  })
  return { stream, saved, failed, diagnostics }
}

test.describe('серверный полный AI-поток с mock LanguageModel', () => {
  test('успешный поток — чистый UTF-8 текст, запись и usage до EOF', async () => {
    const model = modelWithParts(parts())
    const { stream, saved, failed } = harness(model)
    expect(await new Response(stream).text()).toBe('Привет 🌿')
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ text: 'Привет 🌿', metadata: { source: 'model', settingsSource: 'defaults', usage: { inputTokens: 3, outputTokens: 4, totalTokens: 7 } } })
    expect(failed).toEqual([])
    expect(model.doStreamCalls).toHaveLength(1)
    expect(model.doStreamCalls[0].maxOutputTokens).toBe(1024)
  })

  test('медленная финальная запись удерживает EOF без заголовка/маркера статуса', async () => {
    const saveStarted = deferred<void>()
    const save = deferred<boolean>()
    const { stream } = harness(modelWithParts(parts('Ответ')), { save: async () => { saveStarted.resolve(); return save.promise } })
    const reader = stream.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('Ответ')
    await saveStarted.promise
    let ended = false
    const eof = reader.read().then((result) => { ended = true; return result })
    await Promise.resolve()
    expect(ended).toBe(false)
    save.resolve(true)
    expect((await eof).done).toBe(true)
    reader.releaseLock()
  })

  test('пустой ответ не записывается как персонаж и поток завершается ошибкой', async () => {
    const { stream, saved, failed } = harness(modelWithParts(parts('   ')))
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toEqual(['empty_response'])
  })

  test('ошибка до первого токена наблюдается без скрытых SDK retries', async () => {
    const model = new MockLanguageModelV3({ doStream: async () => { throw new Error('provider down') } })
    const { stream, saved, failed } = harness(model)
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toHaveLength(1)
    expect(model.doStreamCalls).toHaveLength(1)
  })

  test('error part посередине текста не превращается в нормальный текстовый EOF', async () => {
    const model = new MockLanguageModelV3({
      doStream: async () => ({
        stream: simulateReadableStream<ModelStreamPart>({
          chunks: [
            { type: 'stream-start', warnings: [] },
            { type: 'text-start', id: 'text' },
            { type: 'text-delta', id: 'text', delta: 'Дошедший фрагмент' },
            { type: 'error', error: new Error('PRIVATE_PROVIDER_ERROR') },
          ],
          initialDelayInMs: 0,
          chunkDelayInMs: 5,
        }),
      }),
    })
    const { stream, saved, failed } = harness(model)
    const reader = stream.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('Дошедший фрагмент')
    await expect(reader.read()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toHaveLength(1)
    reader.releaseLock()
  })

  test('таймаут SDK фиксируется как timeout, не как клиентская отмена', async () => {
    const { model } = openModel()
    const { stream, saved, failed } = harness(model, { config: { ...mergeCharacterAiRuntimeConfig(null), totalTimeoutMs: 40, chunkTimeoutMs: 20 } })
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toEqual(['timeout'])
  })

  test('отмена request.signal до токена подтверждается только после записи fail', async () => {
    const { model } = openModel()
    const abort = new AbortController()
    const { stream, saved, failed } = harness(model, { signal: abort.signal })
    abort.abort()
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toEqual(['aborted'])
  })

  test('отмена после токена не сохраняет частичный ответ', async () => {
    const { model } = openModel('Часть 🌿')
    const abort = new AbortController()
    const { stream, saved, failed } = harness(model, { signal: abort.signal })
    const reader = stream.getReader()
    expect(new TextDecoder().decode((await reader.read()).value)).toBe('Часть 🌿')
    abort.abort()
    await expect(reader.read()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toEqual(['aborted'])
    reader.releaseLock()
  })

  test('cancel исходящего потока передаётся модели и дожидается серверной записи', async () => {
    const { model, getSignal } = openModel('Часть')
    const recorded = deferred<void>()
    const finishRecording = deferred<void>()
    const { stream, saved } = harness(model, { fail: async (code) => { expect(code).toBe('aborted'); recorded.resolve(); await finishRecording.promise } })
    const reader = stream.getReader()
    await reader.read()
    const cancellation = reader.cancel()
    await recorded.promise
    expect(getSignal()?.aborted).toBe(true)
    expect(saved).toEqual([])
    finishRecording.resolve()
    await cancellation
    reader.releaseLock()
  })

  test('сбой финальной записи не отдаёт успешный EOF и помечает save_failed', async () => {
    const { stream, failed } = harness(modelWithParts(parts()), { save: async () => { throw new Error('DB down') } })
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_saved')
    expect(failed).toEqual(['save_failed'])
  })

  test('отвергнутая поздняя запись (null/false) тоже не становится успехом', async () => {
    const { stream, failed } = harness(modelWithParts(parts()), { save: async () => false })
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_saved')
    expect(failed).toEqual(['save_failed'])
  })

  test('ошибка записи статуса не маскируется успешным окончанием', async () => {
    const { stream, diagnostics } = harness(modelWithParts(parts('')), { fail: async () => { throw new Error('DB down') } })
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_completed')
    expect(diagnostics).toContain('failure_not_persisted')
  })

  test('обрезанный max-output ответ не сохраняется как окончательный', async () => {
    const chunks = parts('Обрезанное предложение')
    chunks[chunks.length - 1] = { ...finish, type: 'finish', finishReason: { unified: 'length', raw: 'length' } }
    const { stream, saved, failed } = harness(modelWithParts(chunks))
    await expect(new Response(stream).text()).rejects.toThrow('character_turn_not_completed')
    expect(saved).toEqual([])
    expect(failed).toEqual(['incomplete_response'])
  })

  test('канон/settings metadata передаются в save без смены текстового транспорта', async () => {
    const canon = { manifestId: 'test-manifest', contentHash: 'hash' }
    const { stream, saved } = harness(modelWithParts(parts()), { metadata: { canon, settingsRevision: 3 } })
    expect(await new Response(stream).text()).toBe('Привет 🌿')
    expect(saved[0].metadata).toMatchObject({ canon, settingsRevision: 3, finishReason: 'stop' })
  })
})
