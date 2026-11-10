import { test, expect } from '@playwright/test'
import { CharacterChatClient } from '../../lib/chat/character-chat-client'
import {
  canRetryCharacterTurn,
  canStartCharacterTurn,
  characterLiveStatus,
  mergeCharacterMessages,
  parseCharacterTurn,
  readCharacterChatError,
  readCharacterMessages,
  retryAfterTimestamp,
  shouldSendCharacterChatKey,
  shouldStickToChatBottom,
} from '../../lib/chat/character-chat-state'
import { readTextStream } from '../../lib/chat/read-text-stream'
import { ATTEMPT_ID, REQUEST_ID, deferred, turnSnapshot } from './fixtures/character-chat'

type ClientOptions = ConstructorParameters<typeof CharacterChatClient>[0]
type Backend = ClientOptions['backend']

function harness(backend: Partial<Backend> = {}, options: Partial<Omit<ClientOptions, 'backend'>> = {}) {
  const sent: Array<Parameters<Backend['send']>[0]> = []
  const events: string[] = []
  const remembered: Array<string | null> = []
  const client = new CharacterChatClient({
    backend: {
      send: async (input, signal) => {
        sent.push(input)
        events.push('POST')
        return backend.send ? backend.send(input, signal) : new Response('Черновик по сети')
      },
      getTurn: async (requestId, signal) => {
        events.push('GET')
        return backend.getTurn ? backend.getTurn(requestId, signal) : turnSnapshot('completed')
      },
      getHistory: backend.getHistory ?? (async () => ({ messages: [], lastTurn: null })),
    },
    canGenerate: true,
    newRequestId: () => REQUEST_ID,
    remember: (id) => remembered.push(id),
    delay: async () => undefined,
    maxChecks: 3,
    ...options,
  })
  return { client, sent, events, remembered }
}

function openTextStream(text?: string) {
  let source!: ReadableStreamDefaultController<Uint8Array>
  let cancelled = false
  const stream = new ReadableStream<Uint8Array>({
    start(controller) { source = controller; if (text) controller.enqueue(new TextEncoder().encode(text)) },
    cancel() { cancelled = true },
  })
  return { stream, source, wasCancelled: () => cancelled }
}

