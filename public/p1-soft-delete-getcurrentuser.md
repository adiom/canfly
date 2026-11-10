# P1: soft-deleted аккаунты больше не проходят `getCurrentUser()`

Дата: 2026-11-10
Репозиторий: `C:\canfly\2026\canfly`
Статус: выполнено, изменение минимальное

## Дефект (подтверждён кодом)

`lib/server/session.ts`, `getCurrentUser()` выбирал пользователя только по `id`:

```sql
SELECT ... FROM users WHERE id = $1 LIMIT 1
```

Условия `is_deleted` не было. Поле существует с миграции `postgres/009_user_soft_delete.sql`
(`is_deleted BOOLEAN NOT NULL DEFAULT FALSE`, `deleted_at TIMESTAMPTZ`) и отражено в `postgres/schema.sql`.
Другие места репозитория уже используют фильтр `COALESCE(is_deleted, FALSE) = FALSE`
(`lib/server/users.ts`, `lib/server/user-profile.ts`, `lib/server/mcp-oauth.ts`) — то есть `getCurrentUser()`
был единственным несогласованным чтением пользователя по `id`.

Практический эффект: при ещё валидном JWT/cookie удалённого аккаунта функция возвращала объект
пользователя, и все её потребители (server actions, API-маршруты, страницы Studio и настроек,
`studio-auth.ts`) продолжали считать аккаунт авторизованным.

## Что поменялось

Единственная правка — SQL-условие в `getCurrentUser()` (`lib/server/session.ts`):

```diff
-    'SELECT id, email, login, handle, display_name, avatar, bio, tagline, signature_color,
-      profile_is_public, show_reading, public_role, is_admin, showcase_releases, created_at
-      FROM users WHERE id = $1 LIMIT 1',
+    'SELECT id, email, login, handle, display_name, avatar, bio, tagline, signature_color,
+      profile_is_public, show_reading, public_role, is_admin, showcase_releases, created_at
+      FROM users WHERE id = $1 AND COALESCE(is_deleted, FALSE) = FALSE LIMIT 1',
```

Что сохранено без изменений:

- интерфейс `SessionUser`, список выбираемых полей, маппинг и значения по умолчанию;
- поведение активных пользователей (`is_deleted = FALSE` и `NULL` при COALESCE) — прежнее;
- сигнатура функции и все вызовы `getCurrentUser()`.

Что не менялось: миграции, схема БД, `auth.config.ts`, callbacks, чат персонажей, дружба, публичные API,
UI, документация, зависимости.

## Проверки

| Проверка | Результат |
| --- | --- |
| `git status --short --branch` до правки | `## main...origin/main`, `D .mcp.json` (staged, чужое намеренное изменение — не тронуто) |
| `pnpm exec eslint lib/server/session.ts` | exit 0, замечаний нет |
| `git diff --check` | exit 0, проблем с пробелами нет |
| `git diff -- lib/server/session.ts` | ровно одна строка: добавлено `AND COALESCE(is_deleted, FALSE) = FALSE` |
| `git status` после правки | `D .mcp.json` (staged, без изменений) + ` M lib/server/session.ts` |

## Unit-тест

Не добавлен: в репозитории нет инфраструктуры изолированных unit-тестов без БД (в `package.json`
только `@playwright/test` и скрипты `test:e2e` / `test:smoke`, а e2e-запуск этой задачей запрещён).
Новую библиотеку ради одного теста не подключал.

## Что осталось непроверенным

- Реальная БД не использовалась: нет проверки «строка с `is_deleted = TRUE` → `null`» на живых данных.
- Runtime-поведение с валидным JWT удалённого аккаунта не воспроизводилось (ни e2e, ни `next dev`).
- Поведение `getCurrentUser()` подтверждено статически: чтением схемы (`postgres/009_user_soft_delete.sql`,
  `postgres/schema.sql`) и согласованностью с существующими фильтрами в `lib/server/*`.
- `pnpm build`, `pnpm lint` по всему проекту и e2e не запускались по условиям задачи.
