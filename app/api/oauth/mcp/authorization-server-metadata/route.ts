import { NextResponse } from 'next/server'
import { mcpAuthorizationServerMetadata } from '@/lib/server/mcp-oauth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const metadata = mcpAuthorizationServerMetadata()
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
