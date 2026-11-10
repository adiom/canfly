# Релизы, издания, главы

Проверено по [коммиту](README.md). **Факт:** модель `releases → editions → chapters`; версия текста главы хранится отдельно в `chapter_versions`. Публичный каталог — [`/releases`](../../app/releases/page.tsx), карточка — [`/release/[slug]`](../../app/release/[slug]/page.tsx), ридер — [`/vvvvv/[slug]`](../../app/vvvvv/[slug]/page.tsx). Схема таблиц подтверждена в тестовой Neon; их содержимое не переносилось.

| Операция | Модуль | SQL-таблицы |
| --- | --- | --- |
| Список/карточка релизов | [`lib/server/releases.ts`](../../lib/server/releases.ts) | `releases`, `release_series`, `release_characters`, `release_collaborators` |
| Формат и публикация издания | [`lib/server/editions.ts`](../../lib/server/editions.ts) | `editions`, `releases`, `chapters` |
| Главы, порядок, версии | [`lib/server/chapters.ts`](../../lib/server/chapters.ts) | `chapters`, `chapter_versions` |
| Публичные цитаты и заметки | [`lib/server/chapter-highlights.ts`](../../lib/server/chapter-highlights.ts) | `chapter_highlights`, `chapter_editorial_notes`, связанные таблицы |

**Факт:** страница ридера выбирает UI по формату: `SpreadReader` для книги и журнала, `ReleaseComicReader` для комикса, `ReleaseAudioPlayer` для аудио, `ArtworkViewer` для картины. Она проверяет опубликованность релиза и издания. Запросы и UI для Studio описаны в [studio.md](studio.md). Учёт просмотров и прогресс — в [analytics.md](analytics.md).

**Исторический контекст:** [`postgres/schema.sql`](../../postgres/schema.sql) и файлы `postgres/*.sql` отражают эволюцию схемы, но не доказывают, как была создана production-БД. Перед новой миграцией сверяйте фактическую схему и данные.
