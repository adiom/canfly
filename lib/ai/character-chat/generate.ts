import { streamText, type LanguageModel, type ModelMessage } from 'ai'
import type { CharacterAiRuntimeConfig } from './config'

interface CharacterReplyStreamInput {
  model: LanguageModel
  config: CharacterAiRuntimeConfig
  system: string
  messages: ModelMessage[]
  signal: AbortSignal
  metadata: Record<string, unknown>
  save: (text: string, metadata: Record<string, unknown>) => Promise<boolean>
  fail: (code: string) => Promise<void>
  diagnose?: (event: string, code: string) => void
}

export function characterChatErrorCode(error: unknown): string {
  return error instanceof Error && error.name ? error.name : 'unknown_error'
}

/**
 * Транспорт по-прежнему text/plain. Полный поток наблюдаем отдельно: ошибка,
 * отмена, пустой/незаконченный ответ и сбой записи не становятся успешным EOF.
 * Даже успешный EOF клиент обязан подтвердить отдельным GET по requestId.
 */
export function createCharacterReplyStream(input: CharacterReplyStreamInput): ReadableStream<Uint8Array> {
  const disconnect = new AbortController()
  const signal = AbortSignal.any([input.signal, disconnect.signal])
  const encoder = new TextEncoder()
  const startedAt = Date.now()
  let failed: string | null = null
  let finalText: string | null = null
  let finalMetadata: Record<string, unknown> | null = null
  let consumerCancelled = false
  let pump: Promise<void> | undefined

  const recordFailure = async (code: string) => {
    try {
      await input.fail(code)
    } catch (error) {
      // Не удалось записать даже ошибку: GET вернёт pending/unknown, не успех.
      input.diagnose?.('failure_not_persisted', characterChatErrorCode(error))
    }
  }

  return new ReadableStream<Uint8Array>({
    start(controller) {
      pump = (async () => {
        try {
          const result = streamText({
            model: input.model,
            system: input.system,
            messages: input.messages,
            temperature: input.config.temperature,
            maxOutputTokens: input.config.maxOutputTokens,
            maxRetries: input.config.maxRetries,
            abortSignal: signal,
            timeout: {
              totalMs: input.config.totalTimeoutMs,
              chunkMs: input.config.chunkTimeoutMs,
            },
            onError: ({ error }) => {
              const code = characterChatErrorCode(error)
              failed = code === 'TimeoutError' ? 'timeout' : `model_${code}`
              input.diagnose?.('model_stream_error', code)
            },
            // В установленном SDK onAbort не ожидается. Запись выполняется
            // нашим pump после завершения fullStream, а не в async callback.
            onAbort: () => { failed = signal.aborted ? 'aborted' : 'timeout' },
            onFinish: (event) => {
              if (event.finishReason !== 'stop') failed = failed ?? 'incomplete_response'
              finalText = event.text.trim()
              finalMetadata = {
                ...input.metadata,
                source: 'model',
                requestedModel: input.config.modelId,
                reportedModel: `${event.model.provider}/${event.model.modelId}`,
                usage: {
                  inputTokens: event.totalUsage.inputTokens ?? null,
                  outputTokens: event.totalUsage.outputTokens ?? null,
                  totalTokens: event.totalUsage.totalTokens ?? null,
                  cachedInputTokens: event.totalUsage.cachedInputTokens ?? null,
                },
                finishReason: event.finishReason,
                durationMs: Date.now() - startedAt,
              }
            },
          })

          for await (const part of result.fullStream) {
            if (part.type === 'error') failed = failed ?? 'model_stream_error'
            if (part.type === 'abort') failed = signal.aborted ? 'aborted' : 'timeout'
            if (part.type === 'text-delta' && !consumerCancelled && !signal.aborted) {
              controller.enqueue(encoder.encode(part.text))
            }
          }

          if (signal.aborted) failed = failed ?? 'aborted'
          if (!finalText) failed = failed ?? 'empty_response'
          if (failed || !finalMetadata || finalText === null) {
            await recordFailure(failed ?? 'incomplete_response')
            if (!consumerCancelled) controller.error(new Error('character_turn_not_completed'))
            return
          }

          let saved = false
          try {
            saved = await input.save(finalText, finalMetadata)
          } catch (error) {
            input.diagnose?.('reply_not_persisted', characterChatErrorCode(error))
          }
          if (!saved) {
            // null — попытка отменена/заменена. Не выдаём ложный успех и не
            // перезаписываем терминальный статус другой попытки.
            await recordFailure('save_failed')
            if (!consumerCancelled) controller.error(new Error('character_turn_not_saved'))
            return
          }
          if (!consumerCancelled) controller.close()
        } catch (error) {
          input.diagnose?.('stream_failed', characterChatErrorCode(error))
          await recordFailure(signal.aborted ? 'aborted' : failed ?? 'model_stream_error')
          if (!consumerCancelled) controller.error(new Error('character_turn_not_completed'))
        }
      })()
    },
    async cancel() {
      consumerCancelled = true
      disconnect.abort()
      // Продолжаем дренировать fullStream для серверного завершения и записи
      // отмены; само отключение клиента ещё не подтверждает её.
      await pump
    },
  })
}
