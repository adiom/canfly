import { createHash, timingSafeEqual } from 'node:crypto'
import { NextResponse } from 'next/server'
import { createMcpHandler } from 'mcp-handler'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'
import {
  authenticateMcpOAuthToken,
  mcpOAuthConfig,
  mcpOAuthEnabled,
} from '@/lib/server/mcp-oauth'
import { MCP_CONTENT_SCOPE } from '@/lib/schemas/mcp-oauth'
import { registerCharactersTools } from '@/lib/mcp/tools/characters'
import { registerCharacterRelationshipsTools } from '@/lib/mcp/tools/character-relationships'
import { registerChaptersTools } from '@/lib/mcp/tools/chapters'
import { registerReleasesTools } from '@/lib/mcp/tools/releases'
import { registerSearchTools } from '@/lib/mcp/tools/search'
import { registerPlacesTools } from '@/lib/mcp/tools/places'
import { registerSeriesTools } from '@/lib/mcp/tools/series'
import { registerMetrikaTools } from '@/lib/mcp/tools/metrika'
import { registerWebmasterTools } from '@/lib/mcp/tools/webmaster'

/**
 * Локальная проекция McpEvent — `parameters` типизирован как `unknown`
 * (mcp-handler не уточняет структуру) и narrowing делается в обработчике.
 */
type AuditorEvent = {
  type: 'REQUEST_RECEIVED' | 'REQUEST_COMPLETED' | 'ERROR'
  method?: string
  parameters?: unknown
  duration?: number
  status?: 'success' | 'error'
  error?: Error | string
  context?: string
  source?: 'request' | 'system'
  severity?: 'warning' | 'error' | 'fatal'
}

/**
 * Имена тулов, которые что-то меняют в БД. Только их успехи пишем в лог,
 * чтобы не плодить шум от read-тулов. Источник правды по префиксам имён.
 */
const WRITE_TOOL_PREFIXES = [
  'canfly_create_',
  'canfly_update_',
  'canfly_delete_',
  'canfly_upsert_',
  'canfly_publish_',
  'canfly_restore_',
  'canfly_set_',
  'canfly_reorder_',
] as const

function isWriteTool(name: string | undefined): boolean {
  if (!name || typeof name !== 'string') return false
  return WRITE_TOOL_PREFIXES.some((prefix) => name.startsWith(prefix))
}

/**
 * Аудит-канал mcp-handler: RequestEvent приходит на каждый tools/call,
 * ErrorEvent — при падениях ниже handler'a (БД, синтаксис). Успехи read-тулов
 * не логируем — шум. Успехи write-тулов и все ошибки идут в server logs,
 * это наш «аудит без БД»: единственный фиксатор того, что кто-то с MCP_TOKEN
 * действительно модифицировал данные.
 */
function onMcpEvent(event: AuditorEvent): void {
  if (event.type === 'ERROR') {
    const msg = event.error instanceof Error ? event.error.message : String(event.error ?? '')
    console.error(
      `[mcp] ERROR severity=${event.severity ?? '?'} source=${event.source ?? '?'}` +
        (event.context ? ` context=${event.context}` : '') +
        ` — ${msg}`,
    )
    return
  }

  if (event.type !== 'REQUEST_COMPLETED' || event.method !== 'tools/call') return

  const params = event.parameters as { name?: string } | undefined
  const toolName = params?.name
  if (!isWriteTool(toolName)) return

  const dur = typeof event.duration === 'number' ? `${event.duration}ms` : '?'
  const line = `[mcp] ${event.method} ${toolName} ${event.status ?? '?'} in ${dur}`
  if (event.status === 'error') {
    console.error(line)
  } else {
    console.log(line)
  }
}

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
    registerSeriesTools(server)
    registerMetrikaTools(server)
    registerWebmasterTools(server)
  },
  {
    serverInfo: { name: 'canfly', version: '2.0.0' },
    verboseLogs: process.env.NODE_ENV === 'development',
    onEvent: onMcpEvent,
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
 * Если OAuth включён, 401 обязан нести resource_metadata: по нему ChatGPT,
 * Claude и mcp-remote находят authorization server и начинают OAuth. Если
 * OAuth выключен, оставляем прежний ответ без челленджа, чтобы статические
 * клиенты не уходили в несуществующую регистрацию.
 */
function unauthorized(): NextResponse {
  const config = mcpOAuthEnabled() ? mcpOAuthConfig() : null
  const headers: Record<string, string> = { 'Cache-Control': 'no-store' }
  if (config) {
    headers['WWW-Authenticate'] =
      `Bearer resource_metadata="${config.resourceMetadataUrl}", scope="${MCP_CONTENT_SCOPE}"`
  }

  return NextResponse.json(
    {
      error: config
        ? 'Unauthorized: требуется OAuth access token или MCP_TOKEN'
        : 'Unauthorized: передайте заголовок Authorization: Bearer <MCP_TOKEN>',
    },
    { status: 401, headers },
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
 * Два способа доступа: статический MCP_TOKEN (локально, CI, Inspector) и
 * OAuth access token (ChatGPT, Claude, Cursor, OpenCode). OAuth-токен
 * проверяется на каждом запросе, включая живой статус администратора и
 * allowlist, поэтому отзыв роли действует немедленно.
 */
async function handler(request: Request): Promise<Response> {
  const expected = process.env.MCP_TOKEN
  const oauth = mcpOAuthEnabled()
  if (!expected && !oauth) {
    return NextResponse.json({ error: 'MCP endpoint is not configured' }, { status: 503 })
  }

  if (originRejected(request)) {
    console.warn('[mcp-oauth] mcp rejected reason=origin')
    return unauthorized()
  }

  const provided = readBearer(request)
  if (!provided) {
    console.info('[mcp-oauth] mcp challenge reason=missing_bearer')
    return unauthorized()
  }

  let authenticated = false
  if (expected && tokensMatch(provided, expected)) {
    authenticated = true
  } else if (oauth) {
    try {
      authenticated = !!(await authenticateMcpOAuthToken(provided))
    } catch (error) {
      console.error('[mcp] OAuth token check failed', error)
    }
  }

  if (!authenticated) {
    console.warn('[mcp-oauth] mcp rejected reason=invalid_bearer')
    return unauthorized()
  }

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
