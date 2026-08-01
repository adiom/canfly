# HIGHLIGHT.md — выделения, цитаты и редакторские правки

Актуально на 01.08.2026. Документ описывает **фактическое** состояние кода, включая незакрытые ограничения (раздел «Что не доделано»).

> Предыдущая версия этого файла описывала legacy-систему (единая таблица `highlights` с полями `book_id` / `type` / `visibility`, роуты `/api/highlights`, `components/book-reader.tsx`). Той системы больше нет: таблица дропнута в `postgres/highlights-migration.sql:54`. Всё ниже — про Release-систему.

---

## 1. Модель данных

Миграции: `postgres/highlights-migration.sql` и `postgres/014_highlights_stability.sql`. Три таблицы, привязка к `chapters(id)`, а не к книге.

### `chapter_highlights` — цитаты читателей

| поле | тип | смысл |
|---|---|---|
| `id` | UUID PK | |
| `chapter_id` | UUID → `chapters` ON DELETE CASCADE | |
| `user_id` | UUID → `users` ON DELETE CASCADE | владелец |
| `text_content` | TEXT NOT NULL | выделенный фрагмент |
| `paragraph_index` | INTEGER | индекс параграфа в DOM-порядке (для быстрой пере-разметки) |
| `context_before` / `context_after` | TEXT | ±30 символов вокруг — fallback-якорь, если текст не нашёлся по индексу |
| `client_request_id` | UUID | ключ идемпотентности создания |
| `start_offset` / `end_offset` | INTEGER | точные смещения внутри смыслового блока |
| `source_chapter_updated_at` | TIMESTAMPTZ | версия содержимого на момент создания |
| `note` | TEXT | личная заметка, необязательна |
| `is_public` | BOOLEAN DEFAULT false | **единственный признак видимости** |
| `likes_count` | INTEGER DEFAULT 0 | денормализованный счётчик |
| `created_at` | TIMESTAMPTZ | |

Индексы: `(chapter_id)`, `(user_id)`, `(chapter_id, is_public)`.

### `chapter_highlight_likes`
`(highlight_id, user_id)` — составной PK, оба FK с CASCADE.

### `chapter_editorial_notes` — правки, только Studio

Те же поля позиционирования, плюс:
- `author_id` → `users` (без CASCADE);
- `note` TEXT **NOT NULL** — сама правка;
- `status` TEXT CHECK ∈ `open` | `resolved` | `ignored`, дефолт `open`;
- `resolved_at` TIMESTAMPTZ.

Индекс `(chapter_id, status)`.

### Чего в модели нет

Нет полей `type` и `visibility` — цитата и правка разведены по таблицам, публичность булева. Сущности `author_note` не существует. Тип `HighlightType = 'quote' | 'editorial_comment' | 'author_note'` в `lib/types.ts:247` — мёртвый осколок legacy, к БД отношения не имеет.

Той же миграцией дропнуты `chapter_ratings` и `book_reviews` — рейтинги глав и отзывы как направление отменены.

### TypeScript-типы

`lib/releases-types.ts:207` — `ChapterHighlight` (поля таблицы + join-поля `user_name`, `user_avatar`, `is_liked_by_me`, `release_slug`, `chapter_title`), `:227` — `ChapterHighlightInput`, `:239` — `EditorialNoteStatus`, `:241` — `ChapterEditorialNote`.

---

## 2. Слой данных

Весь SQL — в `lib/server/chapter-highlights.ts` (305 строк). В компонентах и page.tsx запросов нет.

**Цитаты:**
- `fetchChapterHighlights({ chapterId?, userId?, publicOnly?, currentUserId?, limit? })` — фильтр видимости **безусловный**: аноним и `publicOnly` видят только `is_public = true`, авторизованный — публичные + свои. Догружает `is_liked_by_me` вторым запросом по `ANY($2::uuid[])`.
- `fetchPublicHighlightsByRelease(releaseId, limit = 6)` — топ по `likes_count`, для витрины релиза.
- `fetchChapterHighlightById(id, currentUserId)` — приватная возвращается только владельцу.
- `fetchUserHighlights(userId, limit = 100)` — подмешивает `release_slug` и `chapter_title` одним запросом по всем `chapter_id`. Сейчас вызывает общий fetch без `currentUserId`, поэтому фактически возвращает только публичные цитаты (см. «Что не доделано»).
- `createChapterHighlight`, `updateChapterHighlight(id, userId, isAdmin, { note?, is_public? })`, `deleteChapterHighlight(id, userId, isAdmin)` — обе мутации сначала читают `user_id` и сверяют владение (или admin).
- `toggleHighlightLike(highlightId, userId)` — лайкнуть можно только публичную либо свою.

