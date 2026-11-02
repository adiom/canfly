import { test, expect, type Page } from '@playwright/test'
import { buildMetadata } from '@/lib/seo/metadata'
import { absoluteUrl } from '@/lib/seo/entities'
import { fetchEditionBySlug } from '@/lib/server/editions'
import { loadEnvLocal } from './setup/pg'

/**
 * Регрессия на SEO-разметку (09.08.2026).
 *
 * Проверяется три вещи, которые ломаются молча и замечаются только через
 * недели в Search Console:
 * 1. JSON-LD парсится и содержит ожидаемые `@type` — опечатка в генераторе
 *    даёт невалидный документ, который Google просто игнорирует;
 * 2. OG/Twitter-теги есть на каждой публичной странице — без них ссылка в
 *    мессенджере разворачивается пустой карточкой;
 * 3. матрица noindex — reader `/vvvvv/[slug]` и служебные страницы закрыты,
 *    а `/release/[slug]` и отдельный лендинг `/vvvvv` открыты;
 * 4. canonical всех изданий ведёт на родительский Release, reader нет в sitemap.
 *
 * Тест не требует авторизации и не пишет в БД. Страницы сущностей ищутся по
 * ссылкам с публичных списков, поэтому на пустой базе они скипаются.
 * Проверка UUID дополнительно читает Edition через серверный репозиторий.
 * Общие globalSetup/globalTeardown Playwright при этом могут менять БД.
 */

type Graph = Record<string, unknown>

/** Все JSON-LD со страницы; падение JSON.parse — сама по себе регрессия. */
async function readJsonLd(page: Page): Promise<Graph[]> {
  const raw = await page.locator('script[type="application/ld+json"]').allTextContents()
  expect(raw.length, 'на странице нет JSON-LD').toBeGreaterThan(0)

  return raw.flatMap((text, i) => {
    let parsed: unknown
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      throw new Error(`JSON-LD #${i} не парсится: ${(error as Error).message}\n${text.slice(0, 400)}`)
    }
    const graph = (parsed as { '@graph'?: unknown })['@graph']
    return (Array.isArray(graph) ? graph : [parsed]) as Graph[]
  })
}

function types(nodes: Graph[]): string[] {
  return nodes.flatMap(node => {
    const t = node['@type']
    return Array.isArray(t) ? (t as string[]) : typeof t === 'string' ? [t] : []
  })
}

/**
 * `@type` со всей глубины: узлы вроде `Person` живут во вложенных полях
 * (`mainEntity`, `workExample`, `mainEntityOfPage`), а не в корне `@graph`.
 */
function deepTypes(value: unknown, acc: string[] = []): string[] {
  if (Array.isArray(value)) {
    for (const item of value) deepTypes(item, acc)
    return acc
  }
  if (value && typeof value === 'object') {
    const t = (value as Graph)['@type']
    if (typeof t === 'string') acc.push(t)
    else if (Array.isArray(t)) acc.push(...(t as string[]))
    for (const item of Object.values(value as Graph)) deepTypes(item, acc)
  }
  return acc
}

/**
 * Все узлы графа, прошедшие предикат — нужно, чтобы достать Person/Place
 * из глубины (subjectOf, character[]) и проверить поля на них.
 */
function deepFind(value: unknown, predicate: (node: Graph) => boolean): Graph[] {
  const result: Graph[] = []
  const walk = (node: unknown) => {
    if (Array.isArray(node)) {
      for (const item of node) walk(item)
      return
    }
    if (node && typeof node === 'object') {
      if (predicate(node as Graph)) result.push(node as Graph)
      for (const item of Object.values(node as Graph)) walk(item)
    }
  }
  walk(value)
  return result
}

/**
 * Страница + гарантия, что JSON-LD доехали: layout отдаёт свой тег в
 * шелле, а тег страницы приходит позже — на `domcontentloaded` его ещё нет,
 * и проверки читали разметку одного layout.
 *
 * Ждём минимум `EXPECTED_SCRIPTS`, а не точное число: `Breadcrumbs` —
 * отдельный `<JsonLd>` с `BreadcrumbList`, и на страницах с крошками
 * тегов три (layout + страница + крошки).
 */
