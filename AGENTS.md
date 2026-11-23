# AGENTS.md

Отвечай по-русски и лаконично.

## Проект

Canfly — литературная платформа со Studio, AI-чатом и ридером. Контент: `releases → editions → chapters` с версиями глав. Стек и команды — в [package.json](package.json).

## Команды и готовность

- `pnpm dev` — локальная разработка. Для настройки используй `.env.example`, секреты держи в `.env.local`.
- После правок кода: узкий тест → `pnpm lint` → `pnpm build`. `pnpm test:unit` работает без БД и браузера.
- `pnpm test:db`, `pnpm test:e2e` и `pnpm test:smoke` требуют явного `CANFLY_E2E_DATABASE_URL` на одноразовую PostgreSQL 17 `canfly_e2e_*` на `127.0.0.1` с портом. Сначала примени [baseline и миграции](postgres/baseline/README.md).
- Для правок маршрутов, доступа, редиректов и API добавь регрессионный тест. E2E — `e2e/<feature>.spec.ts` с `test.describe`.
- Conventional Commits. В PR укажи эффект, проверки, миграции, новые переменные и скриншоты UI. При смене архитектуры или контракта обнови доки.

## Карта проекта

- `app/` — маршруты, `components/` — UI, `lib/actions/` — actions, `lib/schemas/` — Zod, `lib/server/` — репозитории, `postgres/` — SQL.
- `/release/[slug]` и `/vvvvv/[slug]` — публичные пути. Сохраняй редиректы `proxy.ts` и retired-ответы `/api/books`, `/api/orders`.
- Подсистемы — в [canfly-architecture](.agents/skills/canfly-architecture/SKILL.md). Старые доки сверяй с кодом.

## Соглашения

- Правки: `apply_patch` в Codex, `edit`/`write` в OpenCode. Поясни причину перед заменой инструмента. Shell — для чтения, поиска, проверок и Git. После каждой правки смотри `git diff --check` и diff. Показывай ошибки проверок полностью.
- TypeScript без `any`, два пробела, одинарные кавычки, trailing commas, алиас `@/`. Компоненты в PascalCase, модули в kebab-case.
- Доки App Router — в `node_modules/next/dist/docs/01-app/`. Импорты `next/dist/**` запрещены. Server Components по умолчанию. Для UI используй shadcn/ui и `cf-*` из `app/globals.css`.

## Защитные правила

- Для доступа, маршрутов и API используй [canfly-guardrails](.agents/skills/canfly-guardrails/SKILL.md). Сверяй matcher `proxy.ts`. В actions проверяй вход через Zod и права через `studio-auth.ts`, включая `require*Ownership()`.
- Для Route Handlers используй `apiHandler()` с текущими исключениями. Сохраняй rate limiting, `lib/sanitize.ts`, проверку сигнатуры файлов и CSP.
- При работе с SQL используй [canfly-data-access](.agents/skills/canfly-data-access/SKILL.md). Параметризованные запросы размещай в `lib/server/` и выполняй через `lib/db.ts`, связанные мутации — через `withTransaction`. Применённые миграции сохраняй. Добавляй новые после сверки истории и фактической схемы.
- `/api/mcp` доступен только администраторам. Сохраняй проверки OAuth в `lib/server/mcp-oauth.ts` и сверяй [контракт MCP](docs/MCP.md). Для новых тулов используй `zod-v4` только в `lib/mcp/**`, `z.object()` для `inputSchema`, UUID-валидацию, `annotations` и `limit`/`offset` для списков. Delete-тулы требуют отдельного решения.
- Не раскрывай и не коммить секреты. Удаление пользовательских файлов требует явного разрешения.

## Проверки по задаче

- Тесты — [canfly-e2e](.agents/skills/canfly-e2e/SKILL.md). Проверка Next.js в браузере и `/_next/mcp` — [next-dev-loop](.agents/skills/next-dev-loop/SKILL.md). При работающем dev-сервере сохраняй `.next`.
- Аудит и рефакторинг — [canfly-refactor](.agents/skills/canfly-refactor/SKILL.md). Многоэтапный рефакторинг — [ExecPlan](docs/refactor/EXECPLAN.template.md).

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