test.describe('реальный клиентский workflow с mock fetch', () => {
  test('EOF ещё не успех: canonical GET заменяет черновик id/текстом БД', async () => {
    const gate = deferred<ReturnType<typeof turnSnapshot>>()
    const checking = deferred<void>()
    const { client, sent, remembered } = harness({ getTurn: async () => { checking.resolve(); return gate.promise } })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await checking.promise
    expect(client.getState().turn).toMatchObject({ phase: 'confirming', partialText: 'Черновик по сети' })
    expect(client.getState().messages).toEqual([])
    gate.resolve(turnSnapshot('completed'))
    await run
    expect(client.getState().turn?.phase).toBe('completed')
    expect(client.getState().messages.map((message) => message.content)).toEqual(['Привет, Соня', 'Сохранённый ответ 🌿'])
    expect(sent).toHaveLength(1)
    expect(remembered).toEqual([REQUEST_ID, null])
  })

  test('полный текст потока и неизвестный серверный статус не становятся окончательным ответом', async () => {
    const { client, sent } = harness({ getTurn: async () => turnSnapshot('unknown') })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(client.getState().turn?.phase).toBe('unsaved')
    expect(client.getState().turn?.partialText).toBe('Черновик по сети')
    expect(client.getState().messages.map((message) => message.role)).toEqual(['user'])
    expect(canStartCharacterTurn(client.getState())).toBe(false)
    await client.retry()
    expect(sent).toHaveLength(1)
  })

  test('ожидание сохранения ограничено; pending не разрешает автоматический POST', async () => {
    const { client, sent, events } = harness({ getTurn: async () => turnSnapshot('pending') })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(events.filter((event) => event === 'GET')).toHaveLength(3)
    expect(client.getState().turn?.phase).toBe('unsaved')
    await client.retry()
    expect(sent).toHaveLength(1)
  })

  test('двойной submit до первого await не отправляет второй HTTP-запрос', async () => {
    const gate = deferred<Response>()
    const { client, sent } = harness({ send: () => gate.promise })
    client.setInput('Привет, Соня')
    const first = client.submit()
    client.setInput('Другой вопрос')
    await client.submit()
    expect(sent).toHaveLength(1)
    gate.resolve(new Response('Ответ'))
    await first
    expect(client.getState().input).toBe('Другой вопрос')
  })

  test('Stop до первого токена означает stopping до серверного подтверждения', async () => {
    const stream = openTextStream()
    const started = deferred<void>()
    const checked = deferred<void>()
    const finish = deferred<void>()
    let checks = 0
    const { client, sent } = harness({
      send: async () => { started.resolve(); return new Response(stream.stream) },
      getTurn: async () => { checks += 1; checked.resolve(); return turnSnapshot(checks === 1 ? 'pending' : 'cancelled') },
    }, { delay: () => finish.promise })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await started.promise
    client.stop()
    await checked.promise
    expect(client.getState().turn?.phase).toBe('stopping')
    expect(characterLiveStatus(client.getState().turn)).toContain('Проверяем статус')
    expect(client.getState().input).toBe('Привет, Соня')
    finish.resolve()
    await run
    expect(client.getState().turn?.phase).toBe('cancelled')
    expect(client.getState().messages.map((message) => message.role)).toEqual(['user'])
    expect(sent).toHaveLength(1)
    expect(stream.wasCancelled()).toBe(true)
  })

  test('Stop после первого токена сохраняет частичный текст только как черновик', async () => {
    const stream = openTextStream('Часть ответа 🌿')
    const streamed = deferred<void>()
    const { client } = harness({ send: async () => new Response(stream.stream), getTurn: async () => turnSnapshot('cancelled') })
    client.subscribe(() => { if (client.getState().turn?.partialText) streamed.resolve() })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await streamed.promise
    client.stop()
    await run
    expect(client.getState().turn).toMatchObject({ phase: 'cancelled', partialText: 'Часть ответа 🌿' })
    expect(client.getState().messages.some((message) => message.role === 'assistant')).toBe(false)
  })

  test('обрыв GET после Stop не обещает серверную отмену и не запускает повтор', async () => {
    const stream = openTextStream()
    const started = deferred<void>()
    const { client, sent } = harness({
      send: async () => { started.resolve(); return new Response(stream.stream) },
      getTurn: async () => { throw new Error('network') },
    })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await started.promise
    client.stop()
    await run
    expect(client.getState().turn?.phase).toBe('unsaved')
    expect(characterLiveStatus(client.getState().turn)).toContain('не подтверждены')
    await client.retry()
    expect(sent).toHaveLength(1)
  })

  test('сервер успел сохранить во время Stop — показываем completed, не cancelled', async () => {
    const stream = openTextStream('Дошедшая часть')
    const streamed = deferred<void>()
    const { client } = harness({ send: async () => new Response(stream.stream) })
    client.subscribe(() => { if (client.getState().turn?.partialText) streamed.resolve() })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await streamed.promise
    client.stop()
    await run
    expect(client.getState().turn?.phase).toBe('completed')
    expect(characterLiveStatus(client.getState().turn)).toContain('сервер уже сохранил')
  })

  test('ошибка mid-stream оставляет фрагмент, а сбой записи — unsaved', async () => {
    const stream = openTextStream('Дошедший фрагмент')
    const streamed = deferred<void>()
    const { client } = harness({ send: async () => new Response(stream.stream), getTurn: async () => turnSnapshot('failed', { failureReason: 'save_failed' }) })
    client.subscribe(() => { if (client.getState().turn?.partialText) streamed.resolve() })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await streamed.promise
    stream.source.error(new Error('stream failed'))
    await run
    expect(client.getState().turn).toMatchObject({ phase: 'unsaved', partialText: 'Дошедший фрагмент' })
    expect(client.getState().messages.some((message) => message.role === 'assistant')).toBe(false)
    expect(client.getState().input).toBe('Привет, Соня')
  })

  test('пустой ответ — отдельная ошибка, не реплика персонажа', async () => {
    const { client } = harness({ send: async () => new Response(''), getTurn: async () => turnSnapshot('failed', { failureReason: 'empty_response' }) })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(client.getState().turn?.phase).toBe('failed')
    expect(client.getState().error?.message).toContain('без ответа')
    expect(client.getState().messages.some((message) => message.role === 'assistant')).toBe(false)
  })

  test('retry сначала GET: уже сохранённый ответ возвращается без POST', async () => {
    const { client, sent, events } = harness({}, { lastTurn: turnSnapshot('failed') })
    await client.retry()
    expect(events).toEqual(['GET'])
    expect(sent).toEqual([])
    expect(client.getState().turn?.phase).toBe('completed')
  })

  test('явный retry failed использует тот же requestId/token и одну user-реплику', async () => {
    let checks = 0
    const { client, sent, events } = harness({ getTurn: async () => turnSnapshot(++checks === 1 ? 'failed' : 'completed') }, { lastTurn: turnSnapshot('failed') })
    await client.retry()
    expect(events).toEqual(['GET', 'POST', 'GET'])
    expect(sent).toEqual([{ message: 'Привет, Соня', requestId: REQUEST_ID, retryAttemptId: ATTEMPT_ID }])
    expect(client.getState().messages.filter((message) => message.role === 'user')).toHaveLength(1)
    expect(client.getState().turn?.retried).toBe(true)
  })

  test('GET-ошибка перед retry блокирует POST, даже если раньше был известен failed', async () => {
    const { client, sent } = harness({ getTurn: async () => { throw new Error('offline') } }, { lastTurn: turnSnapshot('failed') })
    await client.retry()
    expect(sent).toEqual([])
    expect(client.getState().turn?.phase).toBe('unsaved')
    expect(canRetryCharacterTurn(client.getState().turn)).toBe(false)
    expect(canStartCharacterTurn(client.getState())).toBe(false)
  })

  test('not_found допускает только явную повторную отправку после новой сверки', async () => {
    let posts = 0
    const { client, sent } = harness({
      send: async () => ++posts === 1 ? new Response('{}', { status: 503 }) : new Response('Ответ'),
      getTurn: async () => turnSnapshot(posts === 1 ? 'not_found' : 'completed'),
    })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(sent).toHaveLength(1)
    expect(client.getState().messages).toEqual([])
    await client.retry()
    expect(sent.map((input) => input.requestId)).toEqual([REQUEST_ID, REQUEST_ID])
    expect(client.getState().messages.filter((message) => message.role === 'user')).toHaveLength(1)
  })

  test('reload по requestId синхронизируется только GET; canonical сообщения не дублируются', async () => {
    const snapshot = turnSnapshot('completed')
    const { client, sent } = harness({}, { messages: readCharacterMessages([snapshot.userMessage, snapshot.assistantMessage]) })
    await client.check(REQUEST_ID)
    expect(sent).toEqual([])
    expect(client.getState().messages).toHaveLength(2)
    expect(client.getState().turn?.phase).toBe('completed')
  })

  test('online/pageshow не перепроверяет и не понижает уже подтверждённый completed', async () => {
    let checks = 0
    const { client, events } = harness({ getTurn: async () => {
      if (++checks > 1) throw new Error('Связь снова прервалась')
      return turnSnapshot('completed')
    } })
    await client.check(REQUEST_ID)
    await client.check()
    expect(events).toEqual(['GET'])
    expect(client.getState().turn?.phase).toBe('completed')
    expect(client.getState().error).toBeNull()
  })

  test('запоздавшая история не затирает ход, завершившийся после начала GET', async () => {
    const history = deferred<Awaited<ReturnType<Backend['getHistory']>>>()
    const { client } = harness({ getHistory: () => history.promise })
    const loading = client.reloadHistory()
    expect(client.getState().historyStatus).toBe('loading')
    // Завершение другого текущего GET по requestId может обогнать историю.
    await client.check(REQUEST_ID)
    history.resolve({ messages: [{ id: 'old', role: 'user', content: 'Старая реплика' }], lastTurn: null })
    await loading
    expect(client.getState().messages.map((message) => message.content)).toContain('Сохранённый ответ 🌿')
    expect(client.getState().messages).toHaveLength(3)
  })

  test('ошибка истории не выглядит пустой историей; до загрузки отправка запрещена', async () => {
    const history = deferred<Awaited<ReturnType<Backend['getHistory']>>>()
    const { client, sent } = harness({ getHistory: () => history.promise }, { historyError: 'Не удалось загрузить историю' })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(sent).toEqual([])
    const loading = client.reloadHistory()
    await client.submit()
    expect(sent).toEqual([])
    history.resolve({ messages: [], lastTurn: null })
    await loading
    await client.submit()
    expect(sent).toHaveLength(1)
  })

  test('поздний pending истории не отменяет подтверждённый completed', async () => {
    const history = deferred<Awaited<ReturnType<Backend['getHistory']>>>()
    const { client } = harness({ getHistory: () => history.promise })
    const loading = client.reloadHistory()
    await client.check(REQUEST_ID)
    history.resolve({ messages: readCharacterMessages([turnSnapshot('pending').userMessage]), lastTurn: turnSnapshot('pending') })
    await loading
    expect(client.getState().turn?.phase).toBe('completed')
    expect(client.getState().messages.filter((message) => message.role === 'assistant')).toHaveLength(1)
  })

  test('история во время streaming привязывает сохранённый вопрос без дублирования', async () => {
    const stream = openTextStream('Фрагмент')
    const streamed = deferred<void>()
    const pending = turnSnapshot('pending')
    const { client } = harness({
      send: async () => new Response(stream.stream),
      getHistory: async () => ({ messages: readCharacterMessages([pending.userMessage]), lastTurn: pending }),
    })
    client.subscribe(() => { if (client.getState().turn?.partialText) streamed.resolve() })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await streamed.promise
    await client.reloadHistory()
    expect(client.getState().turn?.phase).toBe('streaming')
    expect(client.getState().turn?.snapshot?.userMessage?.id).toBe(pending.userMessage?.id)
    stream.source.close()
    await run
    expect(client.getState().messages.filter((message) => message.role === 'user')).toHaveLength(1)
  })

  test('подтверждение из GET истории не возвращается в streaming от поздних чанков', async () => {
    const stream = openTextStream('Фрагмент')
    const streamed = deferred<void>()
    const completed = turnSnapshot('completed')
    const { client } = harness({
      send: async () => new Response(stream.stream),
      getHistory: async () => ({ messages: readCharacterMessages([completed.userMessage, completed.assistantMessage]), lastTurn: completed }),
    })
    client.subscribe(() => { if (client.getState().turn?.partialText) streamed.resolve() })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await streamed.promise
    await client.reloadHistory()
    stream.source.enqueue(new TextEncoder().encode('Лишний хвост'))
    stream.source.close()
    await run
    expect(client.getState().turn).toMatchObject({ phase: 'completed', partialText: '' })
    expect(client.getState().messages.filter((message) => message.role === 'assistant')).toHaveLength(1)
  })

  test('поздний обрыв GET-сверки не отменяет уже подтверждённый ответ из истории', async () => {
    const gate = deferred<ReturnType<typeof turnSnapshot>>()
    const completed = turnSnapshot('completed')
    const { client } = harness({
      getTurn: () => gate.promise,
      getHistory: async () => ({ messages: readCharacterMessages([completed.userMessage, completed.assistantMessage]), lastTurn: completed }),
    })
    const checking = client.check(REQUEST_ID)
    await client.reloadHistory()
    gate.reject(new Error('late network error'))
    await checking
    expect(client.getState().turn?.phase).toBe('completed')
    expect(client.getState().error).toBeNull()
  })

  test('две вкладки: HTTP 409 не подтверждает запись локального вопроса', async () => {
    const { client, sent } = harness({
      send: async () => Response.json({ reason: 'turn_in_progress' }, { status: 409 }),
      getTurn: async () => turnSnapshot('not_found'),
    })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(client.getState().messages).toEqual([])
    expect(client.getState().error?.message).toContain('другой вкладке')
    expect(sent).toHaveLength(1)
  })

  test('401/403 не разрешают отправку после отказа сервера', async () => {
    for (const status of [401, 403]) {
      const { client, sent } = harness({ send: async () => Response.json({}, { status }), getTurn: async () => turnSnapshot('not_found') })
      client.setInput('Привет, Соня')
      await client.submit()
      await client.submit()
      expect(sent).toHaveLength(1)
      expect(canStartCharacterTurn(client.getState())).toBe(false)
    }
  })

  test('Retry-After запрещает повтор из кнопки и Enter до окончания паузы', async () => {
    const snapshot = turnSnapshot('failed', { failureReason: 'rate_limited', retryAt: new Date(Date.now() + 60_000).toISOString() })
    const { client, sent } = harness({ send: async () => Response.json({}, { status: 429, headers: { 'Retry-After': '60' } }), getTurn: async () => snapshot })
    client.setInput('Привет, Соня')
    await client.submit()
    expect(canStartCharacterTurn(client.getState())).toBe(false)
    await client.retry()
    expect(sent).toHaveLength(1)
  })

  test('уход со страницы отменяет fetch; поздний результат не меняет UI', async () => {
    const stream = openTextStream('Часть')
    const streamed = deferred<void>()
    let signal: AbortSignal | undefined
    const { client, remembered } = harness({ send: async (_input, incoming) => { signal = incoming; return new Response(stream.stream) } })
    client.subscribe(() => { if (client.getState().turn?.partialText) streamed.resolve() })
    client.setInput('Привет, Соня')
    const run = client.submit()
    await streamed.promise
    const before = client.getState()
    client.dispose()
    await run
    expect(signal?.aborted).toBe(true)
    expect(client.getState()).toBe(before)
    expect(remembered).toEqual([REQUEST_ID])
  })
})