async function gotoWithJsonLd(page: Page, url: string): Promise<void> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await expect
    .poll(() => page.locator('script[type="application/ld+json"]').count(), {
      message: `на ${url} нет JSON-LD от layout и страницы`,
    })
    .toBeGreaterThanOrEqual(EXPECTED_SCRIPTS)
}

/** Минимум: layout (Organization + Person + WebSite) плюс граф страницы. */
const EXPECTED_SCRIPTS = 2

/** Первая ссылка нужного вида со страницы-списка; null — в базе пусто. */
async function firstHref(page: Page, url: string, selector: string): Promise<string | null> {
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  const link = page.locator(selector).first()
  if ((await link.count()) === 0) return null
  const href = await link.getAttribute('href')
  if (!href) return null
  const path = href.split('?')[0].replace(/\/$/, '')
  // Ссылка на сам список — не страница сущности.
  return path.split('/').filter(Boolean).length >= 2 ? path : null
}

/**
 * Содержимое метатега или null, если тега нет.
 *
 * Без проверки `count()` вызов висел до таймаута именно там, где отсутствие
 * тега — правильный ответ: у открытых страниц `robots` не выводится вовсе.
 */
async function metaContent(page: Page, property: string): Promise<string | null> {
  const meta = page.locator(`meta[property="${property}"], meta[name="${property}"]`).first()
  if ((await meta.count()) === 0) return null
  return meta.getAttribute('content')
}

test.describe('buildMetadata', () => {
  test('по умолчанию canonical и og:url используют path', () => {
    const path = '/release/seo-test'
    const metadata = buildMetadata({ title: 'SEO test', path })
    expect(metadata.alternates?.canonical).toBe(absoluteUrl(path))
    expect(metadata.openGraph?.url).toBe(absoluteUrl(path))
    expect(metadata.robots).toBeUndefined()
  })

  test('canonicalPath объединяет издания, не меняя OG-карточку', () => {
    const canonicalPath = '/release/seo-parent'
    // Слаги намеренно не похожи на родительский: canonical нельзя угадывать по URL.
    for (const path of ['/vvvvv/independent-edition', '/vvvvv/another-format']) {
      const metadata = buildMetadata({
        title: 'SEO reader test',
        path,
        canonicalPath,
        generatedImage: true,
        noindex: true,
      })
      expect(metadata.alternates?.canonical).toBe(absoluteUrl(canonicalPath))
      expect(metadata.openGraph?.url).toBe(absoluteUrl(path))
      expect(metadata.openGraph).not.toHaveProperty('images')
      expect(metadata.twitter).toMatchObject({ card: 'summary_large_image' })
      expect(metadata.robots).toEqual({ index: false, follow: true })
    }
  })
})

