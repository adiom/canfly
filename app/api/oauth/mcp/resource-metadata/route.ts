import { NextResponse } from 'next/server'
import { mcpProtectedResourceMetadata } from '@/lib/server/mcp-oauth'

export const dynamic = 'force-dynamic'

/**
 * RFC 9728. Один handler обслуживает и корневой адрес, и path-specific
 * вариант `/.well-known/oauth-protected-resource/api/mcp`: rewrites в
 * next.config.mjs ведут оба сюда.
 */
export async function GET() {
  const metadata = mcpProtectedResourceMetadata()
  if (!metadata) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(metadata, {
    headers: {
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
