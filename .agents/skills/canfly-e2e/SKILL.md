---
name: canfly-e2e
description: Проверки Canfly: безопасные unit-тесты Playwright без БД, браузерный smoke и DB-mutating e2e. Используй перед запуском тестов, проверкой UI и при регрессиях API.
---

# Canfly — тестирование без порчи рабочей БД

Сначала прочитай `AGENTS.md` и два конфига: `playwright.unit.config.ts` и `playwright.config.ts`.

## Два разных режима

**Unit:** `tests/unit/`, `playwright.unit.config.ts`. Без `globalSetup`, `webServer`, реального AI и БД. Безопасный первый выбор.

```powershell
npx --no-install playwright test -c playwright.unit.config.ts
npx --no-install playwright test -c playwright.unit.config.ts tests/unit/character-chat-ui.spec.ts
npx --no-install tsc --noEmit --incremental false
npx --no-install eslint .
```

**E2E:** `e2e/`, `playwright.config.ts`. В конфиге есть `globalSetup`/`globalTeardown`, `webServer`. `e2e/setup/global-setup.ts` создаёт тестового администратора/учётные данные при доступной БД. **Не запускай `pnpm test:e2e`, `pnpm test:smoke` или узкий e2e по одному лишь названию**, пока не подтверждена изолированная БД и эффекты setup/teardown. Даже smoke запускается с общим конфигом.

## Регрессии сохранения глав

- В `test:db` проверяй ревизию и историю после успешной, устаревшей и конкурентной записи. Preflight проверяет локальную PostgreSQL 17, колонку ревизии и включённый триггер. Для DB и E2E явно задавай `CANFLY_E2E_DATABASE_URL` на одноразовую `canfly_e2e_*` на `127.0.0.1` с явным портом.
- В браузере проверяй две вкладки, гонку Studio и MCP, сохранение конфликтующего черновика после перезагрузки и восстановление только по выбору автора.

## Регрессии AI-чата

- Проверяй `requestId`, `attemptId`, completed только после подтверждённой записи; неизвестный `pending` не должен запускать новый платный вызов.
- Отдельно моделируй Stop, пустой/оборванный UTF-8 поток, network loss, late GET, reload, double-submit, stale callback, авторизацию, чужую сессию.
- Проверка на mocks не доказывает корректность реальных транзакций `pg`, Abort у провайдера или поведение под Vercel. В отчёте разделяй unit, DB-integration и browser acceptance.
- Браузерную проверку делай через `next-dev-loop`/`agent-browser` или Playwright при поднятом безопасном dev; не объявляй её выполненной без фактического DOM/скриншотов.

## next-dev-loop и agent-browser

Официальный workflow Vercel: после правки проверяй не только типы и сборку, но и живой runtime через `/_next/mcp` (взгляд Next.js) и настоящий Chrome через `agent-browser` (взгляд браузера).

Требования: Next.js 16.3+ с Turbopack и `agent-browser >= 0.31.1`. Проверка версий и MCP:

```bash
pnpm next:check
```

1. Подними dev только на одноразовой базе (production URL не подставляй):

```bash
set -a; . ./.env.local; set +a
DATABASE_URL="$CANFLY_E2E_DATABASE_URL" \
NEXT_PUBLIC_BASE_URL=http://127.0.0.1:3101 \
AUTH_URL=http://127.0.0.1:3101 \
NEXTAUTH_URL=http://127.0.0.1:3101 \
pnpm dev --hostname 127.0.0.1 --port 3101
```

2. Вход в Studio. Скрипт принимает только `canfly_e2e_*` на loopback:

```bash
pnpm studio:browser:login   # печатает STUDIO_LOGIN_URL и команды agent-browser
```

3. Открой Studio в стабильной сессии и работай по `next-dev-loop`:

```bash
SESSION="$(agent-browser session id --scope worktree --prefix canfly-studio)"
export AGENT_BROWSER_SESSION="$SESSION"
export AGENT_BROWSER_RESTORE="$SESSION"
agent-browser --session "$SESSION" --restore --args "--no-sandbox" --enable react-devtools open "$STUDIO_LOGIN_URL"
agent-browser --session "$SESSION" snapshot -i
agent-browser --session "$SESSION" react tree --json   # component tree, render counts
```

На этой Linux-машине Chrome требует `--args "--no-sandbox"`; без него `agent-browser doctor` падает на sandbox. `--restore` сохраняет cookie/localStorage, поэтому повторный вход не нужен.

4. После правки проверь `get_compilation_issues` через `/_next/mcp`, затем `agent-browser read/snapshot/console/errors` и `react tree`. Закрывай сессию `agent-browser --session "$SESSION" --restore close`.

Не удаляй `.next` при запущенном `next dev` и не используй `DATABASE_URL` рабочей базы для этих проверок.

## Правила

- Имена `e2e/<feature>.spec.ts`; тесты по видимому результату и доступным ролям, не по нестабильным CSS-классам.
- Для тестов с БД используй независимые фикстуры, собственные ID и cleanup; сначала проверь, что БД действительно тестовая.
- Прерывание процесса/отсутствие браузерного инструмента — ограничение окружения, а не успешная проверка.
- Команды pnpm могут не работать из-за локального shim. `npx --no-install` использует уже установленные зависимости, не устанавливая новые.

Докладывай фактический exit code и число тестов, перечисляй непроверенные сценарии. Не запускай реальную модель для UI-скриншотов без бюджета и разрешения.