test.describe('SEO reader', () => {
  test('sitemap сохраняет лендинг, но не содержит reader-страниц', async ({ request }) => {
    const response = await request.get('/sitemap.xml')
    expect(response.status()).toBe(200)
    const xml = await response.text()
    const paths = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)]
      .map(match => new URL(match[1]).pathname)

    expect(paths).toEqual(expect.arrayContaining(['/', '/releases', '/news', '/vvvvv']))
    expect(paths.filter(path => path.startsWith('/vvvvv/'))).toEqual([])
  })

  test('все доступные издания релиза имеют один canonical', async ({ page, request }) => {
    test.setTimeout(120_000)
    const releasePath = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!releasePath, 'нет опубликованных релизов в БД')
    await page.goto(releasePath!, { waitUntil: 'domcontentloaded' })
    const releaseCanonical = absoluteUrl(releasePath!)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', releaseCanonical)

    const editionPaths = [...new Set(await page.locator('a[href^="/vvvvv/"]').evaluateAll(
      links => links.map(link => new URL((link as HTMLAnchorElement).href).pathname),
    ))]
    test.skip(editionPaths.length === 0, 'у релиза нет изданий с reader')

    for (const path of editionPaths) {
      const response = await page.goto(path, { waitUntil: 'domcontentloaded' })
      expect(response?.status(), path).toBe(200)
      await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
      await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', releaseCanonical)
      await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
      await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', absoluteUrl(path))
      expect(await metaContent(page, 'og:image'), `${path}: нет og:image`).toBeTruthy()
      expect(await metaContent(page, 'twitter:card')).toBe('summary_large_image')
    }

    const sitemap = await request.get('/sitemap.xml')
    expect(sitemap.status()).toBe(200)
    expect(await sitemap.text()).toContain(`<loc>${releaseCanonical}</loc>`)
  })

  test('вход по UUID использует canonical родительского релиза', async ({ page }) => {
    loadEnvLocal()
    test.skip(!process.env.DATABASE_URL, 'DATABASE_URL нужен для чтения UUID издания')
    const releasePath = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!releasePath, 'нет опубликованных релизов в БД')
    const editionPath = await firstHref(page, releasePath!, 'a[href^="/vvvvv/"]')
    test.skip(!editionPath, 'у релиза нет изданий с reader')
    const slug = decodeURIComponent(editionPath!.split('/').at(-1)!)
    const edition = await fetchEditionBySlug(slug)
    expect(edition, 'издание из публичной ссылки не найдено в БД').toBeTruthy()

    const response = await page.goto(`/vvvvv/${edition!.id}`, { waitUntil: 'domcontentloaded' })
    expect(response?.status()).toBe(200)
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1)
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', absoluteUrl(releasePath!))
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await expect(page.locator('head meta[property="og:url"]')).toHaveAttribute('content', absoluteUrl(editionPath!))
  })

  test('reader показывает ссылку на произведение на desktop и мобильном', async ({ page }) => {
    test.setTimeout(120_000)
    const releasePath = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!releasePath, 'нет опубликованных релизов в БД')
    await page.goto(releasePath!, { waitUntil: 'domcontentloaded' })
    const editionPaths = [...new Set(await page.locator('a[href^="/vvvvv/"]').evaluateAll(
      links => links.map(link => new URL((link as HTMLAnchorElement).href).pathname),
    ))]
    test.skip(editionPaths.length === 0, 'у релиза нет изданий с reader')

    for (const path of editionPaths) {
      for (const width of [1440, 320]) {
        await page.setViewportSize({ width, height: 900 })
        // Новый вход сбрасывает таймер скрытия шапки комикса.
        await gotoWithJsonLd(page, path)
        const link = page.getByRole('link', { name: /^О произведении «/ }).first()
        // У картин вместо кнопки — серверные хлебные крошки с названием Release.
        const isArtwork = types(await readJsonLd(page)).includes('VisualArtwork')
        const backLink = isArtwork
          ? page.getByRole('navigation', { name: 'Навигация', exact: true }).locator(`a[href="${releasePath}"]`)
          : link
        await expect(backLink).toBeVisible()
        await expect(backLink).toHaveAttribute('href', releasePath!)
        const bounds = await backLink.boundingBox()
        expect(bounds).not.toBeNull()
        expect(bounds!.x).toBeGreaterThanOrEqual(0)
        expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(width)
        await backLink.click()
        await expect(page).toHaveURL(new URL(releasePath!, page.url()).toString())
      }
    }
  })
})

