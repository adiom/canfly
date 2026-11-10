import type { CharacterTurnSnapshot } from '@/lib/ai/character-chat/turn-status'
import { normalizeChatText } from '@/lib/ai/character-chat/turn'
import { readTextStream } from './read-text-stream'
import {
  canStartCharacterTurn,
  characterFailureMessage,
  isCharacterTurnActive,
  mergeCharacterMessages,
  parseCharacterTurn,
  phaseForCharacterSnapshot,
  readCharacterChatError,
  readCharacterMessages,
  type CharacterChatMessage,
  type CharacterChatState,
  type CharacterChatTurn,
  type CharacterChatUiError,
} from './character-chat-state'

interface ChatHistory {
  messages: CharacterChatMessage[]
  lastTurn: CharacterTurnSnapshot | null
}

interface ChatBackend {
  send: (input: { message: string; requestId: string; retryAttemptId?: string }, signal: AbortSignal) => Promise<Response>
  getTurn: (requestId: string, signal: AbortSignal) => Promise<CharacterTurnSnapshot>
  getHistory: (signal: AbortSignal) => Promise<ChatHistory>
}

interface CharacterChatClientOptions {
  backend: ChatBackend
  messages?: CharacterChatMessage[]
  lastTurn?: CharacterTurnSnapshot | null
  historyError?: string | null
  canGenerate: boolean
  remember?: (requestId: string | null) => void
  newRequestId?: () => string
  delay?: (signal: AbortSignal) => Promise<void>
  maxChecks?: number
}

class CharacterChatTransportError extends Error {
  constructor(readonly uiError: CharacterChatUiError) { super(uiError.message) }
}

function transportError(error: unknown, fallback: string): CharacterChatUiError {
  return error instanceof CharacterChatTransportError ? error.uiError : { message: fallback }
}

function newTurn(requestId: string, text: string): CharacterChatTurn {
  return { requestId, text, partialText: '', phase: 'sending', stopRequested: false, retried: false, snapshot: null }
}

function delayCheck(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) { reject(signal.reason); return }
    const abort = () => { clearTimeout(timer); reject(signal.reason) }
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve() }, 1500)
    signal.addEventListener('abort', abort, { once: true })
  })
}

/**
 * Реальный клиентский workflow, тестируемый с mock fetch без React/БД/LLM.
 * Черновик потока не попадает в messages: только canonical GET добавляет ответ.
 */
export class CharacterChatClient {
  private state: CharacterChatState
  private listeners = new Set<() => void>()
  private operation = false
  private historyOperation = false
  private streamController: AbortController | null = null
  private lifetime = new AbortController()
  private available: boolean
  private disposed = false
  private mounts = 0

  constructor(private options: CharacterChatClientOptions) {
    const lastTurn = options.lastTurn
    this.available = options.canGenerate
    this.state = {
      messages: readCharacterMessages(options.messages ?? []),
      input: '',
      historyStatus: options.historyError ? 'error' : 'ready',
      historyError: options.historyError ?? null,
      turn: lastTurn && lastTurn.status !== 'completed' ? {
        ...newTurn(lastTurn.requestId, lastTurn.userMessage?.content ?? ''),
        snapshot: lastTurn,
        phase: phaseForCharacterSnapshot(lastTurn),
      } : null,
      error: null,
      checking: false,
    }
  }

