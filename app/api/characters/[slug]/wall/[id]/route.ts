import { NextRequest, NextResponse } from 'next/server'
import { revalidatePath } from 'next/cache'

import { deleteWallPost, fetchWallPostById } from '@/lib/server/character-wall'
import { fetchCharacterById } from '@/lib/server/characters'
import { getCurrentUser } from '@/lib/server/session'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function deleteWallPostHandler(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { id } = await context.params as { id: string }

  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Необходимо войти' }, { status: 401 })
  }

  const post = await fetchWallPostById(id)
  if (!post) {
    return NextResponse.json({ error: 'Запись не найдена' }, { status: 404 })
  }

  const character = await fetchCharacterById(post.character_id)
  if (!character) {
    return NextResponse.json({ error: 'Персонаж не найден' }, { status: 404 })
  }

  const isAdmin = user.is_admin
  if (post.user_id !== user.id && !isAdmin) {
    return NextResponse.json({ error: 'Нет доступа' }, { status: 403 })
  }

  await deleteWallPost(id)
  revalidatePath(`/characters/${character.slug}`)
  revalidatePath(`/studio/characters/${character.id}`)
  return NextResponse.json({ data: { id } })
}

export const DELETE = apiHandler(deleteWallPostHandler)