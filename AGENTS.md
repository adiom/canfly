# AGENTS.md

Этот файл — руководство для Claude Code (claude.ai/code) и других AI-агентов при работе с кодом в этом репозитории.
`CLAUDE.md` импортирует его целиком (`@AGENTS.md`), так что правки вносятся сюда.

**ВСЕГДА ОТВЕЧАЙ НА РУССКОМ И ПИШИ ЛАКОНИЧНО.**

---

## Проект

**canfly | культура твоего сознания** — литературная вселенная и веб-платформа: релизы (книги, комиксы, журналы, аудиокниги), Studio для авторов, соцсеть AI-персонажей.

Стек: Next.js 16.2.7 (App Router) · React 19.2.7 · TypeScript 5.7.3 (strict) · Tailwind v4 · shadcn/ui (new-york) · Postgres (Neon/Vercel) через `pg` Pool **без ORM** · next-auth v5 beta · Vercel AI SDK v6 · Vercel Blob · pnpm 11.

Актуальные версии зависимостей смотреть в `package.json` — не полагаться на числа в документации.

## Команды

```bash
pnpm dev            # Turbopack, NODE_OPTIONS с --max-old-space-size=3072 (8 GB RAM)
pnpm build          # обязательная проверка типов перед коммитом
pnpm lint           # eslint . (flat config, typescript-eslint)
pnpm start          # прод-сборка

pnpm test:e2e       # все Playwright-тесты
pnpm test:smoke     # только e2e/smoke.spec.ts
pnpm exec playwright test e2e/studio.spec.ts            # один файл
pnpm exec playwright test e2e/studio.spec.ts:42         # один тест по строке
pnpm exec playwright test -g "название теста"           # один тест по имени
pnpm exec playwright test --headed --debug              # отладка

pnpm db:structure   # выгрузка структуры БД (scripts/read-db-structure.mjs)
pnpm sync:tasks     # регенерация docs/BUGS.md и docs/TASKS.md из GitHub Issues
```

Для e2e нужен `DATABASE_URL` в `.env.local`: `globalSetup` создаёт в БД тестового админа (`studio-test-admin@canfly.test`), `globalTeardown` его удаляет. Логин в тестах идёт через реальный magic-link UI (`e2e/setup/login-helper.ts`): в dev-режиме код показывается на странице, Playwright забирает его из DOM. `webServer` поднимает `pnpm dev` (в CI — `pnpm start`).

## Архитектура: что нужно понимать до правок

### 1. Две параллельные системы контента

В репозитории сосуществуют legacy- и актуальная системы. **Все новые фичи — только в Release-систему.**

| Legacy (заморожен) | Release (актуальный) |
|---|---|
| таблицы `books`, `characters` | `releases` → `editions` → `chapters` (+ `chapter_versions`) |
| `app/books/[slug]`, `components/book-reader.tsx` | `app/release/[slug]/**`, `components/release-*.tsx` |
| `app/admin/` + `app/api/admin/` | `app/studio/` + server actions в `lib/actions/` |
| `/shop`, `/cart`, `POST /api/orders` (отвечает 410) | `app/releases/` — каталог |

`proxy.ts` уже редиректит legacy-маршруты (`/books/*`, `/shop/*`, `/cart/*`) в Release-систему — новые ссылки на них не создавать.

Иерархия данных: **release** (произведение) → **edition** (издание конкретного формата: book/comic/magazine/audio, у book ещё `quality_tier` ∈ draft/standard/premium) → **chapter** (+ версии). Один и тот же релиз может иметь несколько изданий разных форматов, отсюда две ветки маршрутов ридера:

- `/release/[slug]/book/[qualityTier]/[chapterIndex]` — SEO-вариант для book;
- `/release/[slug]/[editionSlug]/[chapterIndex]` — comic/magazine/audio.

### 2. Middleware называется `proxy.ts`

Не `middleware.ts` — файла с таким именем нет и создавать его не нужно. `proxy.ts` экспортирует `proxy()` и `config` и отвечает за:

- JWT-гварды `/profile`, `/admin` (нужна роль `admin`, иначе → `/admin/login`), `/studio` (**только факт авторизации** — роли проверяются глубже, в layout по БД);
- редирект `/login` → `/` для авторизованных;
- 301-нормализацию: `/release` → `/releases/`, приведение `/release/[slug]` к нижнему регистру;
- редиректы legacy-маршрутов.

Пропускаются без обработки `/api/auth`, `/api/magic`, `/hi/`.

### 3. Авторизация — три слоя