  getState = (): CharacterChatState => this.state
  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => { this.listeners.delete(listener) }
  }

  attach(): () => void {
    this.mounts += 1
    return () => {
      this.mounts -= 1
      // StrictMode синхронно переподключает effect; настоящий уход отменяет
      // сеть в ближайшей microtask без зависимостей от DOM/ref React.
      queueMicrotask(() => { if (this.mounts === 0) this.dispose() })
    }
  }

  private update(change: Partial<CharacterChatState>) {
    if (this.disposed) return
    this.state = { ...this.state, ...change }
    for (const listener of this.listeners) listener()
  }

  private updateTurn(change: Partial<CharacterChatTurn>) {
    if (this.state.turn) this.update({ turn: { ...this.state.turn, ...change } })
  }

  setInput(value: string) { this.update({ input: value }) }
  setAvailable(value: boolean) { this.available = value }

  async submit(): Promise<void> {
    const text = normalizeChatText(this.state.input)
    if (!this.available || !text || this.operation || !canStartCharacterTurn(this.state)) return
    if (this.state.turn?.text === text && this.state.turn.phase !== 'completed') {
      await this.retry()
      return
    }
    this.operation = true // синхронная защита double-submit до первого await
    const requestId = (this.options.newRequestId ?? (() => crypto.randomUUID()))()
    this.update({ turn: newTurn(requestId, text), error: null, input: '' })
    this.options.remember?.(requestId)
    try { await this.send(text, requestId) } finally { this.operation = false }
  }

  private async send(text: string, requestId: string, retryAttemptId?: string): Promise<void> {
    const controller = new AbortController()
    this.streamController = controller
    try {
      const response = await this.options.backend.send({ message: text, requestId, retryAttemptId }, controller.signal)
      if (!response.ok) {
        this.update({ error: await readCharacterChatError(response) })
        if (response.status === 401 || response.status === 403) this.available = false
      } else if (!response.body) {
        this.update({ error: { message: 'Сервер не прислал поток. Проверяем сохранённый результат.' } })
      } else {
        for await (const chunk of readTextStream(response.body, controller.signal)) {
          if (controller.signal.aborted || this.disposed) break
          if (this.state.turn?.phase === 'completed') continue
          this.updateTurn({ partialText: (this.state.turn?.partialText ?? '') + chunk, phase: 'streaming' })
        }
      }
    } catch {
      if (!this.disposed && !this.state.turn?.stopRequested && this.state.turn?.phase !== 'completed') {
        this.update({ error: { message: 'Связь прервалась. Сначала проверим, что сохранил сервер.' } })
      }
    } finally {
      this.streamController = null
    }
    if (this.disposed || this.state.turn?.phase === 'completed') return
    this.updateTurn({ phase: this.state.turn?.stopRequested ? 'stopping' : 'confirming' })
    await this.confirm(requestId)
  }

  stop(): void {
    if (!this.state.turn || !isCharacterTurnActive(this.state.turn)) return
    this.updateTurn({ stopRequested: true, phase: 'stopping' })
    this.restoreDraft()
    this.streamController?.abort()
  }

  private restoreDraft() {
    if (!this.state.input && this.state.turn?.text) this.update({ input: this.state.turn.text })
  }

  private markUnconfirmed() {
    const snapshot = this.state.turn?.snapshot
    this.updateTurn({
      phase: 'unsaved',
      snapshot: snapshot ? { ...snapshot, status: 'unknown', assistantMessage: null, canRetry: false, blocksNewTurn: true } : null,
    })
  }

  private applySnapshot(snapshot: CharacterTurnSnapshot) {
    const turn = this.state.turn
    if (!turn || snapshot.requestId !== turn.requestId) throw new Error('Другой requestId в подтверждении')
    if (turn.phase === 'completed' && snapshot.status !== 'completed') return
    const canonical = readCharacterMessages([
      ...(snapshot.userMessage ? [snapshot.userMessage] : []),
      ...(snapshot.status === 'completed' && snapshot.assistantMessage ? [snapshot.assistantMessage] : []),
    ])
    this.update({
      messages: mergeCharacterMessages(this.state.messages, canonical),
      turn: { ...turn, text: snapshot.userMessage?.content ?? turn.text, snapshot, phase: phaseForCharacterSnapshot(snapshot) },
    })
    if (snapshot.status === 'completed') {
      this.updateTurn({ partialText: '' })
      this.update({ error: null, input: this.state.input === this.state.turn?.text ? '' : this.state.input })
      this.options.remember?.(null)
    } else {
      this.restoreDraft()
      if (snapshot.status === 'failed' && !this.state.error?.status) {
        this.update({ error: { message: characterFailureMessage(snapshot) } })
      }
    }
  }

  private async confirm(requestId: string) {
    this.update({ checking: true })
    let last: CharacterTurnSnapshot | null = null
    try {
      for (let count = 0; count < (this.options.maxChecks ?? 12); count += 1) {
        last = await this.options.backend.getTurn(requestId, this.lifetime.signal)
        // Валидация выполняется и для injected backend: другой ход не может
        // случайно подтвердить этот после гонки/перехода между страницами.
        last = parseCharacterTurn(last, requestId)
        if (this.state.turn?.phase === 'completed') return
        if (last.status === 'completed' || last.status === 'failed' || last.status === 'cancelled') break
        if (count + 1 < (this.options.maxChecks ?? 12)) await (this.options.delay ?? delayCheck)(this.lifetime.signal)
      }
      if (this.disposed || this.state.turn?.phase === 'completed') return
      if (last) this.applySnapshot(last)
      if (last?.status === 'unknown' || last?.status === 'pending' || last?.status === 'not_found') {
        this.update({ error: this.state.error ?? { message: 'Результат хода пока не подтверждён. Проверка статуса не запускает новый AI-вызов.' } })
      }
    } catch (error) {
      if (this.disposed || this.state.turn?.phase === 'completed') return
      this.markUnconfirmed()
      // Сбой GET инвалидирует даже прежде известный failed: перед retry всё
      // равно понадобится новая сверка, автоматического POST здесь нет.
      this.update({ error: this.state.error ?? transportError(error, 'Не удалось проверить статус на сервере. Ответ не подтверждён; автоматического повтора нет.') })
      this.restoreDraft()
    } finally {
      this.update({ checking: false })
    }
  }

  /** Всегда GET перед явным повтором. completed/pending/unknown не вызывают POST. */
  async retry(): Promise<void> {
    const turn = this.state.turn
    if (!this.available || !turn || this.operation || this.state.historyStatus !== 'ready' || this.state.checking) return
    this.operation = true
    this.update({ checking: true, error: null })
    try {
      const snapshot = parseCharacterTurn(await this.options.backend.getTurn(turn.requestId, this.lifetime.signal), turn.requestId)
      this.applySnapshot(snapshot)
      if (snapshot.status === 'completed' || this.state.turn?.phase === 'completed') return
      if (snapshot.status === 'pending' || snapshot.status === 'unknown') {
        this.update({ error: { message: 'Сервер ещё не подтвердил неуспешное завершение. Повторный AI-вызов заблокирован.' } })
        return
      }
      const text = snapshot.userMessage?.content ?? turn.text
      if ((!snapshot.canRetry && snapshot.status !== 'not_found') || !text) {
        this.update({ error: { message: 'Этот ход нельзя повторить. Проверьте историю разговора.' } })
        return
      }
      const retryAt = snapshot.retryAt ? Date.parse(snapshot.retryAt) : 0
      if (retryAt > Date.now()) {
        this.update({ error: { message: 'Дождитесь окончания паузы перед повтором.', retryAt } })
        return
      }
      this.update({
        checking: false,
        input: this.state.input === text ? '' : this.state.input,
        turn: { ...newTurn(turn.requestId, text), retried: true, snapshot },
      })
      this.options.remember?.(turn.requestId)
      await this.send(text, turn.requestId, snapshot.canRetry ? snapshot.attemptId ?? undefined : undefined)
    } catch (error) {
      if (this.disposed || this.state.turn?.phase === 'completed') return
      this.markUnconfirmed()
      this.update({ error: transportError(error, 'Не удалось проверить предыдущий ход. Повторный AI-вызов не запускался.') })
      this.restoreDraft()
    } finally {
      this.operation = false
      this.update({ checking: false })
    }
  }

  async check(requestId = this.state.turn?.requestId): Promise<void> {
    if (!requestId || this.operation || this.state.checking || this.disposed) return
    if (this.state.turn?.requestId === requestId && this.state.turn.phase === 'completed') return
    this.operation = true
    if (!this.state.turn || this.state.turn.requestId !== requestId) this.update({ turn: newTurn(requestId, '') })
    this.updateTurn({ phase: this.state.turn?.stopRequested ? 'stopping' : 'confirming' })
    try { await this.confirm(requestId) } finally { this.operation = false }
  }

  async reloadHistory(): Promise<void> {
    if (this.historyOperation || this.disposed) return
    this.historyOperation = true
    this.update({ historyStatus: 'loading', historyError: null })
    try {
      const history = await this.options.backend.getHistory(this.lifetime.signal)
      this.update({ messages: mergeCharacterMessages(this.state.messages, readCharacterMessages(history.messages)), historyStatus: 'ready' })
      if (history.lastTurn && history.lastTurn.requestId === this.state.turn?.requestId) {
        const snapshot = parseCharacterTurn(history.lastTurn, this.state.turn.requestId)
        // Запоздавший pending не отменяет уже подтверждённый completed. Во
        // время потока привязываем canonical question, не рисуя его повторно.
        if (this.state.turn.phase !== 'completed') {
          if (snapshot.status === 'completed' || !isCharacterTurnActive(this.state.turn)) this.applySnapshot(snapshot)
          else this.updateTurn({ snapshot })
        }
      } else if (!this.state.turn && history.lastTurn && history.lastTurn.status !== 'completed') {
        this.update({ turn: newTurn(history.lastTurn.requestId, history.lastTurn.userMessage?.content ?? '') })
        this.applySnapshot(history.lastTurn)
      }
    } catch (error) {
      const uiError = transportError(error, 'Не удалось загрузить историю. Отправка отключена до повторной загрузки.')
      const accessDenied = uiError.status === 401 || uiError.status === 403
      if (accessDenied) this.available = false
      this.update({ historyStatus: 'error', historyError: uiError.message, ...(accessDenied ? { error: uiError } : {}) })
    } finally { this.historyOperation = false }
  }

  dispose(): void {
    this.disposed = true
    this.streamController?.abort()
    this.lifetime.abort()
    this.listeners.clear()
  }
}

