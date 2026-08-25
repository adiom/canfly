# API Reference

## Auth

| Метод | URL | Описание |
|-------|-----|----------|
| GET, POST | `/api/auth/*` | NextAuth v5 catch-all |
| GET | `/api/magic/verify?token=...` | Магическая ссылка (редирект на `/hi/{token}`) |

## User / Session

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/user/session` | Текущий пользователь и роли |
| POST | `/api/user/avatar` | Загрузка аватара (Blob) |
| POST | `/api/feedback` | Обратная связь |
| POST | `/api/reading-progress` | Сохранение прогресса чтения |

## Public

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/search?q=...&limit=6` | Autocomplete-поиск |
| GET | `/api/homepage-slides` | Слайды главной страницы |
| GET | `/vvvvv/{editionSlug}.md` | Книжное издание как Markdown; для остальных форматов возвращается placeholder. Rewrite на `/api/edition-markdown/{editionSlug}` |

## Characters

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/characters` | Список персонажей |
| GET | `/api/characters/{slug}` | Персонаж по slug |
| GET | `/api/characters/posts?character={slug}` | Посты персонажа |
| GET, POST | `/api/characters/{slug}/wall` | Стена (список / создание) |
| DELETE | `/api/characters/{slug}/wall/{id}` | Удаление поста со стены |
| GET, POST, DELETE | `/api/characters/{slug}/friendship` | Дружба (статус / добавить / удалить) |
| GET | `/api/characters/{slug}/conversation` | История диалога |
| POST | `/api/characters/chat` | AI-чат с персонажем (streaming) |

## Highlights

| Метод | URL | Описание |
|-------|-----|----------|
| GET, POST | `/api/chapter-highlights` | Список / создание выделений |
| GET, PATCH, DELETE | `/api/chapter-highlights/{id}` | Выделение (CRUD) |
| POST, PUT | `/api/chapter-highlights/{id}/like` | Toggle / установка лайка |
| POST | `/api/highlights/meaning` | AI: глубинный смысл (streaming) |
| POST | `/api/highlights/explain` | AI: объяснение отрывка (streaming) |
| POST | `/api/highlights/rewrite` | AI: переписать отрывок (streaming) |
| POST | `/api/highlights/illustrate` | AI: генерация иллюстрации |

## Editorial Notes

| Метод | URL | Описание |
|-------|-----|----------|
| GET, POST | `/api/chapter-editorial-notes` | Список / создание заметок |
| DELETE | `/api/chapter-editorial-notes/{id}` | Удаление заметки |
| PATCH | `/api/chapter-editorial-notes/{id}/status` | Обновление статуса |

## Studio

| Метод | URL | Описание |
|-------|-----|----------|
| POST | `/api/studio/upload` | Загрузка изображений (Blob) |
| POST | `/api/studio/upload/audio/token` | Токен для загрузки аудио (до 500 МБ) |

## Admin

| Метод | URL | Описание |
|-------|-----|----------|
| GET, POST | `/api/admin/users` | Список / создание пользователей |
| PATCH, DELETE | `/api/admin/users/{id}` | Обновление / soft-delete пользователя |
| GET, POST | `/api/admin/news` | Список / создание новостей |
| GET, PATCH, DELETE | `/api/admin/news/{id}` | CRUD новости |
| GET, POST | `/api/admin/characters` | Список / создание персонажей |
| GET, PATCH, DELETE | `/api/admin/characters/{id}` | CRUD персонажа |
| GET, POST | `/api/admin/homepage-slides` | Список / создание слайдов |
| GET, PATCH, DELETE | `/api/admin/homepage-slides/{id}` | CRUD слайда |
| POST | `/api/admin/upload` | Загрузка изображений (admin, Blob) |

## MCP

| Метод | URL | Описание |
|-------|-----|----------|
| GET, POST, DELETE | `/api/mcp` | MCP-сервер (защищён MCP_TOKEN). Тулы: characters, chapters, releases, search |

## Cron

| Метод | URL | Описание |
|-------|-----|----------|
| GET | `/api/cron/cleanup` | Очистка magic-токенов (защищён CRON_SECRET) |

## Retired

| Метод | URL | Описание |
|-------|-----|----------|
| GET, POST | `/api/books` | Retired → `/api/releases` |
| POST | `/api/orders` | Retired (410) |
| GET, POST | `/api/chapters/rate` | Retired |

## Server Actions (lib/actions/)

Вызываются через `use server`, URL-путей не имеют.

- `lib/actions/studio.ts` — CRUD релизов, изданий, глав, серий, версий, аудио
- `lib/actions/studio-news.ts` — CRUD новостей
- `lib/actions/studio-create.ts` — быстрое создание черновиков
- `lib/actions/studio-characters.ts` — CRUD персонажей, постов, стен, отношений
- `lib/actions/account-settings.ts` — управление email и OAuth
- `lib/actions/user-profile.ts` — профиль, хэндл, аватар
