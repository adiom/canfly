# Repository Guidelines

**Всегда отвечай пользователю по-русски и лаконично.**

## Правила редактирования исходного кода

- Для изменения существующих файлов используй штатный инструмент `edit` OpenCode.
- Для создания новых файлов используй `write`.
- Не редактируй исходники через Python `str.replace()`, `sed -i`, Perl или shell heredoc.
- Shell используй для чтения, поиска, запуска тестов и Git.
- После каждого изменения проверяй `git diff --check` и соответствующий diff.
- Не скрывай ошибки проверок через `grep`, `head`, `tail` или `|| true`.
- Если штатный инструмент редактирования недоступен, сообщи причину, прежде чем применять альтернативу.

## Обязательное правило для Next.js

Перед любой работой с Next.js прочитай относящуюся к задаче локальную документацию в `node_modules/next/dist/docs/`. Это источник истины для установленного Next.js 16.3.0; не полагайся на знания обучения или устаревшие примеры.

1. Определи тему: App Router, Route Handlers, Server/Client Components, Proxy, кэширование, metadata и т. п.
2. Найди материал в `node_modules/next/dist/docs/01-app/` (`01-getting-started/`, `02-guides/` или `03-api-reference/`).
3. Прочитай его до изменений кода. Для общих тем начни с `node_modules/next/dist/docs/index.md`.

Не импортируй внутренние модули `next/dist/**`: ESLint их запрещает. Используй публичные API из документации.

## Проект и устройство

canfly — литературная платформа: релизы, Studio для авторов, персонажи с AI-чатом и ридер `vvvvv`. Стек: Next.js App Router, React 19, strict TypeScript, Tailwind CSS v4, shadcn/ui, PostgreSQL через `pg` без ORM, next-auth v5 beta, Vercel AI SDK, Vercel Blob и pnpm. Точные версии всегда смотри в `package.json`.

- `app/` — страницы, layouts, Route Handlers и маршруты App Router.
- `components/` — UI; общие примитивы в `components/ui/`, предметные компоненты — в папках по функции.
- `lib/server/` — репозитории и серверная доменная логика; `lib/actions/` — server actions; `lib/schemas/` — Zod-схемы.
- `postgres/` — базовая схема и SQL-миграции; `e2e/` — Playwright; `public/` и `assets/` — статические ресурсы.

Основная модель контента — `releases → editions → chapters` (с версиями глав). Один релиз может иметь издания разных форматов; публичные пути — `/release/[slug]` и `/vvvvv/[slug]` для ридера. Не путай их с маршрутами совместимости: `/books`, `/shop`, `/cart`, `/reader` и `/scroll` всё ещё обрабатываются `proxy.ts`, а `/api/books` и `/api/orders` намеренно возвращают retired-ответы. Не возвращай прежнее поведение без отдельного решения о продукте и безопасности.

## Документация репозитория

Папка `docs/` содержит как текущие, так и исторические материалы. Проверяй их актуальность по коду и дате документа. Для Next.js всегда приоритет у локальной документации из `node_modules/next/dist/docs/`, описанной выше.

## Разработка и проверки

```bash
pnpm dev                                      # локальный Next.js
pnpm lint                                     # ESLint
pnpm build                                    # production build и проверка типов
pnpm test:e2e                                 # все Playwright-тесты
pnpm test:smoke                               # только public smoke-набор
pnpm exec playwright test e2e/studio.spec.ts # один файл
pnpm db:structure                             # структура подключённой БД
```

Создай `.env.local` по `.env.example`; секреты не коммить. Для браузерных наборов на общем конфиге явно передай `CANFLY_E2E_DATABASE_URL` в окружении запуска. Допускается только одноразовая PostgreSQL `canfly_e2e_*` на `127.0.0.1` с указанным портом. Playwright запускает собственный сервер (по умолчанию порт 3100). Перед передачей изменений запускай узкий тест, затем `pnpm lint` и `pnpm build`.

## Код, данные и доступ

Пиши TypeScript без `any`, с двумя пробелами, одинарными кавычками и trailing commas; используй алиас `@/`. Следуй стилю ближайшего файла. Компоненты именуй `PascalCase`, модули — kebab-case. Server Components используй по умолчанию; `'use client'` добавляй только для браузерного состояния, событий или API браузера.

