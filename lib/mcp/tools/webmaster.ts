import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { json, withToolCatch } from '@/lib/mcp/tool-result'

/**
 * Read-only Yandex Webmaster API for the verified Canfly domain.
 * OAuth credential lives ONLY in Vercel server-side env, never in MCP arguments.
 * User and host IDs are discovered through the API, not supplied by clients.
 */
const API = 'https://api.webmaster.yandex.net'
const CANFLY_URL = 'https://canfly.org/'
const datePattern = /^\d{4}-\d{2}-\d{2}$/

const periodSchema = z.object({
  date_from: z.string().regex(datePattern, 'Ожидается YYYY-MM-DD').optional(),
  date_to: z.string().regex(datePattern, 'Ожидается YYYY-MM-DD').optional(),
})

function validatePeriod(input: z.infer<typeof periodSchema>): URLSearchParams {
  const params = new URLSearchParams()
  if (input.date_from && input.date_to && input.date_from > input.date_to) {
    throw new Error('date_from должна быть не позднее date_to')
  }
  for (const [key, value] of Object.entries(input)) {
    if (!value) continue
    const parsed = new Date(value + 'T00:00:00Z')
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
      throw new Error('Некорректная дата: ожидается YYYY-MM-DD')
    }
    params.set(key, value)
  }
  return params
}

async function webmasterGet(path: string, params?: URLSearchParams): Promise<unknown> {
  const token = process.env.YANDEX_WEBMASTER_ACCESS_TOKEN?.trim()
  if (!token) {
    throw new Error('Яндекс Вебмастер не подключён: установите YANDEX_WEBMASTER_ACCESS_TOKEN в Vercel')
  }
  const url = new URL(path, API)
  if (url.origin !== API || !url.pathname.startsWith('/v4/')) {
    throw new Error('Недопустимый адрес Яндекс Вебмастера')
  }
  if (params) url.search = params.toString()

  let response: Response
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: { Authorization: `OAuth ${token}`, Accept: 'application/json' },
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new Error('Сервис Яндекс Вебмастер не отвечает')
  }
  if (!response.ok) {
    const hint = response.status === 401 ? 'проверьте OAuth-токен'
      : response.status === 403 ? 'проверьте права webmaster:hostinfo и доступ к сайту'
      : response.status === 404 ? 'проверьте, что домен подтверждён и данные доступны'
      : response.status === 429 ? 'превышена квота API'
      : 'повторите запрос позже'
    throw new Error(`Яндекс Вебмастер: HTTP ${response.status}; ${hint}`)
  }
  return response.json()
}

type WebmasterHost = { host_id?: string; ascii_host_url?: string; unicode_host_url?: string; verified?: boolean }
type WebmasterUser = { user_id?: number | string }

function siteMatches(host: WebmasterHost): boolean {
  return [host.ascii_host_url, host.unicode_host_url].some((raw) => {
    if (!raw) return false
    try {
      const u = new URL(raw)
      return u.origin === new URL(CANFLY_URL).origin
    } catch {
      return false
    }
  })
}

async function discoverSite() {
  const user = await webmasterGet('/v4/user') as WebmasterUser
  if (user.user_id === undefined) throw new Error('Вебмастер не вернул user_id')
  const userId = String(user.user_id)
  if (!/^\d+$/.test(userId)) throw new Error('Некорректный user_id Вебмастера')
  const all = await webmasterGet(`/v4/user/${userId}/hosts`) as { hosts?: WebmasterHost[] }
  const host = all.hosts?.find(siteMatches)
  if (!host?.host_id) {
    throw new Error('В аккаунте OAuth нет подтверждённого https://canfly.org (другие домены не используются)')
  }
  // Host id is an opaque identifier from Yandex, but still must not create URL segments.
  const hostId = encodeURIComponent(host.host_id)
  return { userId, hostId, host: { ...host, host_id: host.host_id } }
}

async function forCanfly(path: string, params?: URLSearchParams) {
  const site = await discoverSite()
  const endpoint = `/v4/user/${site.userId}/hosts/${site.hostId}/${path}`
  return { site: site.host, response: await webmasterGet(endpoint, params) }
}

export function registerWebmasterTools(server: McpServer) {
  const readOnly = { readOnlyHint: true, openWorldHint: true } as const

  server.registerTool('canfly_webmaster_site', {
    title: 'Сайт Canfly в Яндекс Вебмастере',
    description: 'Проверить доступ к подтверждённому https://canfly.org и получить общую статистику индексации. Только чтение.',
    inputSchema: z.object({}),
    annotations: readOnly,
  }, withToolCatch(async () => json(await forCanfly('summary'))))

  server.registerTool('canfly_webmaster_queries', {
    title: 'Поисковые запросы Canfly в Яндексе',
    description: 'Популярные запросы по показам или кликам. Отчёт может содержать ограниченное число запросов и не равнозначен всем поисковым переходам.',
    inputSchema: periodSchema.extend({
      order_by: z.enum(['TOTAL_SHOWS', 'TOTAL_CLICKS']).default('TOTAL_SHOWS'),
      limit: z.number().int().min(1).max(100).default(30),
      offset: z.number().int().min(0).max(3000).default(0),
    }),
    annotations: readOnly,
  }, withToolCatch(async ({ order_by, limit, offset, ...period }) => {
    const params = validatePeriod(period)
    params.set('order_by', order_by)
    params.set('limit', String(limit))
    params.set('offset', String(offset))
    for (const indicator of ['TOTAL_SHOWS', 'TOTAL_CLICKS', 'AVG_SHOW_POSITION', 'AVG_CLICK_POSITION']) {
      params.append('query_indicator', indicator)
    }
    return json(await forCanfly('search-queries/popular', params))
  }))

  server.registerTool('canfly_webmaster_indexing', {
    title: 'Индексирование Canfly',
    description: 'История числа страниц сайта в поиске Яндекса. Только чтение; это не список всех URL.',
    inputSchema: periodSchema,
    annotations: readOnly,
  }, withToolCatch(async (input) =>
    json(await forCanfly('search-urls/in-search/history', validatePeriod(input)))) )

  server.registerTool('canfly_webmaster_diagnostics', {
    title: 'Ошибки Canfly в Яндекс Вебмастере',
    description: 'Состояния проблем с robots, sitemap, SSL, индексированием и метаданными. Только чтение.',
    inputSchema: z.object({}),
    annotations: readOnly,
  }, withToolCatch(async () => json(await forCanfly('diagnostics'))))
}
