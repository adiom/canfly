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
- Браузерную проверку делай через доступные инструменты/Playwright при поднятом безопасном dev; не объявляй её выполненной без фактического DOM/скриншотов.

## Правила

- Имена `e2e/<feature>.spec.ts`; тесты по видимому результату и доступным ролям, не по нестабильным CSS-классам.
- Для тестов с БД используй независимые фикстуры, собственные ID и cleanup; сначала проверь, что БД действительно тестовая.
- Прерывание процесса/отсутствие браузерного инструмента — ограничение окружения, а не успешная проверка.
- Команды pnpm могут не работать из-за локального shim. `npx --no-install` использует уже установленные зависимости, не устанавливая новые.

Докладывай фактический exit code и число тестов, перечисляй непроверенные сценарии. Не запускай реальную модель для UI-скриншотов без бюджета и разрешения.
