import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createMcpHandler } from 'mcp-handler'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import { registerCharactersTools } from '@/lib/mcp/tools/characters'
import { registerCharacterRelationshipsTools } from '@/lib/mcp/tools/character-relationships'
import { registerChaptersTools } from '@/lib/mcp/tools/chapters'
import { registerReleasesTools } from '@/lib/mcp/tools/releases'
import { registerSearchTools } from '@/lib/mcp/tools/search'
import { registerPlacesTools } from '@/lib/mcp/tools/places'

/**
 * Тулы этого сервера ходят в БД напрямую, минуя гварды studio-auth: они пишут
 * релизы, главы и персонажей без проверки владения. Единственный барьер —
 * MCP_TOKEN, поэтому эндпоинт нельзя открывать шире, не добавив авторизацию
 * уровня studio-auth в сами тулы.
 */
const mcpHandler = createMcpHandler(
  (server) => {
    registerCharactersTools(server)
    registerCharacterRelationshipsTools(server)
    registerChaptersTools(server)
    registerReleasesTools(server)
    registerSearchTools(server)
    registerPlacesTools(server)
  },
  {
    serverInfo: { name: 'canfly', version: '2.0.0' },
    verboseLogs: process.env.NODE_ENV === 'development',
  },
)

/** Сравнение без утечки длины совпадающего префикса по времени. */
function tokensMatch(provided: string, expected: string): boolean {
  const a = createHash('sha256').update(provided).digest()
  const b = createHash('sha256').update(expected).digest()
  return timingSafeEqual(a, b)
}

/**
 * Подделать Origin из не-браузерного клиента тривиально, поэтому это не замена
 * токену — только защита от того, что чужая вкладка дёрнет эндпоинт cookie-less
 * запросом. Клиенты вроде mcp-remote заголовок не шлют вообще.
 */
function originRejected(request: Request): boolean {
  const origin = request.headers.get('origin')
  if (!origin) return false

  const allowed = process.env.NEXT_PUBLIC_BASE_URL
  if (!allowed) return true

  try {
    return new URL(origin).origin !== new URL(allowed).origin
  } catch {
    return true
  }
}

/** Токен из заголовка `Authorization: Bearer <token>`. */
function readBearer(request: Request): string | null {
  const header = request.headers.get('authorization')
  if (!header) return null
  const [scheme, value] = header.split(' ')
  return scheme?.toLowerCase() === 'bearer' && value ? value : null
}

/**
 * 401 намеренно БЕЗ заголовка WWW-Authenticate. С ним клиенты (MCP Inspector,
 * mcp-remote) читают ответ как приглашение к OAuth и уходят в регистрацию
 * клиента по RFC 9728 — а authorization server здесь нет, токен статический.
 * Без челленджа клиент просто сообщает об отказе, и его достаточно настроить на
 * передачу заголовка.
 */
function unauthorized(): NextResponse {
  return NextResponse.json(
    { error: 'Unauthorized: передайте заголовок Authorization: Bearer <MCP_TOKEN>' },
    { status: 401 },
  )
}

/**
 * Лимит считаем по хешу токена, а не по IP: x-forwarded-for приходит от
 * клиента и подделывается, а токен уже проверен.
 */
async function rateLimited(token: string): Promise<Response | null> {
  const rl = await checkRateLimit({
    bucket: 'mcp',
    subject: createHash('sha256').update(token).digest('hex').slice(0, 32),
    limit: 300,
    windowSeconds: 3600,
  })

  return rl.allowed ? null : rateLimitResponse(rl)
}

/**
 * Без MCP_TOKEN сервер отвечает 503, а не открывается всем: пустой токен не
 * должен по недосмотру превращаться в публичный write-эндпоинт.
 */
async function handler(request: Request): Promise<Response> {
  const expected = process.env.MCP_TOKEN
  if (!expected) {
    return NextResponse.json({ error: 'MCP endpoint is not configured' }, { status: 503 })
  }

  if (originRejected(request)) return unauthorized()

  const provided = readBearer(request)
  if (!provided || !tokensMatch(provided, expected)) return unauthorized()

  const limited = await rateLimited(provided)
  if (limited) return limited

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