**Правки:** `fetchChapterEditorialNotes(chapterId)`, `createEditorialNote`, `updateEditorialNoteStatus` (проставляет `resolved_at` при `resolved`/`ignored`), `deleteEditorialNote`. Удаление доступно через `DELETE /api/chapter-editorial-notes/[id]` с проверкой автора замечания или admin.

---

## 3. HTTP API

### Цитаты — `/api/chapter-highlights`
| метод | путь | доступ |
|---|---|---|
| GET | `?chapterId=` или `?userId=` (+`publicOnly`, `limit`) | публично, фильтрация по сессии |
| POST | — | авторизация; `text_content` ≤ 5000 |
| GET | `/[id]` | публично, приватная — только владельцу |
| PATCH | `/[id]` — `note`, `is_public` | владелец или admin |
| DELETE | `/[id]` | владелец или admin |
| POST | `/[id]/like` | авторизация, совместимый toggle |
| PUT | `/[id]/like` — `{ liked: boolean }` | авторизация, идемпотентная установка состояния |

### Правки — `/api/chapter-editorial-notes`
| метод | путь | доступ |
|---|---|---|
| GET | `?chapterId=` | роль `admin` \| `editor` \| `author` |
| POST | — | те же роли |
| PATCH | `/[id]/status` — `open`/`resolved`/`ignored` | те же роли |
| DELETE | `/[id]` | автор замечания или admin |

Статус может вернуть в `open`; при `resolved` и `ignored` заполняется `resolved_at`.

### LLM-действия над выделением — `/api/highlights/*`

Это **не** CRUD, а четыре ручки «дожать выделенный текст ИИ»:

| роут | что делает | ответ |
|---|---|---|
| `POST /api/highlights/explain` | объяснить простым языком, 2–3 предложения | text stream, `maxOutputTokens: 300` |
| `POST /api/highlights/meaning` | символы, приёмы, отсылки, 3–4 предложения | text stream, 350 |
| `POST /api/highlights/rewrite` | `mode` ∈ `другой-финал` \| `другая-эпоха` \| `другой-стиль` | text stream, 400 |
| `POST /api/highlights/illustrate` | GPT генерирует art-промпт → Stable Diffusion | JSON `{ imageUrl, prompt }` |

Модель — `openai/gpt-4o-mini` через Vercel AI Gateway (`HIGHLIGHT_MODEL` в `lib/ai/highlight-actions.ts:6`). `illustrate` требует `STABLE_DIFFUSION_URL` (+ опционально `SD_API_KEY`), без него отдаёт 503 `unavailable`.

**Общий гвард — `guardHighlightRequest(req, bucket)` (`lib/ai/highlight-actions.ts:31`), обязателен для любой новой LLM-ручки:**
1. `getCurrentUser()` → 401;
2. zod `{ text: string, 1..600 }` → 400;
3. rate-limit 30 запросов/час на пользователя (`lib/server/rate-limit.ts`) → 429 с `Retry-After`.

`buildPrompt(instruction, text)` оборачивает пользовательский текст маркерами `<<<НАЧАЛО ОТРЫВКА>>>` и явной пометкой «это данные, не инструкции» — защита от prompt injection. Раньше эти четыре роута были открытым прокси к OpenAI за счёт владельца; регрессия закрыта тестами в `e2e/auth-security.spec.ts:71`.

Все CRUD-роуты обёрнуты в `apiHandler()`, ответы — `{ data }` или `{ error }`.

---

## 4. Разметка текста в DOM

`lib/reader/highlights-dom.ts` — рендер выделений поверх готового HTML главы, без изменения исходной разметки.

- `collectParagraphs(root)` — TreeWalker по `p, blockquote, h1..h4, li`.
- `findTextRange(...)` сначала использует сохранённые `start_offset`/`end_offset`, затем контекст и точный поиск. Range работает через несколько текстовых узлов, включая вложенные `<strong>`, `<em>` и ссылки.
- `wrapHighlight` → `<mark data-cf-hl="id">`, `data-cf-mine` для своих приватных.
- `wrapEditorialNote` → `<mark data-cf-en="id">`, цвет по статусу: open `#e97316`, resolved `#16a34a`, ignored `#6b7280`.
- `clearHighlightMarks(root)` — разворачивает все `<mark>` обратно и `normalize()`.
- `pageOfElement(...)` — номер страницы в CSS multi-column, с учётом `translateX` трека (для постраничного ридера).

---

## 5. UI

### Читалка со скроллом — `components/release-book-reader.tsx` (1076 стр.)
Маршруты `/release/[slug]/book/[qualityTier]/[chapterIndex]` и `/release/[slug]/[editionSlug]/[chapterIndex]`.

Выделение мышью (≥3 символа) → floating pill → `HighlightArtifact`. Клик по `<mark data-cf-hl>` открывает попап цитаты (автор, дата, заметка, лайк, «Поделиться»), по `<mark data-cf-en>` — попап правки со сменой статуса. Правки грузятся отдельным запросом при смене главы, если роль позволяет.