1. **`proxy.ts`** — грубый JWT-гвард по URL.
2. **`app/(auth)/auth.config.ts`** — `createAuthConfig()`, стратегия JWT, `trustHost: true`. Провайдеры: Credentials (magic link), Yandex, Google, GitHub, canfly OIDC SSO — каждый включается только при наличии своих env-переменных. Роли грузятся из `user_roles` при логине и кэшируются в JWT (модульная аугментация `Session`/`User`/`JWT`: `id`, `type`, `login`, `handle`, `roles`).
3. **`lib/server/studio-auth.ts`** — авторитетная проверка в server actions и `page.tsx`:
   - `requireStudioSession()` — author | editor | admin (возвращает `null`, не бросает);
   - `requireStudioAdminSession()`, `requireAuthorOrAdminSession()`;
   - `requireReleaseOwnership(id)` / `requireEditionOwnership(id)` / `requireChapterOwnership(id)` — владение через `release_collaborators.role = 'owner'`, admin проходит всегда, иначе `redirect('/studio')`. **Каждая мутация чужой сущности обязана проходить через них — это защита от IDOR.**

Роли: `reader` (по умолчанию) | `author` | `editor` | `admin`.

**Magic link работает полностью**: `app/(auth)/actions.ts` отправляет письмо через Postmark (`POSTMARK_SERVER_TOKEN`, `POSTMARK_FROM_EMAIL`), код генерируется через `crypto.randomInt`. Погашение токена — только в `lib/server/magic-token.ts`: один атомарный `UPDATE ... WHERE used = false AND expires_at > NOW() AND attempts < 5 RETURNING` (compare-and-swap, защита от гонки и брутфорса), вызывается исключительно из `Credentials.authorize`. Логина по «голому» email не существует. `POST /api/cron/cleanup` (Vercel Cron, `vercel.json`, 04:00) чистит использованные/протухшие токены, проверяя `Authorization: Bearer $CRON_SECRET`.

### 4. Слой данных

`lib/db.ts` — единственная точка доступа к Postgres: `dbQuery<T>()`, `dbQueryOne<T>()`, `withTransaction(fn)` для многошаговых мутаций. Пул намеренно маленький (`max: 3`) под serverless. `normalizeConnectionString()` переписывает `sslmode=require|prefer|verify-ca` в `verify-full` — обход смены семантики в pg v9; строку подключения читает из `DATABASE_URL` / `POSTGRES_URL` / `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING`.

Запросы не разбросаны по компонентам: репозитории живут в `lib/server/*` (releases, editions, chapters, characters, news, search, reading-progress, chapter-highlights и т.д.). Новая работа с БД — туда же, а не в page/route.

