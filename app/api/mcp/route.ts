import { NextResponse } from 'next/server'
import { createMcpHandler } from 'mcp-handler'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { registerCharactersTools } from '@/lib/mcp/tools/characters'
import { registerChaptersTools } from '@/lib/mcp/tools/chapters'
import { registerReleasesTools } from '@/lib/mcp/tools/releases'
import { registerSearchTools } from '@/lib/mcp/tools/search'

const mcpHandler = createMcpHandler(
  (server) => {
    registerCharactersTools(server)
    registerChaptersTools(server)
    registerReleasesTools(server)
    registerSearchTools(server)
  },
  {},
  {
    basePath: '/api',
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

async function authGuard(request: Request): Promise<NextResponse | null> {
  const authHeader = request.headers.get('authorization')
  const apiKey = process.env.MCP_API_KEY

  if (!apiKey || authHeader !== `Bearer ${apiKey}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const rl = await checkRateLimit({
    bucket: 'mcp',
    subject: 'canfly-mcp-server',
    limit: 300,
    windowSeconds: 3600,
  })

  if (!rl.allowed) {
    return rateLimitResponse(rl)
  }

  return null
}

export async function POST(request: Request) {
  const denied = await authGuard(request)
  if (denied) return denied
  return mcpHandler(request)
}

export async function GET(request: Request) {
  const denied = await authGuard(request)
  if (denied) return denied
  return mcpHandler(request)
}

export async function DELETE(request: Request) {
  const denied = await authGuard(request)
  if (denied) return denied
  return mcpHandler(request)
}