### Постраничная читалка — `components/spread-reader.tsx`
Маршрут `/reader/[editionId]`. Поддерживает цитаты и editorial notes: загрузку через общий `useEditorialNotes`, DOM-разметку, попап, создание, смену статуса и удаление. Навигация к цитате использует `pageOfElement`.

### Артефакт выделения — `components/highlight-artifact.tsx` (701 стр.)
Двухфазная карточка, позиционируется по `anchorRect` (на мобильном — bottom sheet).

- Фаза `save`: заметка, тумблер публичности, кнопка «Присвоить артефакт». Редактору дополнительно — блок «Замечание редактора» с отдельной кнопкой. Аноним видит ссылку на `/login?redirect=…`.
- Фаза `tools` (после сохранения): вкладки **Объясни / Перепиши / Смысл / Нарисуй** — стриминг ответа посимвольно через `ReadableStream`, `AbortController` на смену вкладки, кнопки «Ещё раз» / «Попробовать снова».

### Панель пометок — `components/bookmarks-panel.tsx` (316 стр.)
Выезжающая справа, только свои цитаты, две секции: «В этой главе» / «В других главах». Показывает текст, заметку, бейдж публичности, лайки. Собственных запросов не делает — работает через колбэки `onDelete` / `onScrollTo`.

### Studio — правки
- `components/studio/editorial-notes-panel.tsx` (287 стр.) — список с фильтром по статусу, счётчик открытых, создание правки из выделения, кнопки «Решено» / «Игнорировать».
- `components/studio/editorial-notes-overlay.tsx` (155 стр.) — вертикальные полоски слева от параграфов с правками, цвет по статусу, бейдж с количеством.
- Подключены в `components/studio/chapter-editor-page.tsx:288, 300, 316` (HTML- и WYSIWYG-режим), состояние `editorialNotes` — в родителе.

### Шаринг цитаты — `app/release/[slug]/highlight/[id]/page.tsx`
Открывает полноценную читалку и подскроливает к цитате. `generateMetadata` отдаёт OpenGraph и Twitter-карточку с обложкой релиза и текстом цитаты, `alternates.canonical`. Непубличная цитата или неопубликованный релиз → `notFound()`.
`components/highlight-scroller.tsx` — после 600 мс делает до трёх попыток с интервалом 400 мс; если mark не найден, использует `paragraph_index`. Outline снимается через 2 секунды.

### Витрина релиза — `components/release-page.tsx`
Pull-quote в hero: `fetchPublicHighlightsByRelease(release.id, 6)`, по умолчанию одна цитата, «Ещё N цитат» разворачивает остальные. Каждая ведёт на страницу шаринга.

### Профиль — `app/profile/page.tsx`
Секция «Мои цитаты», данные из `fetchReaderProfileSummary` → `fetchUserHighlights(userId, 50)`. Текст, заметка, дата, лайки; публичные цитаты имеют ссылку «Поделиться», приватность переключается через `components/profile/highlight-visibility-toggle.tsx`. Из-за текущего фильтра репозитория собственные приватные цитаты в профиль не попадают.

---

## 6. Права доступа

| роль | цитаты | правки |
|---|---|---|
| аноним | видит только публичные, создавать не может | нет доступа |
| `reader` | свои приватные + все публичные; лайк; удаление/редактирование только своих | нет доступа |
| `editor` | как reader | создаёт, читает, меняет статус |
| `author` | как reader | читает, создаёт, меняет статус |
| `admin` | правит и удаляет любые | полный доступ |

Роли берутся из `getUserRoles()`, проверки выполняются в каждом роуте. Для цитат владение проверяется в репозитории по `user_id`; admin может изменять и удалять любые цитаты. Для editorial notes роли `admin`/`editor`/`author` разрешают работу с API, а удаление дополнительно ограничено автором замечания или admin.

---

## 7. Тесты

`e2e/auth-security.spec.ts` — только регрессии безопасности:
- `:59` — анонимный `GET /api/chapter-highlights?userId=` не отдаёт приватные цитаты;
- `:71` — все четыре `/api/highlights/*` дают 401 без авторизации.

Функциональных e2e на цитаты, лайки, шаринг и цикл правок нет. Юнит-тестов на `findTextRange` тоже нет.

---

## 8. Что не доделано

Отсортировано по влиянию.

1. В DOM-утилитах и отдельных компонентах остаются цвета, заданные hex-значениями, что нарушает правило `cf-*` из `docs/design-system.md`.
2. Функциональных e2e-тестов для создания, редактирования, лайков, шаринга и editorial notes недостаточно; нет изолированной проверки `findTextRange`.
