# SEO / OG / Schema.org — canfly

Статус на **25 августа 2026**. Разметка и метатеги переписаны целиком, OG-картинки работают. Все ключевые маршруты покрыты JSON-LD и breadcrumbs.

---

## Архитектура

| Файл | Ответственность |
|------|-----------------|
| `lib/seo/serialize.ts` | `serializeJsonLd()` — экранирование `<`, `>`, `&`, U+2028/2029. Защита от XSS (BUGS #18). |
| `lib/seo/entities.ts` | `@id`-константы, узлы `organizationNode()` / `authorNode()` / `websiteNode()`, карта `EDITION_SCHEMA_TYPES` (Record<EditionFormat, ...> — новый формат ломает сборку), утилиты: `editionUrl()`, `toISO8601Duration()`, `toISODate()`. |
| `lib/seo/schema.ts` | Генераторы схем по страницам: `generateReleaseSchema`, `generateEditionSchema`, `generateSeriesSchema`, `generateCharacterSchema`, `generateProfilePageSchema`, `generateQuotationSchema`, `generateNewsArticleSchema`, `generateBreadcrumbSchema`, `generateCollectionSchema`, `generateWebPageSchema`. |
| `lib/seo/metadata.ts` | `buildMetadata()` — единая сборка title/description/canonical/OG/Twitter; `notFoundMetadata()`, `stripHtml()`, `truncate()`, `truncateSeoDescription()`. `DEFAULT_OG_IMAGE = '/opengraph-image'` (относительный путь — работает в dev и проде через `metadataBase`). |
| `lib/seo/og-shared.tsx` | Вёрстка OG-картинок: `ogResponse()`, `ogLayout()`, `ogFallback()`, `ogClamp()`. |
| `lib/seo/og-fonts.ts` | Чтение `.ttf` из `assets/og/` с кэшем на уровне модуля. |
| `components/seo/json-ld.tsx` | `<JsonLd schemas={[...]} />` — один `<script>` с `@graph`. Все узлы страницы в одном графе, чтобы `{ '@id': ... }` резолвились. |
| `app/layout.tsx` | Отдаёт полные узлы `Organization`, `Person` (автор) и `WebSite` **ровно один раз**. Остальные страницы ссылаются по `@id`. |
| `app/robots.ts` | Правила индексации (см. матрицу ниже). |
| `app/sitemap.ts` | Карта сайта: индексируемые публичные хабы и опубликованные релизы, новости, персонажи, места, игры, серии с релизами и публичные авторы. Edition `/vvvvv/[slug]` исключены: их canonical ведёт на Release. Обновление каждые 5 минут. |

---

## `@id`-граф

Сущности связаны ссылками, а не копиями объектов:

```
${BASE_URL}/#organization      — издательство (Organization)
${BASE_URL}/#website           — сайт (WebSite, из layout, с SearchAction)
${BASE_URL}/#author            — Адиом Тимур (Person)
${BASE_URL}/release/{slug}#work        — произведение (CreativeWork)
${BASE_URL}/vvvvv/{slug}#edition       — издание (Book/ComicIssue/Audiobook/…)
${BASE_URL}/characters/{slug}#person   — персонаж (Person)
${BASE_URL}/characters/{slug}#place    — город (Place)
${BASE_URL}/series/{slug}#series       — серия (CreativeWorkSeries)
${BASE_URL}/user/{handle}#person       — читатель (Person)
${BASE_URL}/highlight/{id}#quote       — цитата (Quotation)
```

**Два и более `<script type="application/ld+json">` на странице — это норма:** один от `layout` (Organization + Person + WebSite), один от самой страницы (через `<JsonLd>`), третий — от `Breadcrumbs` (`BreadcrumbList`, тоже через `<JsonLd>`). Вставка тега напрямую в JSX, минуя `<JsonLd>`, ломает склейку `@id` и XSS-экранирование.

---

## Тип schema.org по формату издания

`EDITION_SCHEMA_TYPES: Record<EditionFormat, EditionTypeSpec>` — намеренно строгий, новый формат в `lib/releases-types.ts` **сломает сборку**, а не выпадет молча.

| `EditionFormat` | `@type` | `seriesType` (isPartOf) | `bookFormat` |
|-----------------|---------|------------------------|--------------|
| `book` | `Book` | `BookSeries` | `EBook` |
| `magazine` | `PublicationIssue` | `Periodical` | — |
| `comic` | `ComicIssue` | `ComicSeries` | — |
| `audiobook` | `Audiobook` | `BookSeries` | `AudiobookFormat` |
| `audiorelease` | `AudioObject` | — | — |
| `album` | `MusicAlbum` | — | — |
| `digital` | `DigitalDocument` | — | — |

---

## Матрица индексации (robots.ts)

| Маршрут | robots | Причина |
|---------|--------|---------|
| `/`, `/releases`, `/release/**`, `/series/**`, `/characters/**`, `/news/**` | `allow` | Публичный контент |
| `/colors` | `allow` | Контентная страница вселенной (18 цветов с историями из `lib/canfly-colors.ts`), не дизайн-система. Покрыта e2e `seo.spec.ts`. |
| `/vvvvv/[editionSlug]` | `allow` + `noindex, follow` | Страница Edition доступна обходу, canonical указывает на родительский Release. Edition не попадает в sitemap. |
| `/games` | `noindex` | Хаб игр не индексируется; опубликованные игры имеют отдельные индексируемые страницы. |
| `/series/[slug]` без опубликованных релизов | `noindex` | Пустая серия не включается в sitemap. |
| `/hi/**`, `/studio-access-denied` | `noindex, nofollow` | Magic-link и служебная страница |
| `/user/[slug]` | `noindex` при `profile_is_public = false` | Закрытый профиль. Реализовано в `generateMetadata` страницы через `noindex: !user.profile_is_public`. |
| `/search`, `/profile`, `/studio/**`, `/admin/**` | `disallow` в robots.txt | Не публичные разделы |

**Важно:** `/releases` — полноценная страница каталога (не редирект). `/home` — лендинг через 301 из `proxy.ts`. Старый тест `e2e/legacy.spec.ts:65` проверял 307 из `/releases` на `/` — это устаревшее поведение (каталог временно жил на корне); тест нуждается в обновлении.

---

## OG-картинки

- **Корневой генератор:** `app/opengraph-image.tsx` — баннер по умолчанию (`DEFAULT_OG_IMAGE = '/opengraph-image'`).
- **Страничные генераторы** (файловая конвенция Next.js): `app/release/[slug]/opengraph-image.tsx`, `app/vvvvv/[slug]/opengraph-image.tsx`, `app/characters/[slug]/opengraph-image.tsx`, `app/series/[slug]/opengraph-image.tsx`, `app/news/[slug]/opengraph-image.tsx`, `app/highlight/[id]/opengraph-image.tsx`, `app/user/[slug]/opengraph-image.tsx`.
- В `buildMetadata`:
  - `generatedImage: true` → Next сам подхватит `opengraph-image.tsx` в том же сегменте.
  - `generatedImage: false` (дефолт) → используется `DEFAULT_OG_IMAGE` (корневой баннер).
  - `image: '...'` — явный URL (используется редко).

**Sharp-конфликт (решен 17.08.2026):** В `node_modules` стояли две версии sharp (0.34.5 и 0.35.3). `@vercel/og` внутри `next/dist/compiled/` делал `import("sharp")` и мог загрузить не ту копию → 500 на декодировании SVG. Решение: Next 16.2.7 → 16.3.0 (lock-файл содержит только 0.35.3), `overrides: { sharp: 0.35.3 }` в `pnpm-workspace.yaml`, мёртвые копии удалены.

---

## Sitemap

`app/sitemap.ts` собирает:
- Статические индексируемые хабы: корень (`LANDING_PATH`), `/releases`, `/news`, `/characters`, `/colors`, `/vvvvv`.
- Все опубликованные Release с `priority: 0.9` и обложкой, если она задана.
- Все опубликованные новости без лимита в 100 записей.
- Публичных персонажей, места, опубликованные игры, серии с опубликованными релизами и публичные профили авторов.
- Не включает Edition `/vvvvv/[slug]`: это отдельная сущность с `noindex, follow` и canonical на Release.
- `lastmod` задаётся только для сущностей с датой изменения; статическим страницам его не приписывают.

Маршрут обновляется через ISR каждые 300 секунд, поэтому новая публикация попадёт в карту без ожидания следующего production build. При приближении к 50 000 URL карту нужно разделить.

---

## Breadcrumbs + JSON-LD `BreadcrumbList`

Компонент `components/breadcrumbs.tsx` — визуальные крошки + JSON-LD в одном. Используется на 12+ публичных страницах.

Генерация схемы: `generateBreadcrumbSchema(items: Array<{label, url}>)`.

Примеры цепочек:

| Страница | Крошки |
|----------|--------|
| `/release/[slug]` (с серией) | canfly › Серии › {series} › {title} |
| `/release/[slug]` (без серии) | canfly › Релизы › {title} |
| `/vvvvv/[slug]` (с серией) | canfly › Серии › {series} › {title} › Читать |
| `/vvvvv/[slug]` (без серии) | canfly › Релизы › {title} › Читать |
| `/series/[slug]` | canfly › Серии › {title} |
| `/characters/[slug]` | canfly › Персонажи › {name} |
| `/news/[slug]` | canfly › Новости › {title} |
| `/highlight/[id]` | canfly › Релизы › {title} › Цитата (+ серия если есть) |
| `/user/[slug]` | canfly › @{handle} |

---

## Метаданные страниц (buildMetadata)

Единая функция `buildMetadata(opts)` собирает:
- `title`, `description` (обрезается по словам до 155 символов, точка в конце)
- `alternates.canonical` = `${BASE_URL}${path}`
- `robots: { index: false, follow: true }` если `noindex: true`
- `openGraph`: title, description, url, siteName, locale `ru_RU`, type (`website` | `article` | `book` | `profile`), `images` (если `generatedImage: true` — Next сам подставит страничный OG, иначе корневой `/opengraph-image`)
- `twitter`: `summary_large_image` + те же title/description/images

**og:type по страницам:**
- `/release/[slug]` → `book` (опубликованные издания есть)
- `/vvvvv/[slug]` → `book` для читаемых форматов, `website` для аудио (`isAudioFormat`)
- `/characters/[slug]` → `profile` для людей, `website` для городов
- `/news/[slug]` → `article` (есть `publishedTime`, `modifiedTime`)
- `/highlight/[id]` → `article`
- `/user/[slug]` → `profile`
- Остальные → `website`

---

## Что осталось доделать

### 1. Прогнать e2e и проверить остаток
Последний прогон: падали тесты на `robots: null` у открытой страницы и ссылки на серии в каталоге (ожидались на `/home`, реальны на `/releases`). Нужно: `pnpm exec playwright test e2e/seo.spec.ts`.

### 2. Валидаторы на превью
Локальный `localhost` они не видят, нужен задеплоенный препрод:
- [validator.schema.org](https://validator.schema.org)
- Google Rich Results Test
- unfurl в Telegram / WhatsApp — проверить, что кириллица в OG не превратилась в квадраты

### 3. Мелочи в разметке
- `numberOfPages` у `Book` заполняется из `computeEditionMeta()` (chapterCount) — работает.
- `readBy` у `Audiobook` пустой — нет данных о чтеце в схеме БД.
- OG-картинки не покрыты тестами: проверяется только наличие `og:image` в разметке, а не что роут отдаёт 200.
- `isbn` у `Book` в `workExample` — только если `edition.format === 'book'` (раньше был на произведении невалидно).
- `wordCount`, `timeRequired` (PT{M}M), `duration` (ISO 8601) — считаются через `computeEditionMeta` и `toISO8601Duration`.

### 4. Каталог (`/releases`) и лендинг (`/`)
- `app/releases/page.tsx` — `force-dynamic`, 19 вызовов `dbQuery`, кэширования нет (баг #5 — холодный старт Neon).
- `proxy.ts` делает 301 `/` → `/releases`? Нет, сейчас `/` — лендинг, `/releases` — каталог. 301 из `/home` на `/` (лендинг временно жил на `/home`).
- `CATALOG_PATH = '/releases'` в `lib/nav.ts` — единственный источник правды для ссылок на каталог.

---

## Как проверить локально

```bash
# Сборка и линт
pnpm build
pnpm lint

# E2E SEO-тесты
pnpm exec playwright test e2e/seo.spec.ts

# Проверить robots.txt
curl http://localhost:3000/robots.txt

# Проверить sitemap.xml
curl http://localhost:3000/sitemap.xml

# Проверить OG-генератор (должен быть 200)
curl -sS -o /dev/null -w "%{http_code}" http://localhost:3000/opengraph-image
```

## Проверки аудита (5 ноября 2026)

Canonical `/releases` сохраняет query-параметры каталога. Sitemap обновляется
раз в пять минут, содержит все опубликованные новости и исключает серии без
опубликованных релизов. Пустые страницы серии остаются доступными, но получают
`noindex` и не включаются в карту.

Read-only аудит локального, preview или production-сайта:

```sh
node scripts/seo-audit.mjs http://localhost:3000
node scripts/seo-audit.mjs https://canfly.org --format=json
node scripts/seo-audit.mjs https://preview.example --limit=25 --strict
```

Скрипт обходит sitemap index, проверяет XML-структуру и URL, HTTP-статусы,
canonical, robots, title, description, H1, Open Graph, Twitter Card, JSON-LD и дубликаты URL. Запросы ограничены origin проверяемого
сайта; внешний redirect не обходится. Полный HTML учитывает streaming metadata
Next.js. `--format=text|json|both` выбирает отчёт; по умолчанию выводятся текст
и JSON. Ошибки возвращают код 1, а `--strict` включает предупреждения.

Проверяй `/sitemap.xml`, `/robots.txt` и изменённые URL после деплоя. Аудит не
читает Search Console или Яндекс Вебмастер и не проверяет внешние ресурсы.
