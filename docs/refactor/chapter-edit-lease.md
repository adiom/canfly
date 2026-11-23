# ExecPlan — эксклюзивное редактирование глав (PR2)

Исходная точка: ветка `refactor/phase-2`, HEAD `33c1d48` (`fix(mcp): require chapter revisions in v2 writes`). Рабочее дерево было чистым.

## Цель и границы

Одна активная сессия редактирует главу; остальные вкладки и пользователи получают режим чтения. Право записи подтверждается PostgreSQL lease в той же транзакции, что ревизия, архив и UPDATE. Состояние не хранится в памяти процесса и работает на Vercel Serverless. Миграции, DDL и тестовые записи выполнялись только на одноразовой локальной PostgreSQL 17 (`127.0.0.1:55432/canfly_e2e_local`). Production не изменялся.

## Аудит путей записи

| Путь | Что меняет | Защита |
| --- | --- | --- |
| `lib/actions/studio.ts` → `updateChapterAction`, `updateComicChapterPagesAction`, `finalizeAudioChapterUploadAction`, `removeAudioChapterFileAction`, `restoreChapterVersionAction`, `publishChapterAction`, `deleteChapterAction` | текст, аудио, статус, удаление | обязательный lease-proof + `expectedRevision` |
| `reorderChaptersAction` | `chapter_index` всех глав | ревизии каждой главы + запрет при живом lease |
| `createChapterAction` / `createChapter` | вставка | lease не нужен; advisory-lock состава издания |
| `deleteEditionAction` / `deleteReleaseAction` | каскадное удаление глав | запрет при живом lease на любой главе |
| `lib/mcp/tools/chapters.ts`: `canfly_update_chapter`, `_v2`, `restore_chapter_version`, `_v2`, `publish_chapter`, `reorder_chapters` | те же данные | неявный one-shot lease + обязательная ревизия |
| `canfly_create_chapter` | вставка | без lease, как и Studio |
| `scripts/import-docx.mjs`, `scripts/split-edition.mjs` | вставка/перенос | вне HTTP; служебный out-of-band путь |
| прямой SQL/psql | любые поля | не блокируется по решению PR2 |
| `incrementChapterViews` | `view_count` | не текст, не входит в триггер ревизии |

## Модель lease

Миграция [`0002_chapter_edit_leases.sql`](../../postgres/versioned/0002_chapter_edit_leases.sql): одна строка на главу (`chapter_id` — PK), `user_id` (null только для статического `MCP_TOKEN`), `actor_kind` (`studio`/`mcp`), `session_id` вкладки, случайный `lease_token` (32 байта hex), `generation`, `acquired_at`, `expires_at`, `released_at`, `updated_at`.

- Время берётся только из `now()` PostgreSQL; TTL 60 с, heartbeat 20 с, повторный захват 10 с.
- Захват — `INSERT … ON CONFLICT (chapter_id) DO UPDATE … WHERE expires_at <= now() OR (user_id, session_id) совпали`; `generation` растёт на каждом захвате. Активный чужой lease не вытесняется.
- Продление разрешено только при живом lease и совпадении `token + generation + session_id + user_id + actor_kind`; после истечения нужен новый захват.
- Освобождение выставляет `expires_at = now()`, сохраняя строку для монотонной generation. Cron может удалять строки старше срока хранения.
- Запись проверяет в одной транзакции право пользователя на релиз (`users.is_admin` или `release_collaborators.role='owner'`), lease, затем строку главы и `expectedRevision`.
- Порядок блокировок: advisory-lock состава издания (create/reorder/удаление) → advisory-lock scope lease для каждой главы в отсортированном порядке → lease `FOR UPDATE` → chapter `FOR UPDATE` → архив → UPDATE.
- Захват lease и структурные операции (reorder, `deleteEdition`, `deleteRelease`) берут один и тот же advisory-lock на главу. Это закрывает гонку с уже существующей истёкшей строкой lease: без блокировки `ON CONFLICT DO UPDATE` обновляет только lease-строку и не берёт FK-блокировку главы, поэтому мог проскочить между проверкой и изменением порядка/удалением. Структурные операции блокируют scope глав отсортированно, проверяют живые lease, затем блокируют строки глав; писатели идут lease → chapter, поэтому deadlock не возникает. Reorder и каскадное удаление блокируют главы в порядке `chapters.id`.
- MCP: неявный lease захватывается и освобождается внутри той же транзакции записи. Если глава занята Studio-сессией, возвращается `lease_held`; если lease свободен, запись проверяет `expected_revision`, меняет главу и освобождает lease атомарно.

## MCP-контракты