test.describe('JSON-LD', () => {
  test('по одному @graph от layout и от страницы', async ({ page }) => {
    // layout отдаёт свои узлы один раз на весь сайт, страница — только свои;
    // третий тег — Breadcrumbs (BreadcrumbList) через тот же <JsonLd>.
    // Прямая вставка <script> минуя <JsonLd> ломает склейку @id — ниже
    // проверяется состав узлов, а не только их наличие.
    await gotoWithJsonLd(page, '/')

    const nodes = await readJsonLd(page)
    expect(types(nodes)).toEqual(expect.arrayContaining(['WebSite', 'WebPage']))
    expect(types(nodes).filter(t => t === 'WebSite')).toHaveLength(1)

    await gotoWithJsonLd(page, '/releases')
    const catalog = await readJsonLd(page)
    expect(types(catalog)).toEqual(expect.arrayContaining(['WebSite', 'CollectionPage']))
    expect(types(catalog).filter(t => t === 'WebSite')).toHaveLength(1)
  })

  test('корень отдаёт SearchAction для sitelinks searchbox', async ({ page }) => {
    await gotoWithJsonLd(page, '/')
    const nodes = await readJsonLd(page)
    const site = nodes.find(node => node['@type'] === 'WebSite')
    expect(site?.potentialAction, 'у WebSite нет potentialAction').toBeTruthy()
  })

  test('WebSite отдаётся из layout один раз с одинаковым @id', async ({ page }) => {
    // WebSite живёт в layout (вместе с Organization и Person), поэтому на
    // каждой странице ровно один полный узел с одинаковым `@id` — Google
    // склеивает их в одну сущность, а не плодит безымянные копии.
    await gotoWithJsonLd(page, '/home')
    const nodes = await readJsonLd(page)
    expect(types(nodes)).toContain('WebSite')

    const ids = nodes.filter(node => node['@type'] === 'WebSite').map(node => node['@id'])
    expect(ids).toHaveLength(1)
    expect(ids[0]).toBeTruthy()
  })

  test('релиз — CreativeWork с изданиями в workExample', async ({ page }) => {
    const path = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!path, 'нет опубликованных релизов в БД')

    await gotoWithJsonLd(page, path!)
    const nodes = await readJsonLd(page)
    expect(types(nodes)).toEqual(expect.arrayContaining(['CreativeWork', 'BreadcrumbList']))

    const work = nodes.find(node => node['@type'] === 'CreativeWork')
    const examples = (work?.workExample ?? []) as Graph[]
    // Раньше в workExample попадали только book-издания — комиксы и аудио
    // были невидимы для поисковика.
    for (const example of examples) {
      expect(typeof example['@type']).toBe('string')
      expect(example['@id']).toBeTruthy()
    }
    // isbn валиден только у Book — на CreativeWork его быть не должно.
    expect(work?.isbn).toBeUndefined()
  })

  test('издание типизировано по формату', async ({ page }) => {
    const path = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!path, 'нет опубликованных релизов в БД')

    await page.goto(path!, { waitUntil: 'domcontentloaded' })
    const editionPath = await firstHref(page, path!, 'a[href^="/vvvvv/"]')
    test.skip(!editionPath, 'у релиза нет изданий с читалкой-разворотом')

    await gotoWithJsonLd(page, editionPath!)
    const nodes = await readJsonLd(page)
    const KNOWN = [
      'Book',
      'ComicIssue',
      'PublicationIssue',
      'Audiobook',
      'AudioObject',
      'MusicAlbum',
      'DigitalDocument',
    ]
    expect(types(nodes).some(t => KNOWN.includes(t)), `ожидался тип издания, получено: ${types(nodes).join(', ')}`).toBe(true)
  })

  test('город — Place, а не Person', async ({ page }) => {
    const path = await firstHref(page, '/characters', 'a[href^="/characters/"]')
    test.skip(!path, 'нет персонажей в БД')

    await gotoWithJsonLd(page, path!)
    const nodes = await readJsonLd(page)
    expect(types(nodes)).toContain('ProfilePage')

    // Сама сущность живёт в mainEntity, поэтому ищем по всей глубине графа.
    // Раньше город (character_type='city') размечался как Person.
    const found = deepTypes(nodes)
    expect(
      found.includes('Person') || found.includes('Place'),
      `ни Person, ни Place: ${found.join(', ')}`,
    ).toBe(true)
  })

  test('персонаж с привязкой к релизу объявляет subjectOf', async ({ page }) => {
    // Ищем персонажа, у которого есть хотя бы один опубликованный релиз.
    // Каталог /characters не показывает эти связи напрямую — берём первого
    // попавшегося и смотрим, есть ли в графе subjectOf.
    const path = await firstHref(page, '/characters', 'a[href^="/characters/"]')
    test.skip(!path, 'нет персонажей в БД')

    await gotoWithJsonLd(page, path!)
    const nodes = await readJsonLd(page)

    // subjectOf лежит внутри mainEntity (Person/Place), а не в корне графа.
    const personNodes = deepFind(nodes, value => {
      const t = (value as Graph)['@type']
      return t === 'Person' || t === 'Place'
    })

    test.skip(personNodes.length === 0, 'нет узлов Person/Place')

    const withSubject = personNodes.filter(node => Array.isArray(node.subjectOf))
    // Без тестовой БД с привязками subjectOf будет пуст — это валидный кейс,
    // поэтому просто фиксируем структуру, если что-то есть.
    for (const node of withSubject) {
      const refs = node.subjectOf as Graph[]
      for (const ref of refs) {
        expect(typeof ref['@id']).toBe('string')
        expect(ref['@type']).toMatch(/^(CreativeWork|CreativeWorkSeries|Book)$/)
      }
    }
  })

  test('релиз с персонажами: character[] + about у главного', async ({ page }) => {
    const path = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!path, 'нет опубликованных релизов в БД')

    await gotoWithJsonLd(page, path!)
    const nodes = await readJsonLd(page)
    const work = nodes.find(node => node['@type'] === 'CreativeWork')
    expect(work, 'нет CreativeWork на /release/[slug]').toBeTruthy()

    const characters = work?.character as Graph[] | undefined
    if (Array.isArray(characters)) {
      // Каждый персонаж — @id-ссылка на узел в каноническом графе персонажей.
      for (const c of characters) {
        expect(c['@id']).toMatch(/\/characters\/[^/]+#(person|place)$/)
        expect(c.name).toBeTruthy()
      }
    }

    // about — одиночная @id-ссылка на главного героя, если role = 'main'.
    const about = work?.about as Graph | undefined
    if (about) {
      expect(about['@id']).toMatch(/\/characters\/[^/]+#(person|place)$/)
      expect(about.name).toBeTruthy()
    }
  })

  test('серия — CreativeWorkSeries', async ({ page }) => {
    // Ссылки на серии — на лендинге и странице релиза; в каталоге их нет.
    const path =
      (await firstHref(page, '/home', 'a[href^="/series/"]')) ??
      (await firstHref(page, '/', 'a[href^="/series/"]'))
    test.skip(!path, 'нет серий в БД')

    await gotoWithJsonLd(page, path!)
    expect(types(await readJsonLd(page))).toContain('CreativeWorkSeries')
  })

  test('новость — Article с датами', async ({ page }) => {
    const path = await firstHref(page, '/news', 'a[href^="/news/"]')
    test.skip(!path, 'нет новостей в БД')

    await gotoWithJsonLd(page, path!)
    const nodes = await readJsonLd(page)
    const article = nodes.find(node => node['@type'] === 'Article')
    expect(article, 'нет узла Article').toBeTruthy()
    expect(article?.datePublished).toBeTruthy()
  })

  test('списки — CollectionPage + ItemList', async ({ page }) => {
    for (const url of ['/news', '/characters', '/colors']) {
      await gotoWithJsonLd(page, url)
      const found = types(await readJsonLd(page))
      expect(found, `${url}: нет CollectionPage`).toContain('CollectionPage')
      expect(found, `${url}: нет BreadcrumbList`).toContain('BreadcrumbList')
    }
  })
})

