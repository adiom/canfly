import { NextRequest, NextResponse } from 'next/server'
import { fetchCharacterBySlug } from '@/lib/server/characters'
import {
  deleteCharacterFriendship,
  getFriendship,
  upsertCharacterFriendship,
} from '@/lib/server/users'
import { getCurrentUser } from '@/lib/server/session'
import { toPublicCharacter, toPublicUserSummary } from '@/lib/character-public'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function getCharacterFriendship(
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

  const friendship = await getFriendship(user.id, data.character.id)

  return NextResponse.json({ data: { user: toPublicUserSummary(user), friendship } })
}

async function createCharacterFriendship(
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
  const friendship = await upsertCharacterFriendship(user.id, data.character.id)

  return NextResponse.json(
    { data: { user: toPublicUserSummary(user), friendship } },
    { status: 201 },
  )
}

async function removeCharacterFriendship(
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

  const result = await deleteCharacterFriendship(user.id, data.character.id)

  if (result.blocked) {
    // Удаление связи не должно снимать блокировку: иначе повторный POST
    // вернул бы accepted. Пользователь может только читать историю.
    return NextResponse.json(
      {
        error: 'Связь заблокирована персонажем. Удаление дружбы не снимает блокировку.',
        reason: 'blocked',
      },
      { status: 409 },
    )
  }

  return NextResponse.json({
    data: {
      user: toPublicUserSummary(user),
      character: toPublicCharacter(data.character),
      friendship: null,
    },
  })
}

export const GET = apiHandler(getCharacterFriendship)
export const POST = apiHandler(createCharacterFriendship)
export const DELETE = apiHandler(removeCharacterFriendship)
