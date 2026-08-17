# SEO / OG / Schema.org

Статус на 17.08.2026. Разметка и метатеги переписаны целиком, OG-картинки
работают. Незакрытые хвосты перечислены в конце.

## Как это устроено

| Файл | Ответственность |
|---|---|
| `lib/seo/serialize.ts` | `serializeJsonLd()` — экранирование `<`, `>`, `&`, U+2028/2029. Защита от XSS (BUGS #18), трогать нельзя |
| `lib/seo/entities.ts` | `@id`-константы, узлы `organizationNode()` / `authorNode()` / `websiteNode()`, карта `EDITION_SCHEMA_TYPE` |
| `lib/seo/schema.ts` | генераторы схем по страницам — публичный API |
| `lib/seo/metadata.ts` | `buildMetadata()`, `notFoundMetadata()`, `stripHtml()`, `truncate()` |
| `lib/seo/og-shared.tsx` | вёрстка OG-картинок: `ogResponse()`, `ogLayout()`, `ogFallback()`, `ogClamp()` |
| `lib/seo/og-fonts.ts` | чтение `.ttf` из `assets/og/` с кэшем на уровне модуля |
| `components/seo/json-ld.tsx` | `<JsonLd schemas={[...]} />` — один `<script>` с `@graph` |

### `@id`-граф

Сущности связаны ссылками, а не копиями объектов:

```
${BASE_URL}/#organization      издательство
${BASE_URL}/#website           сайт (только на корне, с SearchAction)
${BASE_URL}/#author            Адиом Тимур
${BASE_URL}/release/{slug}#work
${BASE_URL}/vvvvv/{slug}#edition
${BASE_URL}/characters/{slug}#person | #place
${BASE_URL}/series/{slug}#series
```

Полные узлы `Organization` и `Person` (автор) отдаёт `app/layout.tsx` — один
раз на весь сайт. Страницы ссылаются на них через `{ '@id': ... }`.

**Два `<script type="application/ld+json"`> на странице — это норма:** один от
layout, один от самой страницы. Больше двух означает, что кто-то вставил тег
напрямую, минуя `<JsonLd>`.

### Тип schema.org по формату издания

`EDITION_SCHEMA_TYPE` — это `Record<EditionFormat, string>`, поэтому новый
формат в `lib/releases-types.ts` **сломает сборку**, а не выпадет молча.

| `EditionFormat` | `@type` |
|---|---|
| `book` | `Book` |
| `magazine` | `PublicationIssue` |
| `comic` | `ComicIssue` |
| `audiobook` | `Audiobook` |
| `audiorelease` | `AudioObject` |
| `album` | `MusicAlbum` |
| `digital` | `DigitalDocument` |

### Матрица индексации

| Маршрут | robots | Почему |
|---|---|---|
| `/`, `/home`, `/release/**`, `/series/**`, `/characters/**`, `/news/**` | открыто | — |
| `/colors` | открыто | контентная страница вселенной (18 цветов с историями из `lib/canfly-colors.ts`), не дизайн-система. Покрыта e2e-тестом `seo.spec.ts:284` как публичная. Закрывать от индексации не нужно |
| `/vvvvv/[editionSlug]` | **открыто** | единый canonical для всех форматов (book, comic, magazine, audio). Легко потерять при рефакторинге |
| `/hi/**`, `/studio-access-denied` | `noindex, nofollow` | magic-link и служебная страница |
| `/user/[slug]` | `noindex` при `profile_is_public = false` | закрытый профиль |
| `/search`, `/profile`, `/studio/**`, `/admin/**` | закрыто ранее | не трогалось |

`/releases` — полноценная страница каталога (не редирект). `/home` — лендинг
через 301 из `proxy.ts`. Тест `e2e/legacy.spec.ts:65` проверяет 307 из `/releases`
на `/` — это устаревшее поведение (каталог временно жил на корне); тест
нуждается в обновлении.

## Что осталось доделать

### 1. ~~`/opengraph-image` падает с 500 — sharp~~ ✅ решено

Корневая причина: в `node_modules` стояли **две версии sharp** (0.34.5 и 0.35.3) —
конфликт нативных биндингов. `@vercel/og` (внутри `next/dist/compiled/`) делал
`import("sharp")`, и при pnpm-структуре резолвился не тот экземпляр.

Решение (17.08.2026): Next обновлён 16.2.7 → 16.3.0 (lock-файл теперь
содержит только sharp 0.35.3), добавлен `overrides: { sharp: 0.35.3 }` в
`pnpm-workspace.yaml` для защиты от будущих конфликтов, мёртвые копии 0.34.5
и `@img/sharp-libvips-darwin-arm64@1.2.4` удалены.

Как это работает: compiled `@vercel/og/index.node.js` содержит `getSharp()`,
который динамически импортирует sharp. Если sharp доступен — конвертирует
SVG→PNG через sharp; если нет — fallback на `resvg.wasm` (wasm-based). При
конфликтующих версиях sharp загружался, но падал на декодировании SVG с ошибкой
`Input buffer contains unsupported image format`.

### 2. ~~Прогнать e2e и проверить остаток~~

Последний прогон: 19 прошло, 3 пропущено, 2 упало. Оба падения разобраны и
поправлены в тесте (`robots: null` у открытой страницы; ссылки на серии живут
на `/home`, не в каталоге). Прогон после правок не делался — нужен `pnpm exec playwright test e2e/seo.spec.ts`

### 3. Валидаторы на превью

Локальный `localhost` они не видят, нужен задеплоенный препрод:

- [validator.schema.org](https://validator.schema.org)
- Google Rich Results Test
- unfurl в Telegram / WhatsApp — проверить, что кириллица в OG не превратилась
  в квадраты

### 4. Мелочи

- `numberOfPages` у `Book` не заполняется: в `editions` нет поля. Если нужно —
  считать из `computeEditionMeta()`.
- `readBy` у `Audiobook` пустой — нет данных о чтеце в схеме БД.
- OG-картинки не покрыты тестами вообще: проверяется только то, что `og:image`
  присутствует в разметке, но не что роут отдаёт 200.