Работай с Postgres только через `lib/db.ts`; запросы и репозитории размещай в `lib/server/`, не в компонентах или page-файлах. Используй параметры SQL, а для связанных мутаций — `withTransaction`. Изменение БД оформляй новой SQL-миграцией в `postgres/`, сохраняя уже применённые миграции. Нумерация и порядок требуют отдельной инвентаризации файлов, известной истории применения и [фактической схемы целевого окружения](docs/architecture/postgresql-schema-drift.md).

`proxy.ts`, а не `middleware.ts`, отвечает за URL-нормализацию, legacy-редиректы и первичную защиту маршрутов. Его matcher — белый список; меняя гвард, проверяй matcher. Proxy не заменяет проверку доступа в мутациях: server actions валидируют вход через Zod и используют `lib/server/studio-auth.ts`. Для действий с релизом, изданием или главой вызывай соответствующую `require*Ownership()` — это защита от IDOR.

Route Handlers оборачивай в `apiHandler()`, если не требуется исключение по существующему паттерну. Не обходи rate limiting, серверную санитаризацию HTML (`lib/sanitize.ts`) или проверку сигнатуры загружаемых файлов. Не ослабляй CSP и другие заголовки из `next.config.mjs` без обоснованной проверки.

## Особые подсистемы

Для новых MCP-тулов используй `zod-v4` только в `lib/mcp/**`, `z.object()` для `inputSchema`, UUID-валидацию и корректные `annotations`; ограничивай объём списков через `limit`/`offset`. `/api/mcp` пускает только администратора: по статическому `MCP_TOKEN` (локально, CI, Inspector) или по OAuth 2.1 access token. OAuth дополнительно требует живой `is_admin = true` и email в `MCP_OAUTH_ALLOWED_EMAILS`. Инструменты обращаются к БД вне `studio-auth`, поэтому не расширяй доступ, не ослабляй проверки в `lib/server/mcp-oauth.ts` и не добавляй delete-тулы без отдельного решения.

В интерфейсе переиспользуй токены `cf-*` из `app/globals.css` и существующие shadcn-компоненты. Новые строки с пользовательским HTML очищай на сервере до записи.

## Инструменты агента

- `.agents/skills/` — отслеживаемые скиллы рабочей копии: `next-dev-loop` (официальный Vercel: правка → проверка в живом `next dev` через `/_next/mcp` и `agent-browser`), `canfly-architecture`, `canfly-data-access`, `canfly-guardrails`, `canfly-refactor`, `canfly-e2e`. Остальные файлы `.agents/` игнорируются. Обновить официальный скилл: `npx skills add vercel/next.js --skill next-dev-loop --copy`.
- `.mcp.json` и `opencode.json` подключают `next-devtools-mcp@0.4.0` к OpenCode и другим MCP-клиентам. Он видит ошибки, роуты, server actions и компиляцию работающего `next dev` через `/_next/mcp`; без запущенного dev-сервера `nextjs_index` ничего не найдёт.
- `agent-browser` (глобально, >= 0.31.1) — настоящий Chrome для проверки UI. На этой Linux-машине Chrome запускается с `--args "--no-sandbox"`. Сессия: `agent-browser session id --scope worktree --prefix canfly-studio`, состояние входа сохраняется через `--restore`.
- Проверка версий и MCP: `pnpm next:check`. Локальный вход в Studio на одноразовой БД: `pnpm studio:browser:login` (принимает только `canfly_e2e_*` на loopback и печатает команды `agent-browser`).
- Рабочий цикл: локальные доки Next → минимальная правка → `get_compilation_issues` → проверка в браузере через `agent-browser`/`next-dev-loop` → `pnpm lint` + `pnpm build` → узкий e2e. Не удаляй `.next` при запущенном `next dev`.
- Для аудита техдолга и рефакторинга с сохранением поведения используй [canfly-refactor](.agents/skills/canfly-refactor/SKILL.md). Для многоэтапного рефакторинга веди [ExecPlan](docs/refactor/EXECPLAN.template.md).

## Тесты, коммиты и PR

Называй E2E-файлы `e2e/<feature>.spec.ts`, группируй проверки через `test.describe` и добавляй регрессионный тест для изменённого маршрута, доступа, редиректа или API. В истории используются короткие Conventional-стиль сообщения: `feat(reader): …`, `fix(auth): …`, `chore: …`, `docs: …`.

В PR укажи пользовательский эффект, миграции и новые переменные окружения, приложи скриншоты UI и перечисли выполненные проверки. При изменении архитектуры или контрактов обнови соответствующую документацию. Не коммить `.env.local` и не удаляй пользовательские файлы без явного разрешения.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
