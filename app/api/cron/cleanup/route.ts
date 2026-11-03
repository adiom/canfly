import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'
import { cleanupMcpOAuth } from '@/lib/server/mcp-oauth'

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await getPool().query(
    `DELETE FROM magic_tokens
     WHERE used = true OR expires_at < NOW() - INTERVAL '1 day'`,
  )

  let mcpOAuth: Awaited<ReturnType<typeof cleanupMcpOAuth>> | null = null
  try {
    mcpOAuth = await cleanupMcpOAuth()
  } catch (error) {
    console.error('[cron] MCP OAuth cleanup failed', error)
  }

  return NextResponse.json({
    deleted: result.rowCount ?? 0,
    mcpOAuth,
  })
}
