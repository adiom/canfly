import { NextRequest, NextResponse } from 'next/server'
import { requireStudioAdminSession } from '@/lib/server/studio-auth'
import { createCharacter, fetchCharactersList } from '@/lib/server/characters'
import { apiHandler } from '@/lib/api-handler'
import { normalizeCharacterPayload, parseAbilities } from '@/lib/api/normalizers'

export const dynamic = 'force-dynamic'

async function getAdminCharacters(_request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const characters = await fetchCharactersList()

  const parsedCharacters = characters.map((character) => ({
    ...character,
    abilities: parseAbilities(character.abilities),
  }))

  return NextResponse.json(parsedCharacters)
}

async function createAdminCharacter(request: NextRequest) {
  const session = await requireStudioAdminSession()

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const normalized = normalizeCharacterPayload(body)

  if ('error' in normalized) {
    return NextResponse.json({ error: normalized.error }, { status: 400 })
  }

  const character = await createCharacter(normalized.data)

  const parsedCharacter = {
    ...character,
    abilities: parseAbilities(character.abilities),
  }

  return NextResponse.json(parsedCharacter, { status: 201 })
}

export const GET = apiHandler(getAdminCharacters)
export const POST = apiHandler(createAdminCharacter)