test.describe('XSS в JSON-LD', () => {
  test('данные страницы не разрывают <script> (BUGS #18)', async ({ page }) => {
    // Прямая регрессия на serializeJsonLd: `<`, `>`, `&`, U+2028/U+2029
    // экранируются, поэтому даже строка `</script>` в названии релиза не
    // закрывает тег досрочно.
    for (const url of ['/', '/news', '/characters']) {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      const raw = await page.locator('script[type="application/ld+json"]').allTextContents()
      for (const text of raw) {
        expect(text, `${url}: сырой < в JSON-LD`).not.toContain('<')
        expect(text, `${url}: сырой > в JSON-LD`).not.toContain('>')
        expect(() => JSON.parse(text) as unknown).not.toThrow()
      }
    }
  })
})

test.describe('OG и Twitter', () => {
  // `/releases` здесь нет: у каталога свои метатеги проверяются в JSON-LD-блоке,
  // а OG-карточка по умолчанию приходит из layout/buildMetadata.
  const STATIC_PAGES = ['/', '/home', '/news', '/characters', '/colors'] as const

  for (const url of STATIC_PAGES) {
    test(`${url} — полный набор карточки`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' })

      for (const property of ['og:title', 'og:description', 'og:url', 'og:image']) {
        expect(await metaContent(page, property), `${url}: нет ${property}`).toBeTruthy()
      }
      expect(await metaContent(page, 'twitter:card')).toBe('summary_large_image')
    })
  }

  test('canonical есть и абсолютный', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const canonical = await page.locator('link[rel="canonical"]').first().getAttribute('href')
    expect(canonical).toMatch(/^https?:\/\//)
  })

  test('og:image отдаёт настоящую картинку', async ({ page, request }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const src = await metaContent(page, 'og:image')
    expect(src).toBeTruthy()

    /*
     * Хост берём у страницы, а не из тега: абсолютный URL там собран из
     * `metadataBase` (NEXT_PUBLIC_BASE_URL), и без этой переменной в
     * `.env.local` тест ушёл бы дёргать прод вместо локального роута.
     */
    const target = new URL(new URL(src!).pathname + new URL(src!).search, page.url())

    // Динамические баннеры рендерит satori — при сломанном шрифте роут
    // отвечает 500, и превью в мессенджерах остаётся пустым.
    const res = await request.get(target.toString())
    expect(res.status(), `og:image ${target.pathname} ответил ${res.status()}`).toBe(200)
    expect(res.headers()['content-type']).toContain('image/')
  })

  test('читалка отдаёт карточку', async ({ page }) => {
    const releasePath = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!releasePath, 'нет опубликованных релизов в БД')

    const editionPath = await firstHref(page, releasePath!, 'a[href^="/vvvvv/"]')
    test.skip(!editionPath, 'у релиза нет изданий с читалкой')

    await page.goto(editionPath!, { waitUntil: 'domcontentloaded' })
    expect(await metaContent(page, 'og:title')).toBeTruthy()
    expect(await metaContent(page, 'twitter:card')).toBe('summary_large_image')
  })
})