test.describe('защитные UI helpers и UTF-8', () => {
  test('StrictMode reconnect не уничтожает клиент; настоящий unmount уничтожает', async () => {
    const { client } = harness()
    const firstDetach = client.attach()
    firstDetach()
    const finalDetach = client.attach()
    await Promise.resolve()
    client.setInput('После StrictMode')
    expect(client.getState().input).toBe('После StrictMode')
    finalDetach()
    await Promise.resolve()
    client.setInput('После ухода')
    expect(client.getState().input).toBe('После StrictMode')
  })

  test('пустая история не создаёт фиктивное приветствие', () => {
    expect(harness().client.getState().messages).toEqual([])
  })

  test('клиент отбрасывает system и неизвестные роли', () => {
    expect(readCharacterMessages([
      { id: 'a', role: 'system', content: 'PRIVATE' },
      { id: 'b', role: 'tool', content: 'PRIVATE' },
      { id: 'c', role: 'character', content: 'Сохранено' },
    ])).toEqual([{ id: 'c', role: 'assistant', content: 'Сохранено' }])
  })

  test('подтверждение другого requestId/system/пустого completed отвергается', () => {
    expect(() => parseCharacterTurn(turnSnapshot('completed'), ATTEMPT_ID)).toThrow()
    expect(() => parseCharacterTurn({ ...turnSnapshot('completed'), assistantMessage: { ...turnSnapshot('completed').assistantMessage, role: 'system' } })).toThrow()
    expect(() => parseCharacterTurn({ ...turnSnapshot('completed'), assistantMessage: null })).toThrow()
    expect(parseCharacterTurn({ ...turnSnapshot('pending'), assistantMessage: turnSnapshot('completed').assistantMessage }).assistantMessage).toBeNull()
  })

  test('слияние истории по id сохраняет новые записи и не заменяет их поздней версией', () => {
    const message = { id: '1', role: 'assistant' as const, content: 'Новая' }
    expect(mergeCharacterMessages([message], [{ ...message, content: 'Старая' }])).toEqual([message])
  })

  test('кириллица и эмодзи, разбитые на однобайтовые медленные chunks', async () => {
    const text = 'Соня 🌿 👩🏽‍💻 — привет!'
    const bytes = new TextEncoder().encode(text)
    let index = 0
    const stream = new ReadableStream<Uint8Array>({
      async pull(controller) {
        await Promise.resolve()
        if (index === bytes.length) controller.close()
        else controller.enqueue(bytes.slice(index, ++index))
      },
    })
    let received = ''
    for await (const chunk of readTextStream(stream)) received += chunk
    expect(received).toBe(text)
  })

  test('reader явно отменяет оставшийся поток при досрочном выходе', async () => {
    const stream = openTextStream('Фрагмент')
    for await (const chunk of readTextStream(stream.stream)) { expect(chunk).toBe('Фрагмент'); break }
    expect(stream.wasCancelled()).toBe(true)
  })

  test('автоскролл только у нижней границы, без принуждения при чтении выше', () => {
    expect(shouldStickToChatBottom({ scrollHeight: 1000, scrollTop: 900, clientHeight: 100 })).toBe(true)
    expect(shouldStickToChatBottom({ scrollHeight: 1000, scrollTop: 300, clientHeight: 100 })).toBe(false)
    expect(shouldStickToChatBottom({ scrollHeight: 1000, scrollTop: 820, clientHeight: 100 })).toBe(false)
  })

  test('Enter отправляет; Shift+Enter/IME/модификаторы сохраняют многострочный ввод', () => {
    const event = { key: 'Enter', shiftKey: false, isComposing: false }
    expect(shouldSendCharacterChatKey(event)).toBe(true)
    for (const changed of [{ shiftKey: true }, { isComposing: true }, { ctrlKey: true }, { key: 'a' }]) {
      expect(shouldSendCharacterChatKey({ ...event, ...changed })).toBe(false)
    }
  })

  test('HTTP-ошибки различают вход/blocked/409/429/канон без внутренних деталей', async () => {
    for (const [status, reason, expected] of [
      [401, '', 'Войдите'],
      [403, 'blocked', 'заблокировано'],
      [403, 'mode_unavailable', 'вручную'],
      [409, 'request_mismatch', 'другим текстом'],
      [409, 'turn_status_unknown', 'неизвестен'],
      [429, '', 'паузы'],
      [503, 'canon_unavailable', 'контекст'],
    ] as const) {
      const error = await readCharacterChatError(Response.json({ reason, error: 'PRIVATE DATABASE DETAILS' }, { status }))
      expect(error.message).toContain(expected)
      expect(error.message).not.toContain('PRIVATE')
    }
    expect((await readCharacterChatError(new Response('<html>PRIVATE</html>', { status: 502 }))).message).not.toContain('PRIVATE')
  })

  test('Retry-After поддерживает секунды и HTTP-date, невалидное значение игнорируется', () => {
    expect(retryAfterTimestamp('30', 1000)).toBe(31_000)
    expect(retryAfterTimestamp('Wed, 11 Nov 2026 00:00:00 GMT', 1000)).toBe(Date.parse('2026-11-11T00:00:00Z'))
    expect(retryAfterTimestamp('invalid')).toBeUndefined()
  })
})
