import * as z from 'zod-v4'
import type { McpServer } from '@modelcontextprotocol/server'
import { json, withToolCatch } from '@/lib/mcp/tool-result'

/**
 * Read-only reports for the single Canfly counter. The Yandex OAuth token is
 * supplied as a deployment secret, NEVER by a tool argument or client.
 * Requests reach this module only through the admin-authenticated MCP route.
 */
const COUNTER_ID = '42420764'
const YANDEX_API = 'https://api-metrika.yandex.net'
const ymdPattern = /^\d{4}-\d{2}-\d{2}$/

const periodInput = z.object({
  date1: z.string().regex(ymdPattern, 'Ожидается YYYY-MM-DD').optional(),
  date2: z.string().regex(ymdPattern, 'Ожидается YYYY-MM-DD').optional(),
})

const listInput = periodInput.extend({
  limit: z.number().int().min(1).max(100).default(30),
})

type Period = z.infer<typeof periodInput>
type ReportName = 'overview' | 'daily' | 'sources' | 'entrances' | 'devices'

function formatDate(date: Date): string {
  return date.toISOString().slice(0, 10)
}

function checkedPeriod(input: Period): { date1: string; date2: string } {
  const today = new Date()
  const date2 = input.date2 ?? formatDate(today)
  const date1 = input.date1 ?? formatDate(new Date(today.getTime() - 29 * 86_400_000))

  for (const date of [date1, date2]) {
    const parsed = new Date(date + 'T00:00:00Z')
    if (!ymdPattern.test(date) || Number.isNaN(parsed.getTime()) || formatDate(parsed) !== date) {
      throw new Error('Некорректная дата: используйте YYYY-MM-DD')
    }
  }
  const start = Date.parse(date1 + 'T00:00:00Z')
  const end = Date.parse(date2 + 'T00:00:00Z')
  if (end < start || end - start > 366 * 86_400_000) {
    throw new Error('Период должен быть не длиннее 366 дней; date1 <= date2')
  }
  return { date1, date2 }
}

async function callYandex(path: string, params?: URLSearchParams) {
  const token = process.env.YANDEX_METRIKA_ACCESS_TOKEN?.trim()
  if (!token) {
    throw new Error('Яндекс Метрика не подключена: настройте серверный секрет YANDEX_METRIKA_ACCESS_TOKEN')
  }
  const url = new URL(path, YANDEX_API)
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
    throw new Error('Не удалось получить ответ от Яндекс Метрики')
  }
  if (!response.ok) {
    const explanation = response.status === 401
      ? 'проверьте срок действия OAuth-токена'
      : response.status === 403
        ? 'у токена нет права metrika:read или доступа к счётчику'
        : 'проверьте доступность API и лимиты'
    throw new Error(`Яндекс Метрика: HTTP ${response.status}; ${explanation}`)
  }
  return response.json()
}

async function metrikaReport(kind: ReportName, input: Period, limit = 30) {
  const period = checkedPeriod(input)
  const params = new URLSearchParams({
    ids: COUNTER_ID,
    ...period,
    lang: 'ru',
  })

  let endpoint = '/stat/v1/data'
  switch (kind) {
    case 'overview':
      params.set('metrics', 'ym:s:visits,ym:s:users,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds')
      break
    case 'daily':
      endpoint = '/stat/v1/data/bytime'
      params.set('group', 'day')
      params.set('metrics', 'ym:s:visits,ym:s:users,ym:s:pageviews')
      break
    case 'sources':
      params.set('dimensions', 'ym:s:lastTrafficSource')
      params.set('metrics', 'ym:s:visits,ym:s:users')
      params.set('limit', String(limit))
      break
    case 'entrances':
      params.set('dimensions', 'ym:s:startURLPath')
      params.set('metrics', 'ym:s:visits,ym:s:users,ym:s:bounceRate')
      params.set('limit', String(limit))
      break
    case 'devices':
      params.set('dimensions', 'ym:s:deviceCategory')
      params.set('metrics', 'ym:s:visits,ym:s:users')
      params.set('limit', String(limit))
      break
  }

  return {
    counter_id: COUNTER_ID,
    report: kind,
    period,
    // Keep upstream sampling metadata and totals: do not turn sampled
    // observations into unjustified exact SEO or conversion claims.
    response: await callYandex(endpoint, params),
  }
}

export function registerMetrikaTools(server: McpServer) {
  server.registerTool(
    'canfly_metrika_counter',
    {
      title: 'Состояние счётчика Canfly',
      description: 'Проверить доступ к счётчику 42420764 и его настройки. Только чтение.',
      inputSchema: z.object({}),
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withToolCatch(async () => json({
      counter_id: COUNTER_ID,
      counter: await callYandex(`/management/v1/counter/${COUNTER_ID}`),
    })),
  )

  server.registerTool(
    'canfly_metrika_overview',
    {
      title: 'Обзор трафика Canfly',
      description: 'Визиты, посетители, просмотры, отказы и средняя длительность визита за период. Не делает SEO-выводы без сопоставления.',
      inputSchema: periodInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withToolCatch(async (input) => json(await metrikaReport('overview', input))),
  )

  server.registerTool(
    'canfly_metrika_daily',
    {
      title: 'Динамика трафика Canfly',
      description: 'Визиты, посетители и просмотры сайта по дням; используйте для сравнения тенденций.',
      inputSchema: periodInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withToolCatch(async (input) => json(await metrikaReport('daily', input))),
  )

  server.registerTool(
    'canfly_metrika_sources',
    {
      title: 'Источники трафика Canfly',
      description: 'Источники визитов и посетителей за период. Данные Метрики не равнозначны поисковым позициям.',
      inputSchema: listInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withToolCatch(async ({ limit, ...input }) => json(await metrikaReport('sources', input, limit))),
  )

  server.registerTool(
    'canfly_metrika_entrances',
    {
      title: 'Страницы входа Canfly',
      description: 'Страницы первого просмотра в визите: визиты, посетители, отказы. Это не рейтинг всех просмотров страниц.',
      inputSchema: listInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withToolCatch(async ({ limit, ...input }) => json(await metrikaReport('entrances', input, limit))),
  )

  server.registerTool(
    'canfly_metrika_devices',
    {
      title: 'Устройства посетителей Canfly',
      description: 'Сравнение трафика с мобильных, настольных и других устройств.',
      inputSchema: listInput,
      annotations: { readOnlyHint: true, openWorldHint: true },
    },
    withToolCatch(async ({ limit, ...input }) => json(await metrikaReport('devices', input, limit))),
  )
}
