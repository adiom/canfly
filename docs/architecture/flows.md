# Потоки данных и карта модулей

Проверено по [коммиту](README.md). Таблица показывает главные зависимости; для конкретной функции переходите в исходник. SQL-запросы находятся преимущественно в `lib/server/*`; [`lib/db.ts`](../../lib/db.ts) — общий доступ через `pg`.

| Страница / функция | UI | API / Action | SQL-модуль | PostgreSQL |
| --- | --- | --- | --- | --- |
| `/releases`, `/release/[slug]` | страницы `app/` | чтение Server Component | `releases.ts`, `editions.ts` | `releases`, `editions`, связи |
| `/vvvvv/[slug]` | `SpreadReader`, comic/audio/artwork | `POST /api/reading-progress` для книги/журнала | `reading-progress.ts`, `chapters.ts` | `reading_progress`, `chapters` |
| `/user`, `/user/[slug]` | `ReadingShelf` | чтение Server Component | `user-profile.ts`, `users.ts` | `users`, `reading_progress`, `chapter_highlights` |
| `/studio/*` | редакторы `components/studio/` | `lib/actions/studio*.ts` | `releases.ts`, `editions.ts`, `chapters.ts` и предметные модули | контент и связи |
| `/characters/*` | `CharacterChat`, профиль | `/api/characters/*` | `characters.ts`, `users.ts`, `character-wall.ts` | `characters`, `character_messages`, дружба, посты |
| `/games/*` | `GameEmbed` | чтение Server Component | `games.ts` | `games`, `release_games`, `character_games` |
| `/api/mcp` | MCP client | `app/api/mcp/route.ts`, OAuth handlers | `lib/mcp/tools/*`, `mcp-oauth.ts` | контент и `mcp_oauth_*` |

```mermaid
flowchart TD
  Release[(releases)] --> Edition[(editions)]
  Edition --> Chapter[(chapters)]
  Chapter --> Versions[(chapter_versions)]
  Chapter --> Highlights[(chapter_highlights)]
  Chapter --> Progress[(reading_progress)]
  User[(users)] --> Progress
  User --> Friendship[(character_friendships)]
  Character[(characters)] --> Friendship
  Character --> Conversation[(character_conversations)]
  Conversation --> Messages[(character_messages)]
  Release --> ReleaseGames[(release_games)]
  ReleaseGames --> Game[(games)]
```

Диаграмма показывает предметные связи, а не полный набор FK. Фактические ограничения проверяйте по целевой схеме БД. `proxy.ts` также обрабатывает старые `/books`, `/shop`, `/cart`, `/reader`, `/scroll`; обработчики `/api/books` и `/api/orders` возвращают ответы о выводе из эксплуатации.
