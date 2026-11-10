import { NextRequest, NextResponse } from 'next/server'
import { fetchCharactersList } from '@/lib/server/characters'
import { toPublicCharacter } from '@/lib/character-public'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function getCharacters(_request: NextRequest) {
  const data = await fetchCharactersList()

  // Явная публичная проекция: без system_role, passport и служебных полей.
  return NextResponse.json(data.map(toPublicCharacter))
}

export const GET = apiHandler(getCharacters)