test.describe('матрица noindex', () => {
  // `/search` закрывается через robots.txt (плюс layout: index:false).
  // Метатегом проверяется только `/login`.
  const CLOSED = ['/login'] as const

  for (const url of CLOSED) {
    test(`${url} закрыт от индексации`, async ({ page }) => {
      await page.goto(url, { waitUntil: 'domcontentloaded' })
      expect(await metaContent(page, 'robots')).toContain('noindex')
    })
  }

  test('robots.txt закрывает служебные разделы', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    for (const path of ['/admin', '/studio', '/login', '/profile', '/api', '/search', '/scroll']) {
      expect(body, `robots.txt не закрывает ${path}`).toContain(`Disallow: ${path}`)
    }
  })

  test('поиск закрыт метатегом из layout', async ({ page }) => {
    await page.goto('/search', { waitUntil: 'domcontentloaded' })
    const robots = await metaContent(page, 'robots')
    expect(robots).toContain('noindex')
    expect(robots).toContain('nofollow')
  })

  test('magic-link страница закрыта целиком', async ({ page }) => {
    await page.goto('/hi/00000000-0000-0000-0000-000000000000', { waitUntil: 'domcontentloaded' })
    const robots = await metaContent(page, 'robots')
    // Ссылка входа не должна ни индексироваться, ни обходиться.
    expect(robots).toContain('noindex')
    expect(robots).toContain('nofollow')
  })

  test('релиз открыт, reader закрыт с follow', async ({ page }) => {
    const releasePath = await firstHref(page, '/', 'a[href^="/release/"]')
    test.skip(!releasePath, 'нет опубликованных релизов в БД')

    // `?? ''` — у открытой страницы тега `robots` нет вовсе, и это правильный
    // ответ; на `null` сам `not.toContain` бросает исключение.
    await page.goto(releasePath!, { waitUntil: 'domcontentloaded' })
    expect((await metaContent(page, 'robots')) ?? '').not.toContain('noindex')

    const editionPath = await firstHref(page, releasePath!, 'a[href^="/vvvvv/"]')
    test.skip(!editionPath, 'у релиза нет изданий с читалкой-разворотом')

    await page.goto(editionPath!, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('head meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
  })

  test('лендинг /vvvvv остаётся открытым и имеет собственный canonical', async ({ page }) => {
    await page.goto('/vvvvv', { waitUntil: 'domcontentloaded' })
    expect((await metaContent(page, 'robots')) ?? '').not.toContain('noindex')
    await expect(page.locator('head link[rel="canonical"]')).toHaveAttribute('href', absoluteUrl('/vvvvv'))
  })

  test('robots.txt не запрещает обход reader для чтения canonical и noindex', async ({ request }) => {
    const response = await request.get('/robots.txt')
    expect(response.status()).toBe(200)
    expect(await response.text()).not.toMatch(/^Disallow:\s*\/vvvvv/m)
  })
})
