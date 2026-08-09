import { NextRequest, NextResponse } from 'next/server'
import { ModelMessage, streamText } from 'ai'
import {
  addCharacterMessage,
  fetchConversationMessages,
  getOrCreateCharacterConversation,
  upsertCharacterFriendship,
} from '@/lib/server/users'
import { getCurrentUser } from '@/lib/server/session'
import { fetchCharacterBySlug } from '@/lib/server/characters'
import { checkRateLimit } from '@/lib/server/rate-limit'
import { apiHandler } from '@/lib/api-handler'

// Системные промпты больше не хранятся в коде — каждый персонаж получает свой
// из БД (поле characters.system_role, редактируется в Studio). Если поле пустое,
// чат отключён: route возвращает 503, страница /chat показывает «не настроено».

async function postCharacterChat(request: NextRequest) {
  const { messages, characterSlug } = await request.json()

  if (!characterSlug) {
    return new NextResponse('Invalid character', { status: 400 })
  }

  const data = await fetchCharacterBySlug(characterSlug)

  if (!data?.character) {
    return new NextResponse('Invalid character', { status: 400 })
  }

  const character = data.character

  if (!character.can_receive_messages || character.reply_mode === 'disabled') {
    return new NextResponse('Character does not receive messages', { status: 403 })
  }

  const user = await getCurrentUser()
  if (!user) return new NextResponse('Unauthorized', { status: 401 })

  // Каждое сообщение — платный вызов модели, поэтому лимит на пользователя
  const limit = await checkRateLimit({
    bucket: 'chat:character',
    subject: user.id,
    limit: 60,
    windowSeconds: 60 * 60,
  })
  if (!limit.allowed) {
    return new NextResponse('Слишком много сообщений. Попробуйте позже.', {
      status: 429,
      headers: { 'Retry-After': String(limit.resetAfter) },
    })
  }

  const friendship = await upsertCharacterFriendship(user.id, character.id)
  const conversation = await getOrCreateCharacterConversation(user.id, character.id)

  if (!conversation) {
    return new NextResponse('Conversation unavailable', { status: 500 })
  }

  const incomingMessages = Array.isArray(messages) ? messages : []
  const latestUserMessage = [...incomingMessages]
    .reverse()
    .find((msg: { role?: string; content?: string }) => msg.role === 'user' && msg.content?.trim())

  if (latestUserMessage?.content) {
    await addCharacterMessage(conversation.id, 'user', latestUserMessage.content.trim(), {
      source: 'chat',
    })
  }

  const storedMessages = await fetchConversationMessages(conversation.id, 24)
  const modelMessages: ModelMessage[] = storedMessages.map((message) => ({
    role: message.role === 'character' ? 'assistant' : message.role,
    content: message.content,
  }))

  const characterPrompt = character.system_role?.trim()

  if (!characterPrompt) {
    return new NextResponse('System instruction not configured', { status: 503 })
  }

  const systemPrompt = `${characterPrompt}

Информация о персонаже:
Имя: ${character.name}
Описание: ${character.bio}
${character.full_description ? `\nПолное описание: ${character.full_description}` : ''}
${character.personality ? `\nХарактер: ${character.personality}` : ''}
${character.speaking_style ? `\nМанера речи: ${character.speaking_style}` : ''}
${character.knowledge_scope ? `\nГраницы знаний: ${character.knowledge_scope}` : ''}
${character.spoiler_policy ? `\nПолитика спойлеров: ${character.spoiler_policy}` : ''}
${character.boundaries ? `\nОграничения: ${character.boundaries}` : ''}

Отношение к пользователю:
Пользователь добавил персонажа в друзья. Статус связи: ${friendship?.status || 'accepted'}.
Уровень близости: ${friendship?.intimacy_level ?? 1}/100.

Правила общения:
- Говори только от лица этого персонажа.
- Не утверждай, что ты AI.
- Не раскрывай скрытые сюжетные детали, если пользователь явно не просит спойлеры.
- Если тебя спрашивают о книгах и комиксах вселенной canfly, рассказывай как этот персонаж видит эти события.`

  const result = streamText({
    model: 'openai/gpt-4o-mini',
    system: systemPrompt,
    messages: modelMessages,
    temperature: 0.8,
    maxOutputTokens: 1024,
    onFinish: async ({ text }) => {
      if (text?.trim()) {
        await addCharacterMessage(conversation.id, 'character', text.trim(), {
          source: 'openai',
          model: 'gpt-4o-mini',
        })
      }
    },
  })

  return result.toTextStreamResponse() as unknown as NextResponse
}

export const POST = apiHandler(postCharacterChat)