function dataObject(payload: unknown): Record<string, unknown> {
  if (!payload || typeof payload !== 'object' || !('data' in payload)) throw new Error('Некорректный ответ сервера')
  const data = (payload as { data: unknown }).data
  if (!data || typeof data !== 'object') throw new Error('Некорректный ответ сервера')
  return data as Record<string, unknown>
}

export function characterChatBackend(characterSlug: string): ChatBackend {
  const conversationUrl = `/api/characters/${encodeURIComponent(characterSlug)}/conversation`
  const get = async (url: string, signal: AbortSignal) => {
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.any([signal, AbortSignal.timeout(8000)]) })
    if (!response.ok) throw new CharacterChatTransportError(await readCharacterChatError(response))
    return dataObject(await response.json())
  }
  return {
    send: (input, signal) => fetch('/api/characters/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ characterSlug, ...input }),
      signal,
    }),
    getTurn: async (requestId, signal) => {
      const data = await get(`${conversationUrl}?requestId=${encodeURIComponent(requestId)}`, signal)
      return parseCharacterTurn(data.turn, requestId)
    },
    getHistory: async (signal) => {
      const data = await get(conversationUrl, signal)
      if (!Array.isArray(data.messages)) throw new Error('Некорректная история')
      return { messages: readCharacterMessages(data.messages), lastTurn: data.lastTurn ? parseCharacterTurn(data.lastTurn) : null }
    },
  }
}