Имена инструментов сохранены. Небезопасные вызовы отклоняются:

- `canfly_update_chapter`, `canfly_restore_chapter_version` без `expected_revision` → `isError`, `structuredContent.code = "revision_required"`.
- `canfly_publish_chapter` принимает `expected_revision`; без неё — `revision_required`.
- `canfly_reorder_chapters` принимает `chapter_ids` + `expected_revisions` в том же порядке; без ревизий — `revision_required`.
- Занятая глава → `lease_held`; устаревшая ревизия → `conflict`; устаревший lease → `lease_lost`.
- Новый read-only инструмент `canfly_get_chapter_lease` показывает владельца.
- `canfly_create_chapter` и все read-тулы работают без изменений.
- OAuth-токен даёт `user_id`; статический `MCP_TOKEN` пишет как `actor_kind='mcp'` без пользователя. Это не ослабляет проверку: lease обязателен в любом случае.

## Интерфейс

- `useChapterLease` держит идентификатор вкладки в `sessionStorage`. `BroadcastChannel` открыт всё время жизни документа: вкладка отвечает `ack` на `probe` своего id, поэтому даже поздний duplicate tab (браузер копирует `sessionStorage`) получает новый id и не перехватывает lease первой вкладки.
- Пока lease не наш, редактор, HTML-режим, аудио, комикс, публикация, удаление и откат версии недоступны; показывается баннер «Глава уже редактируется» с именем владельца и кнопкой повторного захвата.
- При потере lease текущий черновик уходит в существующий архив, sessionStorage-запись не удаляется, редактор становится read-only. После повторного захвата страница перечитывает снимок; при изменившейся ревизии старый черновик остаётся в архиве.
- Закрытие вкладки освобождает lease через `sendBeacon` на `POST /api/chapter-leases/release`; при недоступности сети lease истекает по TTL.

## Устойчивость черновиков

- Без lease-proof автозапись не вызывает сервер и возвращает ошибку: очередь остаётся грязной, черновик архивируется, статус «Сохранено» не показывается.
- Ошибка сети или авторизации при heartbeat обрабатывается как `degraded`; ложное успешное продление невозможно.
- После возврата lease при неизменной ревизии грязная очередь повторяет сохранение. При изменившейся ревизии серверный снимок перечитывается, локальный текст остаётся в «Локальные черновики», а в шапке появляется явное уведомление.
- Аудио и комикс после смены ревизии монтируются из свежего снимка; старые `title`, `pages` и метаданные не отправляются с новой ревизией. Локальные значения перед сбросом архивируются.
- В read-only комикс нельзя удалять и перетаскивать страницы; локальный массив не меняется и не может стать серверной записью.

## Проверки

- Unit: 226 тестов, включая схемы/поведение без БД, сохранность очереди без lease, heartbeat и повторный захват.
- DB (`playwright.db.config.ts` на одноразовой PostgreSQL 17): 34 теста — захват/продление/освобождение, гонка двух соединений, старые token/generation, запись без lease, admin без lease, restore/publish/delete, reorder, каскадное удаление, MCP `revision_required`/`lease_held`, Studio ↔ MCP, гонки acquire с истёкшей строкой во время reorder/deleteEdition/deleteRelease и отсутствие deadlock.
- Browser (Chromium): `e2e/chapter-save.spec.ts` (7) и `e2e/chapter-lease.spec.ts` (8) — две вкладки, два автора, владелец и администратор, истечение TTL, потеря lease, повторный захват, поздний duplicate tab, MCP-блокировка, повтор сохранения после возврата lease, новая ревизия с архивом, read-only комикса и свежие аудио/комикс-снимки.
- `tsc --noEmit`, `eslint .`, `pnpm build` — см. результаты в отчёте PR.

## Остаточные обходы и риски

1. `scripts/import-docx.mjs` и `scripts/split-edition.mjs` пишут напрямую; запускать только в maintenance-режиме.
2. Прямой SQL/psql не блокируется: DB-триггер отложен отдельным решением.
3. `incrementChapterViews` меняет только `view_count`.
4. `canfly_create_chapter` не требует lease: вставка не перезаписывает чужой текст. Состав издания сериализуется advisory-lock с reorder.
5. Гонка между проверкой lease и каскадным удалением закрыта блокировкой строк глав: acquire ждёт FK-проверку.
6. При статическом `MCP_TOKEN` владелец lease в баннере отображается как «MCP-клиент».

## Откат

Откат приложения — возврат diff PR2; таблица `chapter_edit_leases` совместима с предыдущей версией и не требует удаления. Схема должна применяться раньше кода. Удаление таблицы — отдельной миграцией после проверки потребителей.
