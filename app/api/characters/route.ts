import { NextRequest, NextResponse } from 'next/server'
import { fetchCharactersList } from '@/lib/server/characters'
import { Character } from '@/lib/types'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function getCharacters(_request: NextRequest) {
  const data = await fetchCharactersList()

  const parsedCharacters = data.map((character) => ({
    ...character,
    abilities: (() => {
      if (!character.abilities) return []
      if (Array.isArray(character.abilities)) return character.abilities
      if (typeof character.abilities === 'string') {
        try {
          const parsed = JSON.parse(character.abilities)
          return Array.isArray(parsed) ? parsed : []
        } catch {
          return []
        }
      }
      return []
    })(),
  }))

  return NextResponse.json(parsedCharacters as Character[])
}

export const GET = apiHandler(getCharacters)