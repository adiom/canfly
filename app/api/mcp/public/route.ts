import { createHash } from 'node:crypto'
import { createMcpHandler } from 'mcp-handler'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { registerPublicSearchTools } from '@/lib/mcp/tools/public-search'

const mcpHandler = createMcpHandler(
  (server) => {
    registerPublicSearchTools(server)
  },
  {
    serverInfo: { name: 'canfly-public', version: '1.0.0' },
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

/**
 * This route deliberately exposes exactly one read-only tool over records
 * explicitly marked published. It does not import the private MCP tool groups
 * and does not accept the shared MCP_TOKEN or perform write operations.
 */
async function handler(request: Request): Promise<Response> {
  // Best-effort abuse control; this is not an authorization boundary.
  // In Vercel production, x-real-ip is supplied by the platform.
  const clientIp = request.headers.get('x-real-ip') ?? 'unknown'
  const subject = createHash('sha256').update(clientIp).digest('hex').slice(0, 32)
  const limit = await checkRateLimit({
    bucket: 'mcp-public',
    subject,
    limit: 180,
    windowSeconds: 3600,
  })
  if (!limit.allowed) return rateLimitResponse(limit)

  return mcpHandler(request)
}

export async function POST(request: Request): Promise<Response> {
  return handler(request)
}

export async function GET(request: Request): Promise<Response> {
  return handler(request)
}

export async function DELETE(request: Request): Promise<Response> {
  return handler(request)
}
