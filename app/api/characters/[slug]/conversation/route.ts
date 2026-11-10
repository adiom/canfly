import { NextRequest, NextResponse } from 'next/server'
import { fetchCharacterBySlug } from '@/lib/server/characters'
import {
  fetchCharacterConversation,
  fetchConversationMessages,
  fetchCharacterTurnSnapshot,
  getFriendship,
} from '@/lib/server/users'
import { getCurrentUser } from '@/lib/server/session'
import { toPublicConversationMessages, toPublicUserSummary } from '@/lib/character-public'
import { apiHandler } from '@/lib/api-handler'
import { characterChatTurnQuerySchema } from '@/lib/schemas/character-chat'
import { missingCharacterTurn } from '@/lib/ai/character-chat/turn-status'

export const dynamic = 'force-dynamic'

/**
 * Чистое чтение истории. GET не создаёт ни дружбу, ни разговор и не меняет
 * `updated_at`: открытие чата — не действие пользователя.
 */
async function getCharacterConversation(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { slug } = await context.params as { slug: string }
  const requestIdParam = request.nextUrl.searchParams.get('requestId')
  const query = requestIdParam === null ? null : characterChatTurnQuerySchema.safeParse({ requestId: requestIdParam })
  if (query && !query.success) {
    return NextResponse.json({ error: 'Некорректный requestId' }, { status: 400 })
  }
  const requestId = query?.success ? query.data.requestId : null
  const data = await fetchCharacterBySlug(slug)

  if (!data?.character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  if (requestId) {
    const conversation = await fetchCharacterConversation(user.id, data.character.id)
    const turn = conversation
      ? await fetchCharacterTurnSnapshot(conversation.id, requestId)
      : missingCharacterTurn(requestId)
    return NextResponse.json({ data: { turn } }, { headers: { 'Cache-Control': 'private, no-store' } })
  }

  const [friendship, conversation] = await Promise.all([
    getFriendship(user.id, data.character.id),
    fetchCharacterConversation(user.id, data.character.id),
  ])

  const [messages, lastTurn] = conversation
    ? await Promise.all([
      fetchConversationMessages(conversation.id),
      fetchCharacterTurnSnapshot(conversation.id),
    ])
    : [[], null]

  return NextResponse.json({
    data: {
      user: toPublicUserSummary(user),
      friendship,
      conversation,
      messages: toPublicConversationMessages(messages),
      lastTurn,
    },
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export const GET = apiHandler(getCharacterConversation)
