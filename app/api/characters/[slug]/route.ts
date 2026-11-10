import { NextRequest, NextResponse } from 'next/server'
import { fetchCharacterBySlug } from '@/lib/server/characters'
import { toPublicCharacter } from '@/lib/character-public'
import { apiHandler } from '@/lib/api-handler'

export const dynamic = 'force-dynamic'

async function getCharacterBySlug(
  request: NextRequest,
  context: { params: Promise<Record<string, string>> },
) {
  const { slug } = await context.params as { slug: string }

  const result = await fetchCharacterBySlug(slug)

  if (!result) {
    return NextResponse.json({ error: 'Character not found' }, { status: 404 })
  }

  return NextResponse.json({
    character: toPublicCharacter(result.character),
    relationships: result.relationships,
  })
}

export const GET = apiHandler(getCharacterBySlug)
