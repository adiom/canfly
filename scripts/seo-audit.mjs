import { resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

/**
 * Read-only SEO audit of a local, staging, or production deployment.
 * Usage: node scripts/seo-audit.mjs https://canfly.org [--limit=20] [--format=json|text|both]
 * Requests are restricted to the selected origin; redirects outside it are never followed.
 */

const args = process.argv.slice(2)
const baseArg = args.find(arg => /^https?:\/\//i.test(arg))
const limitArg = args.find(arg => arg.startsWith('--limit='))
const formatArg = args.find(arg => arg.startsWith('--format='))
const strict = args.includes('--strict')
const baseUrl = new URL((baseArg || process.env.SEO_AUDIT_BASE_URL || process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000').replace(/\/$/, ''))
const BASE = baseUrl.origin
const LIMIT = limitArg ? Number.parseInt(limitArg.slice(8), 10) : Number.POSITIVE_INFINITY
const FORMAT = formatArg?.slice(9) || 'both'
const CONCURRENCY = 4
const errors = []
const warnings = []
const results = []

function decode(value) {
  return value.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
}

function getAttribute(tag, name) {
  const match = new RegExp(`\\b${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag)
  return match ? decode(match[1] ?? match[2] ?? match[3] ?? '') : null
}

function getMeta(html, key) {
  for (const match of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = match[0]
    if ((getAttribute(tag, 'name') || getAttribute(tag, 'property'))?.toLowerCase() === key.toLowerCase()) {
      return getAttribute(tag, 'content')
    }
  }
  return null
}

function canonical(html) {
  const tag = [...html.matchAll(/<link\b[^>]*>/gi)].map(match => match[0])
    .find(item => (getAttribute(item, 'rel') || '').toLowerCase().split(/\s+/).includes('canonical'))
  return tag ? getAttribute(tag, 'href') : null
}

export function classifyStatus(status, { inSitemap = true } = {}) {
  if (status >= 500) return 'server-error'
  if (status >= 400) {
    if (!inSitemap && (status === 404 || status === 410)) return 'expected-missing'
    return 'client-error'
  }
  if (status >= 300) return 'redirect'
  if (status >= 200) return 'ok'
  return 'unexpected'
}

export function inspectCanonical(href, pageUrl, baseUrl) {
  if (!href) return { canonicalUrl: null, issues: ['нет canonical'] }
  try {
    const canonicalUrl = new URL(href, pageUrl)
    const expectedUrl = new URL(pageUrl)
    const matchesPath = canonicalUrl.pathname === expectedUrl.pathname && canonicalUrl.search === expectedUrl.search
    const previewProductionCanonical = new URL(baseUrl).hostname.endsWith('.vercel.app') && canonicalUrl.origin === 'https://canfly.org'
    const sameAllowedOrigin = canonicalUrl.origin === new URL(baseUrl).origin || previewProductionCanonical
    const issues = []
    if (!sameAllowedOrigin) issues.push(`canonical вне проверяемого домена: ${canonicalUrl.origin}`)
    if (!matchesPath || !sameAllowedOrigin) issues.push(`canonical не совпадает с URL sitemap: ${canonicalUrl.href}`)
    return { canonicalUrl: canonicalUrl.href, issues }
  } catch {
    return { canonicalUrl: null, issues: [`canonical некорректен: ${href}`] }
  }
}

function statusIssue(url, status, redirectTo) {
  const item = { url, status, ...(redirectTo ? { redirectTo } : {}) }
  results.push(item)
  const category = classifyStatus(status, { inSitemap: true })
  if (category === 'client-error' || category === 'server-error' || category === 'unexpected') errors.push(`${url}: HTTP ${status}`)
  else if (category === 'redirect') warnings.push(`${url}: HTTP ${status}${redirectTo ? ` → ${redirectTo}` : ''}`)
}

async function getSameOrigin(url) {
  let current = new URL(url)
  const redirects = []
  for (let count = 0; count < 6; count += 1) {
    if (current.origin !== BASE) throw new Error(`запрос за пределы проверяемого домена запрещён: ${current.origin}`)
    const response = await fetch(current, { redirect: 'manual', signal: AbortSignal.timeout(20000) })
    if (![301, 302, 303, 307, 308].includes(response.status)) return { response, url: current.toString(), redirects }
    const location = response.headers.get('location')
    if (!location) return { response, url: current.toString(), redirects }
    const next = new URL(location, current)
    redirects.push({ status: response.status, from: current.toString(), to: next.toString() })
    statusIssue(current.toString(), response.status, next.toString())
    if (next.origin !== BASE) throw new Error(`внешний redirect заблокирован: ${next.origin}`)
    current = next
  }
  throw new Error('слишком много редиректов')
}

export function sitemapLocs(xml, index = false) {
  const itemTag = index ? 'sitemap' : 'url'
  return [...xml.matchAll(new RegExp(`<${itemTag}\\b[^>]*>([\\s\\S]*?)<\\/${itemTag}>`, 'gi'))]
    .map(([, item]) => /<loc\b[^>]*>([\s\S]*?)<\/loc>/i.exec(item)?.[1])
    .filter(Boolean)
    .map(value => decode(value.trim()))
}

function validateXml(xml, label) {
  const stack = []
  const tags = /<\/?([A-Za-z_][\w:.-]*)(?:\s[^<>]*?)?\s*\/?>/g
  for (const match of xml.matchAll(tags)) {
    const token = match[0]
    const name = match[1]
    if (token.startsWith('</')) {
      if (stack.pop() !== name) throw new Error(`${label}: некорректно закрыт XML-тег </${name}>`)
    } else if (!token.endsWith('/>')) {
      stack.push(name)
    }
  }
  if (stack.length > 0) throw new Error(`${label}: незакрытый XML-тег <${stack.at(-1)}>`)
  if (/&(?!amp;|lt;|gt;|quot;|apos;|#\d+;|#x[\da-f]+;)/i.test(xml)) {
    throw new Error(`${label}: некорректная XML-сущность`)
  }
}

function localizeSitemapUrl(raw) {
  const url = new URL(raw, BASE)
  if (!['https:', 'http:'].includes(url.protocol)) throw new Error(`неподдерживаемая схема URL: ${url.protocol}`)
  // Canonical sitemap URLs on canfly.org are mapped to the chosen staging origin.
  if (url.origin !== BASE && url.hostname !== 'canfly.org' && url.hostname !== 'www.canfly.org') {
    throw new Error(`внешний sitemap URL пропущен: ${url.origin}`)
  }
  url.protocol = baseUrl.protocol
  url.host = baseUrl.host
  url.hash = ''
  return url.toString()
}

async function readSitemap(url, visited = new Set()) {
  if (visited.has(url)) throw new Error(`цикл sitemap: ${url}`)
  visited.add(url)
  const { response, redirects } = await getSameOrigin(url)
  if (redirects.length > 0) throw new Error(`${url}: sitemap redirect — URL должен отвечать без перенаправления`)
  if (!response.ok) throw new Error(`${url}: sitemap HTTP ${response.status}`)
  const xml = await response.text()
  validateXml(xml, url)
  if (!/<(?:urlset|sitemapindex)\b/i.test(xml)) throw new Error(`${url}: ответ не похож на sitemap XML`)
  const isIndex = /<sitemapindex\b/i.test(xml)
  const locs = sitemapLocs(xml, isIndex)
  if (locs.length === 0) throw new Error(`${url}: sitemap не содержит элементов <loc>`)
  if (isIndex) {
    const urls = []
    for (const loc of locs) urls.push(...await readSitemap(localizeSitemapUrl(loc), visited))
    return urls
  }
  return locs.map(localizeSitemapUrl)
}

function checkHtml(url, html, status) {
  const issues = []
  if (status !== 200) issues.push(`страница после редиректа ответила HTTP ${status}`)
  const title = /<title\b[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]?.replace(/<[^>]*>/g, '').trim()
  const titleCount = [...html.matchAll(/<title\b/gi)].length
  const description = getMeta(html, 'description')
  if (!title) issues.push('нет title')
  if (titleCount > 1) issues.push(`найдено title-тегов: ${titleCount}`)
  if (!description?.trim()) issues.push('нет meta description')
  const h1Count = [...html.matchAll(/<h1\b/gi)].length
  if (h1Count === 0) pageWarning(url, 'нет H1')
  if (h1Count > 1) pageWarning(url, `найдено H1: ${h1Count}`)

  const robots = [getMeta(html, 'robots'), getMeta(html, 'googlebot')].filter(Boolean).join(', ')
  if (/noindex/i.test(robots)) issues.push(`URL из sitemap закрыт от индексации (${robots})`)

  const canonicalResult = inspectCanonical(canonical(html), url, BASE)
  issues.push(...canonicalResult.issues)

  const ogUrl = getMeta(html, 'og:url')
  if (ogUrl) {
    try {
      const actualOgUrl = new URL(ogUrl, url)
      const expectedUrl = new URL(url)
      if (
        actualOgUrl.pathname !== expectedUrl.pathname ||
        actualOgUrl.search !== expectedUrl.search ||
        (actualOgUrl.origin !== BASE && !(baseUrl.hostname.endsWith('.vercel.app') && actualOgUrl.origin === 'https://canfly.org'))
      ) {
        issues.push(`og:url противоречит URL страницы: ${actualOgUrl.href}`)
      }
    } catch {
      issues.push(`og:url некорректен: ${ogUrl}`)
    }
  }

  for (const key of ['og:title', 'og:description', 'og:url', 'og:image']) {
    if (!getMeta(html, key)) pageWarning(url, `нет ${key}`)
  }
  if (!getMeta(html, 'twitter:card')) pageWarning(url, 'нет twitter:card')

  const blocks = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)]
  if (blocks.length === 0) issues.push('нет JSON-LD')
  const schemaIds = new Set()
  for (const [index, block] of blocks.entries()) {
    try {
      const parsed = JSON.parse(block[1])
      const definitions = Array.isArray(parsed?.['@graph']) ? parsed['@graph'] : [parsed]
      for (const definition of definitions) {
        if (typeof definition?.['@id'] !== 'string') continue
        if (schemaIds.has(definition['@id'])) issues.push(`JSON-LD содержит дублирующий @id: ${definition['@id']}`)
        schemaIds.add(definition['@id'])
      }
    } catch {
      issues.push(`JSON-LD #${index + 1} не парсится`)
    }
  }

  const canonicalCount = [...html.matchAll(/<link\b[^>]*rel=["'][^"']*canonical[^"']*["'][^>]*>/gi)].length
  if (canonicalCount > 1) issues.push(`найдено canonical-тегов: ${canonicalCount}`)
  for (const issue of issues) errors.push(`${url}: ${issue}`)
  return { url, status, title: title || null, description: description || null, canonical: href, robots: robots || null, jsonLdBlocks: blocks.length, issues }
}

function pageWarning(url, message) {
  warnings.push(`${url}: ${message}`)
}

async function auditPage(url) {
  try {
    const { response, url: finalUrl, redirects } = await getSameOrigin(url)
    const status = response.status
    if (redirects.length > 0) errors.push(`${url}: URL из sitemap перенаправляет (${redirects.map(item => `${item.status} → ${item.to}`).join('; ')})`)
    if (!response.ok) {
      statusIssue(url, status)
      results.push({ url, finalUrl, status, issues: [`HTTP ${status}`] })
      return
    }
    if (response.headers.get('content-type')?.includes('text/html') === false) {
      errors.push(`${url}: ожидался HTML, получен ${response.headers.get('content-type') || 'неизвестный тип'}`)
      results.push({ url, finalUrl, status, issues: ['не HTML'] })
      return
    }
    const html = await response.text() // includes metadata streamed after the initial shell
    const checked = checkHtml(url, html, status)
    const headerRobots = response.headers.get('x-robots-tag')
    if (headerRobots && /noindex/i.test(headerRobots)) {
      checked.issues.push(`URL из sitemap закрыт HTTP-заголовком (${headerRobots})`)
      errors.push(`${url}: URL из sitemap закрыт HTTP-заголовком (${headerRobots})`)
    }
    results.push({ ...checked, finalUrl, redirects })
  } catch (error) {
    errors.push(`${url}: ${error.message}`)
    results.push({ url, issues: [error.message] })
  }
}

async function checkRobots() {
  const url = `${BASE}/robots.txt`
  const { response } = await getSameOrigin(url)
  if (!response.ok) throw new Error(`robots.txt HTTP ${response.status}`)
  const body = await response.text()
  if (!/^\s*Sitemap:\s*https?:\/\//im.test(body)) errors.push(`${url}: нет абсолютной ссылки Sitemap`)
  if (/^\s*Disallow:\s*\/(?:release|vvvvv|series|characters|places|games|news)(?:\/|\s|$)/im.test(body)) {
    errors.push(`${url}: запрещён обход публичного контента`)
  }
  results.push({ url, status: response.status, sitemap: /^\s*Sitemap:\s*(.+)$/im.exec(body)?.[1]?.trim() || null })
}

async function main() {
  if (!['json', 'text', 'both'].includes(FORMAT)) throw new Error('--format должен быть json, text или both')
  const rawUrls = await readSitemap(`${BASE}/sitemap.xml`)
  const duplicateUrls = rawUrls.filter((url, index) => rawUrls.indexOf(url) !== index)
  for (const url of new Set(duplicateUrls)) errors.push(`дубликат в sitemap: ${url}`)
  const urls = [...new Set(rawUrls)].slice(0, Number.isFinite(LIMIT) ? Math.max(0, LIMIT) : undefined)

  await checkRobots()
  let next = 0
  await Promise.all(Array.from({ length: CONCURRENCY }, async () => {
    while (next < urls.length) await auditPage(urls[next++])
  }))

  const report = { baseUrl: BASE, checkedAt: new Date().toISOString(), urlCount: urls.length, errors, warnings, results }
  if (FORMAT !== 'json') {
    console.log(`SEO-аудит: ${BASE}`)
    console.log(`URL sitemap: ${rawUrls.length}; проверено: ${urls.length}`)
    for (const warning of warnings) console.warn(`WARN  ${warning}`)
    for (const error of errors) console.error(`ERROR ${error}`)
    console.log(`Итог: ${errors.length} ошибок, ${warnings.length} предупреждений`)
  }
  if (FORMAT !== 'text') console.log(JSON.stringify(report, null, 2))
  if (errors.length || (strict && warnings.length)) process.exitCode = 1
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => {
    console.error(error.message)
    process.exitCode = 1
  })
}

