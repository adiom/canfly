# SEO / OG / Schema.org

Статус на 09.08.2026. Разметка и метатеги переписаны целиком, OG-картинки
работают частично — незакрытые хвосты перечислены в конце.

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
| `/`, `/home`, `/release/**`, `/series/**`, `/characters/**`, `/news/**`, `/colors` | открыто | — |
| `/vvvvv/[editionSlug]` | **открыто** | сознательное решение: издание индексируется под своим типом. Легко потерять при рефакторинге |
| `/scroll/**` | `noindex, follow` | дубль текста издания; canonical **self**, не на `/vvvvv` — `noindex` + чужой canonical Google считает конфликтом |
| `/hi/**`, `/studio-access-denied` | `noindex, nofollow` | magic-link и служебная страница |
| `/user/[slug]` | `noindex` при `profile_is_public = false` | закрытый профиль |
| `/search`, `/profile`, `/studio/**`, `/admin/**` | закрыто ранее | не трогалось |

`/releases` — 307-редирект на каталог. Так задумано: главную можно менять.

## Что осталось доделать

### 1. `/opengraph-image` падает с 500 — sharp

```
Error: failed to pipe response
  [cause]: Error: Input buffer contains unsupported image format
```

Установлено:

- ошибка приходит из **sharp**, не из satori;
- тот же код вне Next рендерит валидный PNG (27 KB), кириллица на месте —
  значит шрифты и вёрстка целы;
- в роуте падает за ~30 мс, то есть **до** рендера;
- sharp тянет `@vercel/og` (node-сборка, `next/dist/compiled/@vercel/og/index.node.js`);
- в `node_modules` стоят **две версии** sharp: 0.34.5 и 0.35.3.

Похоже на битую нативную сборку. Первое, что стоит попробовать:

```bash
pnpm rebuild sharp
# если не помогло — снести и поставить заново
rm -rf node_modules/.pnpm/sharp* && pnpm install
```

Если дело не в сборке — смотреть, зачем `@vercel/og` вообще зовёт sharp при
рендере без внешних картинок (9 упоминаний в бандле).

Пока роут не починен, `DEFAULT_OG_IMAGE` в `lib/seo/metadata.ts` указывает на
него, то есть страницы без своего генератора отдают битый `og:image`.

### 2. Прогнать e2e и проверить остаток

```bash
pnpm exec playwright test e2e/seo.spec.ts
```

Последний прогон: 19 прошло, 3 пропущено, 2 упало. Оба падения разобраны и
поправлены в тесте (`robots: null` у открытой страницы; ссылки на серии живут
на `/home`, не в каталоге) — но прогон после правок не делался.

### 3. Валидаторы на превью

Локальный `localhost` они не видят, нужен задеплоенный препрод:

- [validator.schema.org](https://validator.schema.org)
- Google Rich Results Test
- unfurl в Telegram / WhatsApp — проверить, что кириллица в OG не превратилась
  в квадраты

### 4. Мелочи

- `isValidUrl()` в `lib/seo/schema.ts` не используется нигде — удалить или
  применить.
- `numberOfPages` у `Book` не заполняется: в `editions` нет поля. Если нужно —
  считать из `computeEditionMeta()`.
- `readBy` у `Audiobook` пустой — нет данных о чтеце в схеме БД.
- OG-картинки не покрыты тестами вообще: проверяется только то, что `og:image`
  присутствует в разметке, но не что роут отдаёт 200.
