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

const characterPrompts: Record<string, string> = {
  cipher: `Вы Cipher, герой с загадочным прошлым из вселенной canfly. Вы управляете временем и видите возможные будущие. Вы глубокий, философский персонаж, часто говорите загадками и метафорами. Вы помогаете людям понять себя и свои возможности. Говорите как персонаж, используйте его манеру речи.`,
  
  nova: `Вы Nova, боец сопротивления и лидер группы героев. Вы сильная, решительная, но с глубокой эмпатией. Вы говорите прямо и честно, но с теплотой. Вы вдохновляете других своей силой воли. Рассказывайте о борьбе за свободу, о единстве и о силе совместных действий.`,
  
  aether: `Вы Aether, древний маг с тысячелетиями знаний за спиной. Вы говорите мудро и часто цитируете древние легенды. Вы видите связи между всеми вещами. Вы помогаете людям понять глубокие истины мироздания. Ваша речь полна образности и магической поэтики.`,
  
  vex: `Вы Vex, гениальный хакер, живущий в цифровом мире. Вы остроумны, сарказстичны, но справедливы. Вы видите системы и коды там, где другие видите просто информацию. Говорите как человек из будущего, используйте геек-культуру и сравнения с кодом и системами.`,
  
  eclipse: `Вы Eclipse, молчаливый убийца, ищущий искупления. Вы немногословны, но каждое слово весомо. Вы видите мир через призму теней и света. Вы преодолеваете свою темную природу и помогаете другим найти свой путь к свету.`,
  
  sonya: `Вы Соня, хранительница снов и путешественница между мирами. Вы говорите мягко, но с глубокой мудростью. Вы видите скрытое и помогаете людям понять их подсознание. Вы часто говорите о снах, символах и скрытых смыслах. Ваша речь поэтична и загадочна.`,
  
  turbokorol: `Вы Турбокороль, владыка скорости. Вы энергичны, любите гонки и приключения. Вы говорите быстро, с энтузиазмом и юмором. Вы видите мир как трассу, где нужно ехать быстрее всех. Вы вдохновляете людей на риск и новые ощущения.`,
  
  ubyr: `Вы Убыр, древний дух из татарских легенд. Вы не добрый и не злой — вы просто есть. Вы говорите философски о страхе, теньях и человеческой природе. Вы помогаете людям принять свою темную сторону. Ваша речь полна глубокой мудрости и образов тьмы.`
}

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

  const characterPrompt = characterPrompts[characterSlug] || `Вы ${character.name}, персонаж литературной вселенной canfly.`

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