**Схема БД правится только миграцией в `postgres/`.** Файлы идемпотентны (ENUM'ы через `DO $$ ... EXCEPTION WHEN duplicate_object`), применяются по порядку: `schema.sql` → `002_release_system.sql` … `013_rate_limits.sql`, плюс `highlights-migration.sql` и `postgres/migrations/001_magic_tokens.sql`.

### 5. Security-слой (появился в хотфиксе 29.07.2026 — не ломать)

- `lib/server/rate-limit.ts` — fixed-window лимитер на Postgres (без Redis): атомарный `INSERT ... ON CONFLICT (bucket, subject, window_start) DO UPDATE SET hits = hits + 1 RETURNING`, `rateLimitResponse()` отдаёт 429 с `Retry-After`. Применён к AI-чату персонажей (60/час) и LLM-эндпоинтам хайлайтов.
- `lib/ai/highlight-actions.ts` — `guardHighlightRequest()`: авторизация + zod (`text` ≤ 600 символов) + лимит 30/час; общий гвард для `/api/highlights/{explain,meaning,rewrite,illustrate}`. Открытых LLM-эндпоинтов быть не должно.
- `lib/server/image-upload.ts` — валидация загрузок по сигнатуре байтов, а не по MIME из запроса.
- `lib/sanitize.ts` — на `sanitize-html` (DOMPurify/isomorphic-dompurify удалены). Санитизация делается **на сервере перед записью**, а не только при рендере.
- `next.config.mjs` → `headers()` — CSP (`frame-ancestors 'none'`, `form-action 'self'`, `object-src 'none'`), HSTS, `X-Frame-Options: DENY`, `nosniff`, Referrer-Policy, Permissions-Policy. `'unsafe-inline'/'unsafe-eval'` в `script-src` нужны бутстрапу Next.js — остальное закрыто.
- `POST /api/orders` отвечает 410: цена приходила с клиента.
- Регрессии на это покрыты `e2e/auth-security.spec.ts`.

### 6. API routes и server actions

Route handlers оборачиваются в `apiHandler()` из `lib/api-handler.ts`: он логирует 5xx и **маскирует сообщения pg в проде**, но пробрасывает управляющие ошибки Next (`digest` = `NEXT_REDIRECT` / `NEXT_NOT_FOUND`) — иначе `redirect()` из проверок владения превратился бы в 500. Ответы — JSON с полем `data` или `error`.

Server actions лежат в `lib/actions/` (`studio.ts`, `studio-create.ts`, `studio-characters.ts`, `studio-news.ts`, `account-settings.ts`), начинаются с `'use server'`, валидируют вход zod-схемами из `lib/schemas/` и первым делом вызывают гвард из `studio-auth.ts`.

### 7. Ридер и хайлайты

`components/release-book-reader.tsx` (~1000 строк) — центральный клиентский компонент: постраничная вёрстка (`lib/reader/use-column-pagination.ts`), выделение текста и рендер хайлайтов через TreeWalker по DOM (`lib/reader/highlights-dom.ts`), сохранение прогресса (`POST /api/reading-progress` → `lib/server/reading-progress.ts`), закладки, редакторские заметки. Хайлайт можно расшарить (`/release/[slug]/highlight/[id]`) и «дожать» LLM-действиями (объяснить / смысл / переписать / проиллюстрировать).

### 8. AI-персонажи

`POST /api/characters/chat` — `streamText` из AI SDK v6, модель `openai/gpt-4o-mini` через Vercel AI Gateway (`OPENAI_API_KEY`). Системные промпты персонажей **захардкожены** в самом route (`characterPrompts`). Требуется авторизация + рейт-лимит. Вокруг персонажей есть соцслой: посты, стена, дружба, диалоги и память (`character_*` таблицы).

### 9. UI

Дизайн-система описана в `docs/design-system.md` — читать перед версткой. Ключевое: цвета только через CSS-переменные `cf-*` (`bg-cf-bg`, `text-cf-text-1`, `bg-cf-accent`, …), определённые в `app/globals.css`; хардкод hex не использовать; **префикс `dark:` не применяется** — темы переключаются подменой значений переменных на `.dark`.

## Правила

### Не делать
- Не создавать `middleware.ts` (см. `proxy.ts`), не ссылаться на удалённые `lib/admin-auth.ts` и `components/character-graph.tsx`.
- Не добавлять фичи в legacy-систему `/books/`, `/shop/`, `/cart/`.
- Не менять структуру БД без миграции в `postgres/`.
- Не использовать `any`; не оставлять `console.log` в проде.
- Не удалять файлы без разрешения; не коммитить `.env.local`.
- Не обходить `studio-auth`-гварды и рейт-лимиты «для простоты».

### Делать
- Перед написанием Next.js-кода сверяться с `docs/nextjs-rules.md` и локальной документацией в `node_modules/next/dist/docs/`.
- Server Components по умолчанию; `'use client'` — только там, где нужен интерактив.
- Новая серверная логика → `lib/server/`, мутации → server actions с zod.
- Проверять `pnpm build` и `pnpm lint` перед коммитом.

### Перед каждым git commit
1. `pnpm sync:tasks`, если менялись GitHub Issues (`docs/BUGS.md` / `docs/TASKS.md` генерируются автоматически, вручную не править).
2. Запись в `docs/UPDATES.md` в формате: `## [дата] Название` → что изменено / зачем / как использовать. **Без записи в UPDATES.md — не коммитить** (правило продублировано в `.cursor/rules/updates.mdc`).

## Переменные окружения

Полный актуальный список — в `.env.example`. Обязательные: `DATABASE_URL`, `AUTH_SECRET`, `NEXT_PUBLIC_BASE_URL`. Дальше по необходимости: `POSTMARK_SERVER_TOKEN` + `POSTMARK_FROM_EMAIL` (magic link), `OPENAI_API_KEY` (AI), `BLOB_READ_WRITE_TOKEN` (загрузки), `CRON_SECRET` (cron), OAuth-пары `AUTH_{YANDEX,GOOGLE,GITHUB}_CLIENT_ID/SECRET` и `AUTH_CANFLY_*` для SSO. Кнопки провайдеров в UI показываются по `NEXT_PUBLIC_AUTH_*_ENABLED` / `NEXT_PUBLIC_CANFLY_SSO_ENABLED` — включать флаг без ключей бессмысленно.

## Документация

`docs/`: `nextjs-rules.md` (правила Next.js), `design-system.md` (UI), `CANFLY_SSO.md` (интеграция OIDC для поддоменов), `SETUP.md`, `QUICKSTART.md`, `TROUBLESHOOTING.md`, `UPDATES.md` (changelog), `BUGS.md` / `TASKS.md` (авто из Issues), `HIGHLIGHT.md`, `studio.md`.
