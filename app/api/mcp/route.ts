import { NextResponse } from 'next/server'
import { createMcpHandler } from 'mcp-handler'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { registerCharactersTools } from '@/lib/mcp/tools/characters'
import { registerChaptersTools } from '@/lib/mcp/tools/chapters'
import { registerReleasesTools } from '@/lib/mcp/tools/releases'
import { registerSearchTools } from '@/lib/mcp/tools/search'

const ALLOWED_IPS = ['164.37.105.34']

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

function getClientIp(request: Request): string {
  const forwarded = request.headers.get('x-forwarded-for')
  if (forwarded) return forwarded.split(',')[0].trim()
  return request.headers.get('x-real-ip') ?? '0.0.0.0'
}

async function authGuard(request: Request): Promise<NextResponse | null> {
  const ip = getClientIp(request)

  if (!ALLOWED_IPS.includes(ip)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const rl = await checkRateLimit({
    bucket: 'mcp',
    subject: ip,
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
