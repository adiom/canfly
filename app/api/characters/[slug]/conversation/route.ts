import { NextRequest, NextResponse } from 'next/server'
import { fetchCharacterBySlug } from '@/lib/server/characters'
import {
  fetchCharacterConversation,
  fetchConversationMessages,
  getFriendship,
} from '@/lib/server/users'
import { getCurrentUser } from '@/lib/server/session'
import { toPublicConversationMessages, toPublicUserSummary } from '@/lib/character-public'
import { apiHandler } from '@/lib/api-handler'

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
  const data = await fetchCharacterBySlug(slug)

  if (!data?.character) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 })
  }

  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [friendship, conversation] = await Promise.all([
    getFriendship(user.id, data.character.id),
    fetchCharacterConversation(user.id, data.character.id),
  ])

  const messages = conversation
    ? await fetchConversationMessages(conversation.id)
    : []

  return NextResponse.json({
    data: {
      user: toPublicUserSummary(user),
      friendship,
      conversation,
      messages: toPublicConversationMessages(messages),
    },
  })
}

export const GET = apiHandler(getCharacterConversation)
