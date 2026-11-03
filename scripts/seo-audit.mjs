/**
 * SEO-аудит публичных страниц: обходит sitemap и проверяет то, что ломается
 * молча — заголовки, описания, canonical, robots и JSON-LD.
 *
 * Запуск (нужен поднятый сервер):
 *   node scripts/seo-audit.mjs http://localhost:3000
 *   SEO_AUDIT_BASE_URL=https://canfly.org node scripts/seo-audit.mjs
 *
 * Параметры:
 *   --limit=N   проверить первые N страниц (удобно для быстрого прогона)
 *   --strict    считать предупреждения ошибками (по умолчанию только errors)
 *
 * Скрипт ничего не пишет в БД и не ходит дальше sitemap. Код возврата 1,
 * если хотя бы одна страница не прошла проверку.
 */

const args = process.argv.slice(2)
const baseArg = args.find(arg => arg.startsWith('http://') || arg.startsWith('https://'))
const limitArg = args.find(arg => arg.startsWith('--limit='))
const strict = args.includes('--strict')

const BASE_URL = (
  baseArg ||
  process.env.SEO_AUDIT_BASE_URL ||
  process.env.NEXT_PUBLIC_BASE_URL ||
  'http://localhost:3000'
).replace(/\/$/, '')

const LIMIT = limitArg ? Number.parseInt(limitArg.slice('--limit='.length), 10) : Number.POSITIVE_INFINITY
const CONCURRENCY = 4

const errors = []
const warnings = []

function decodeEntities(value) {
  return value
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(Number.parseInt(code, 16)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
}

function textOf(html, tag) {
  const match = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i').exec(html)
  return match ? decodeEntities(match[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim() : null
}

function attrOf(html, tag, attr) {
  const regex = new RegExp(`<${tag}[^>]*\\s${attr}=("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i')
  const match = regex.exec(html)
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null
}

function metaContent(html, name) {
  const tags = [...html.matchAll(/<meta\b[^>]*>/gi)].map(match => match[0])
  for (const tag of tags) {
    const key = attrOf(tag, 'meta', 'property') ?? attrOf(tag, 'meta', 'name')
    if (key === name) return attrOf(tag, 'meta', 'content')
  }
  return null
}

/** Все JSON-LD на странице; `null` — тег есть, но не парсится. */
function readJsonLd(html) {
  const blocks = [...html.matchAll(
    /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )].map(match => match[1])

  return blocks.map(raw => {
    try {
      return JSON.parse(raw)
    } catch {
      return null
    }
  })
}

/** Грубая оценка видимого текста: без script/style и разметки. */
function visibleWordCount(html) {
  const body = /<body[^>]*>([\s\S]*?)<\/body>/i.exec(html)?.[1] ?? html
  const text = body
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
  return decodeEntities(text).split(/\s+/).filter(word => /\p{L}|\d/u.test(word)).length
}

async function fetchSitemapUrls() {
  const response = await fetch(`${BASE_URL}/sitemap.xml`, { redirect: 'follow' })
  if (!response.ok) {
    throw new Error(`sitemap.xml ответил ${response.status}`)
  }

  const xml = await response.text()
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
    .map(match => decodeEntities(match[1]))
    // Sitemap собирается от metadataBase (прод-домен). При локальном прогоне
    // подменяем origin на проверяемый сервер, путь оставляем как есть.
    .map(loc => new URL(new URL(loc).pathname, BASE_URL).toString())
  // sitemap-index: раскрываем вложенные карты.
  if (/<sitemapindex/i.test(xml)) {
    const nested = []
    for (const loc of locs) {
      const child = await fetch(loc)
      if (!child.ok) continue
      const childXml = await child.text()
      nested.push(
        ...[...childXml.matchAll(/<loc>([^<]+)<\/loc>/g)]
          .map(match => decodeEntities(match[1]))
          .map(childLoc => new URL(new URL(childLoc).pathname, BASE_URL).toString()),
      )
    }
    return nested
  }
  return locs
}

function canonicalHref(html) {
  const tag = /<link\b[^>]*rel=["']canonical["'][^>]*>/i.exec(html)?.[0]
  if (!tag) return null
  const match = /\shref=("([^"]*)"|'([^']*)'|([^\s>]+))/i.exec(tag)
  return match ? decodeEntities(match[2] ?? match[3] ?? match[4] ?? '') : null
}

function checkPage(url, html) {
  const pageErrors = []
  const pageWarnings = []

  const title = textOf(html, 'title')
  if (!title) pageErrors.push('нет <title>')
  else {
    if (title.length > 65) pageWarnings.push(`title ${title.length} символов (>65)`)
    if (title.length < 10) pageWarnings.push(`title слишком короткий (${title.length})`)
  }

  const description = metaContent(html, 'description')
  if (!description) pageErrors.push('нет meta description')
  else {
    if (description.length > 165) pageWarnings.push(`description ${description.length} символов (>165)`)
    if (description.length < 50) pageWarnings.push(`description слишком короткий (${description.length})`)
  }

  const robots = metaContent(html, 'robots')
  if (robots && /noindex/i.test(robots)) pageWarnings.push(`noindex в sitemap: ${robots}`)

  const canonical = canonicalHref(html)
  if (!canonical) pageErrors.push('нет canonical')
  else {
    try {
      const path = new URL(canonical, url).pathname.replace(/\/$/, '') || '/'
      const own = new URL(url).pathname.replace(/\/$/, '') || '/'
      if (path !== own) pageWarnings.push(`canonical ведёт на ${path}`)
    } catch {
      pageErrors.push(`canonical не URL: ${canonical}`)
    }
  }

  const jsonLd = readJsonLd(html)
  if (jsonLd.length === 0) pageErrors.push('нет JSON-LD')
  else if (jsonLd.some(block => block === null)) pageErrors.push('JSON-LD не парсится')

  const words = visibleWordCount(html)
  if (words < 80) pageWarnings.push(`мало текста: ${words} слов`)

  return { pageErrors, pageWarnings }
}

async function audit(url) {
  const response = await fetch(url, { redirect: 'follow' })
  if (!response.ok) {
    errors.push(`${url}: HTTP ${response.status}`)
    return
  }

  const html = await response.text()
  const { pageErrors, pageWarnings } = checkPage(url, html)
  for (const message of pageErrors) errors.push(`${url}: ${message}`)
  for (const message of pageWarnings) warnings.push(`${url}: ${message}`)
}

async function main() {
  console.log(`SEO-аудит: ${BASE_URL}`)
  const urls = (await fetchSitemapUrls()).slice(0, LIMIT)
  console.log(`Страниц в sitemap: ${urls.length}`)

  let index = 0
  const workers = Array.from({ length: CONCURRENCY }, async () => {
    while (index < urls.length) {
      const url = urls[index++]
      try {
        await audit(url)
      } catch (error) {
        errors.push(`${url}: ${error.message}`)
      }
      if (index % 20 === 0) console.log(`  проверено ${index}/${urls.length}`)
    }
  })
  await Promise.all(workers)

  for (const message of warnings) console.warn(`WARN  ${message}`)
  for (const message of errors) console.error(`ERROR ${message}`)

  const failed = errors.length + (strict ? warnings.length : 0)
  console.log(
    `\nИтог: страниц ${urls.length}, ошибок ${errors.length}, предупреждений ${warnings.length}`,
  )
  process.exit(failed > 0 ? 1 : 0)
}

main().catch(error => {
  console.error(error.message)
  process.exit(1)
})
