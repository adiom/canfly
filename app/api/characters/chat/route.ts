import { NextRequest, NextResponse } from 'next/server'
import { streamText } from 'ai'

import { apiHandler } from '@/lib/api-handler'
import { getCurrentUser } from '@/lib/server/session'
import { fetchCharacterBySlug } from '@/lib/server/characters'
import {
  claimCharacterTurn,
  completeCharacterTurn,
  failCharacterTurn,
  fetchConversationMessages,
  getFriendship,
} from '@/lib/server/users'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { CHARACTER_CHAT_CONFIG } from '@/lib/ai/character-chat/config'
import { resolveCharacterChatAvailability } from '@/lib/ai/character-chat/availability'
import { buildCharacterChatSystemPrompt } from '@/lib/ai/character-chat/prompt'
import {
  buildModelContext,
  extractLatestUserMessage,
  normalizeChatText,
} from '@/lib/ai/character-chat/turn'
import { resolveCharacterAiRuntimeConfig } from '@/lib/server/character-ai-settings'
import { resolveCharacterCanon, type CharacterCanonContext } from '@/lib/server/character-canon'
import { characterChatRequestSchema } from '@/lib/schemas/character-chat'

export const dynamic = 'force-dynamic'

function chatError(status: number, error: string, reason?: string) {
  return NextResponse.json(reason ? { error, reason } : { error }, { status })
}

function toTextResponse(text: string, headers?: Record<string, string>) {
  return new NextResponse(text, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  })
}

function errorCode(error: unknown): string {
  if (error instanceof Error && error.name) return error.name
  return 'unknown_error'
}

function usageMetadata(usage: {
  inputTokens?: number
  outputTokens?: number
  totalTokens?: number
  cachedInputTokens?: number
} | undefined) {
  return {
    inputTokens: usage?.inputTokens ?? null,
    outputTokens: usage?.outputTokens ?? null,
    totalTokens: usage?.totalTokens ?? null,
    cachedInputTokens: usage?.cachedInputTokens ?? null,
  }
}

