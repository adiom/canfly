# Release System — план реализации

## Введение

Release-система для canfly — архитектурное решение для управления произведениями и их форматами.
Разделяет концепцию произведения (Release) и его изданий (Editions), позволяя одному произведению
существовать в разных форматах (книга, комикс, аудиокнига, альбом, журнал).

## Ключевые решения

| Решение | Выбор |
|---------|-------|
| Status вместо deleted_at | `draft` / `published` / `archived` для releases и editions |
| Platform | Текстовое поле (не enum) |
| Format | Enum: book, comic, audiobook, album, magazine |
| Comments | Только залогиненные пользователи |
| Studio auth | Существующая user-cookie + проверка роли `author` |
| Аналитика | `view_count` INTEGER в releases и chapters |
| Схема БД | Отдельный файл `postgres/002_release_system.sql` |
| Старые книги | Не трогаем, живут на `/books/[slug]` |
| Главная "Свежие фрагменты" | Не трогаем |

## Структура файлов (все новые)

### База данных
- `postgres/002_release_system.sql` — ENUMы + 12 таблиц

### Логика
- `lib/releases-types.ts` — все типы Release System
- `lib/slug-utils.ts` — транслитерация + генерация slug
- `lib/server/studio-auth.ts` — проверка роли author
- `lib/server/releases.ts` — CRUD релизов + character/series связи
- `lib/server/editions.ts` — CRUD изданий
- `lib/server/chapters.ts` — CRUD глав + версионирование
- `lib/server/series.ts` — CRUD серий
- `lib/server/comments.ts` — комментарии + модерация
- `lib/server/reading-progress.ts` — прогресс чтения
- `lib/server/bookmarks.ts` — закладки

### API Studio
- `app/api/studio/releases/route.ts` + `[id]/route.ts` + `[id]/status/route.ts`
- `app/api/studio/editions/route.ts` + `[id]/route.ts`
- `app/api/studio/chapters/route.ts` + `[id]/route.ts` + `[id]/publish/route.ts` + `[id]/versions/route.ts` + `[id]/restore/route.ts`
- `app/api/studio/series/route.ts` + `[id]/route.ts`
- `app/api/studio/comments/route.ts` + `[id]/moderate/route.ts`
- `app/api/studio/media/route.ts` + `[id]/route.ts`
- `app/api/studio/collaborators/route.ts` + `[id]/route.ts`

### API Public
- `app/api/releases/route.ts` + `[slug]/route.ts`
- `app/api/read/[editionSlug]/[chapterIndex]/route.ts`
- `app/api/reading-progress/route.ts`
- `app/api/bookmarks/route.ts` + `[id]/route.ts`
- `app/api/comments/route.ts`

### Страницы Studio
- `app/studio/layout.tsx` — auth guard + sidebar
- `app/studio/page.tsx` — дашборд
- `app/studio/releases/new/page.tsx` — создание релиза
- `app/studio/releases/[id]/page.tsx` — страница релиза (4 вкладки)
- `app/studio/editions/[id]/page.tsx` — управление изданием
- `app/studio/editions/[id]/chapters/[chapterId]/page.tsx` — Telegraph-редактор
- `app/studio/series/page.tsx` — серии и фазы

### Страницы Public
- `app/releases/[slug]/page.tsx` — публичная страница релиза
- `app/read/[editionSlug]/[chapterIndex]/page.tsx` — читалка

### Компоненты Studio
- `components/studio/studio-shell.tsx`
- `components/studio/release-card.tsx`
- `components/studio/release-form.tsx`
- `components/studio/edition-form.tsx`
- `components/studio/edition-card.tsx`
- `components/studio/chapter-list.tsx`
- `components/studio/telegraph-editor.tsx`
- `components/studio/version-history.tsx`
- `components/studio/media-manager.tsx`
- `components/studio/comment-moderation.tsx`

### Компоненты Public
- `components/release-page.tsx`
- `components/chapter-reader.tsx`
- `components/reading-progress.tsx`
- `components/bookmark-button.tsx`

## Таблицы БД

### releases
id, title, slug (UNIQUE), description, cover_image, genre, release_date, isbn,
authors (JSONB), annotation, editor_notes, view_count, status (release_status),
created_at, updated_at

### editions
id, release_id (FK), format (edition_format), platform (TEXT), external_url,
slug (UNIQUE), status (edition_status), created_at, updated_at

### chapters
id, edition_id (FK), title, content (TEXT), chapter_index,
status (draft/published), word_count, view_count,
created_at, updated_at, published_at

### series
id, title, slug (UNIQUE), description, created_at, updated_at

### release_characters
release_id (FK), character_id (FK), role (main/supporting/cameo),
UNIQUE(release_id, character_id)

### release_series
release_id (FK), series_id (FK), phase_number

### comments
id, release_id (FK), user_id (FK), content,
status (pending/approved/spam), created_at

### release_media
id, release_id (FK), type (media_type), title, url, description, created_at

### reading_progress
id, edition_id (FK), chapter_id (FK), user_id (FK nullable),
session_id, progress_percent, last_read_at

### release_collaborators
release_id (FK), user_id (FK), role (owner/editor/viewer),
UNIQUE(release_id, user_id)

### bookmarks
id, chapter_id (FK), user_id (FK), note, created_at

### chapter_versions
id, chapter_id (FK), content (TEXT), version_number, created_at

## ENUMы

- `release_status`: draft, published, archived
- `edition_status`: draft, published, archived
- `edition_format`: book, comic, audiobook, album, magazine
- `media_type`: trailer, podcast, review, other
- `collaborator_role`: owner, editor, viewer

## Порядок имплементации

1. postgres/002_release_system.sql + lib/releases-types.ts + lib/slug-utils.ts
2. lib/server/studio-auth.ts
3. lib/server/releases.ts, editions.ts, chapters.ts, series.ts
4. lib/server/comments.ts, reading-progress.ts, bookmarks.ts
5. Studio API routes
6. Public API routes
7. Studio layout + dashboard + components
8. Studio releases/[id] + editions/[id] + series pages
9. Telegraph editor
10. Public release page
11. Reader page