async function postCharacterChat(request: NextRequest) {
  // Тело ограничиваем до JSON.parse. request.json() без предела позволял бы
  // прислать произвольный объём данных до первого платного вызова.
  const rawBody = await request.text()
  if (rawBody.length > CHARACTER_CHAT_CONFIG.maxRequestBodyChars) {
    return chatError(413, 'Слишком длинный запрос')
  }

  let payload: unknown
  try {
    payload = JSON.parse(rawBody)
  } catch {
    return chatError(400, 'Некорректный JSON')
  }

  const parsed = characterChatRequestSchema.safeParse(payload)
  if (!parsed.success) {
    return chatError(400, 'Некорректный запрос')
  }

  const { characterSlug, requestId, message, messages } = parsed.data

  const user = await getCurrentUser()
  if (!user) return chatError(401, 'Unauthorized')

  const data = await fetchCharacterBySlug(characterSlug)
  if (!data?.character) return chatError(404, 'Character not found')

  const character = data.character
  const friendship = await getFriendship(user.id, character.id)
  const availability = resolveCharacterChatAvailability({
    character,
    friendshipStatus: friendship?.status ?? null,
    authenticated: true,
  })

  if (!availability.canGenerate) {
    const status = availability.reason === 'unconfigured' ? 503 : 403
    return chatError(status, availability.label, availability.reason)
  }

  // Runtime и Studio читают один resolver. Без установленной схемы он
  // возвращает документированные defaults, а чат продолжает работать.
  const ai = await resolveCharacterAiRuntimeConfig(character.id)
  const aiConfig = ai.config

  const latestText = normalizeChatText(
    message ?? extractLatestUserMessage(messages) ?? '',
  )
  if (!latestText) {
    return chatError(400, 'Пустое сообщение')
  }
  if (latestText.length > aiConfig.maxQuestionChars) {
    return chatError(400, 'Сообщение слишком длинное')
  }

  // Проверенный канон читается только для персонажа с утверждённым
  // манифестом. Сбой чтения источников не подменяется догадками: без
  // источников отвечать «по памяти» нельзя, поэтому ход не резервируется.
  // Утверждённый манифест без единого пригодного фрагмента — тоже отказ:
  // это не «нет канона», а «канон есть, но подтвердить его нечем».
  let canon: CharacterCanonContext | null = null
  try {
    const resolution = await resolveCharacterCanon({
      characterId: character.id,
      characterSlug: character.slug,
    })

    if (resolution.kind === 'unavailable') {
      console.error('[character chat] canon unavailable', {
        manifest: resolution.manifestId,
        version: resolution.manifestVersion,
        skipped: resolution.skipped.length,
        reasons: [...new Set(resolution.skipped.map((segment) => segment.reason))],
      })
      return chatError(503, 'Проверенный контекст недоступен', 'canon_unavailable')
    }

    canon = resolution.kind === 'ready' ? resolution.context : null
  } catch (error) {
    console.error('[character chat] canon unavailable', errorCode(error))
    return chatError(503, 'Проверенный контекст недоступен', 'canon_unavailable')
  }

  // Replay того же requestId не должен списывать лимит и не должен
  // запускать модель. Резервирование хода и проверка дублей — в одной
  // транзакции на строке разговора.
  const turn = await claimCharacterTurn({
    userId: user.id,
    characterId: character.id,
    requestId: requestId ?? null,
    content: latestText,
    model: aiConfig.modelId,
    activeTtlSeconds: CHARACTER_CHAT_CONFIG.activeTurnTtlSeconds,
  })

  if (turn.kind === 'replay') {
    return toTextResponse(turn.text, { 'X-Character-Chat-Replay': '1' })
  }
  if (turn.kind === 'busy') {
    return chatError(409, 'Предыдущий ответ ещё готовится. Дождитесь его или обновите страницу.', 'turn_in_progress')
  }
  if (turn.kind === 'conflict') {
    return chatError(409, 'Этот requestId уже отправлен с другим текстом.', turn.reason)
  }

  if (canon) {
    // Версия и хеш контекста без текста глав и без реплик читателя.
    console.info('[character chat] canon context', {
      manifest: canon.metadata.manifestId,
      version: canon.metadata.manifestVersion,
      hash: canon.metadata.contentHash.slice(0, 12),
      segments: canon.metadata.segments.length,
      skipped: canon.metadata.skipped.length,
    })
  }

  const limit = await checkRateLimit({
    bucket: 'chat:character',
    subject: user.id,
    limit: aiConfig.userTurnsPerHour,
    windowSeconds: 60 * 60,
  })
  if (!limit.allowed) {
    await failCharacterTurn({
      conversationId: turn.conversationId,
      userMessageId: turn.userMessageId,
      requestId: requestId ?? null,
      errorCode: 'rate_limited',
    }).catch(() => undefined)
    return rateLimitResponse(limit)
  }

  const storedMessages = await fetchConversationMessages(
    turn.conversationId,
    aiConfig.historyLimit,
  )
  const modelMessages = buildModelContext(storedMessages, aiConfig.maxContextChars)
  const systemPrompt = buildCharacterChatSystemPrompt(character, friendship, canon?.prompt ?? null)

  const startedAt = Date.now()
  let streamFailed = false

  const markFailed = async (code: string) => {
    streamFailed = true
    await failCharacterTurn({
      conversationId: turn.conversationId,
      userMessageId: turn.userMessageId,
      requestId: requestId ?? null,
      errorCode: code,
    }).catch((error: unknown) => {
      console.error('[character chat] failed to record failed turn', errorCode(error))
    })
  }

  let result
  try {
    result = streamText({
      model: aiConfig.modelId,
      system: systemPrompt,
      messages: modelMessages,
      temperature: aiConfig.temperature,
      maxOutputTokens: aiConfig.maxOutputTokens,
      maxRetries: aiConfig.maxRetries,
      abortSignal: request.signal,
      timeout: {
        totalMs: aiConfig.totalTimeoutMs,
        chunkMs: aiConfig.chunkTimeoutMs,
      },
      onError: async ({ error }) => {
        console.error('[character chat] model stream error', errorCode(error))
        await markFailed(`model_${errorCode(error)}`)
      },
      onAbort: async () => {
        await markFailed('aborted')
      },
      onFinish: async (event) => {
        if (streamFailed) return

        const text = event.text.trim()
        if (!text) {
          await markFailed('empty_response')
          return
        }

        try {
          await completeCharacterTurn({
            conversationId: turn.conversationId,
            userMessageId: turn.userMessageId,
            requestId: requestId ?? null,
            text,
            metadata: {
              source: 'model',
              requestedModel: aiConfig.modelId,
              reportedModel: `${event.model.provider}/${event.model.modelId}`,
              usage: usageMetadata(event.totalUsage),
              finishReason: event.finishReason,
              durationMs: Date.now() - startedAt,
              settingsSource: ai.source,
              settingsRevision: ai.settings?.revision ?? null,
              // Только идентификаторы и хеши: текст источников и реплик
              // читателя в metadata не дублируется.
              canon: canon?.metadata ?? null,
            },
          })
        } catch (error) {
          // Поток уже отдан клиенту: честно логируем, но не подменяем ответ.
          console.error('[character chat] failed to persist assistant turn', errorCode(error))
        }
      },
    })
  } catch (error) {
    await markFailed(`setup_${errorCode(error)}`)
    return chatError(502, 'AI-сервис временно недоступен')
  }

  return result.toTextStreamResponse() as unknown as NextResponse
}

export const POST = apiHandler(postCharacterChat)
