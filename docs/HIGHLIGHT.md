# HIGHLIGHT.md — выделения, цитаты и редакторские правки

Актуально на 01.08.2026. Документ описывает **фактическое** состояние кода, включая незакрытые дыры (раздел «Что не доделано»).

> Предыдущая версия этого файла описывала legacy-систему (единая таблица `highlights` с полями `book_id` / `type` / `visibility`, роуты `/api/highlights`, `components/book-reader.tsx`). Той системы больше нет: таблица дропнута в `postgres/highlights-migration.sql:54`. Всё ниже — про Release-систему.

---

## 1. Модель данных

Миграция: `postgres/highlights-migration.sql`. Три таблицы, привязка к `chapters(id)`, а не к книге.

### `chapter_highlights` — цитаты читателей

| поле | тип | смысл |
|---|---|---|
| `id` | UUID PK | |
| `chapter_id` | UUID → `chapters` ON DELETE CASCADE | |
| `user_id` | UUID → `users` ON DELETE CASCADE | владелец |
| `text_content` | TEXT NOT NULL | выделенный фрагмент |
| `paragraph_index` | INTEGER | индекс параграфа в DOM-порядке (для быстрой пере-разметки) |
| `context_before` / `context_after` | TEXT | ±30 символов вокруг — fallback-якорь, если текст не нашёлся по индексу |
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
- `fetchUserHighlights(userId, limit = 100)` — подмешивает `release_slug` и `chapter_title` одним запросом по всем `chapter_id`.
- `createChapterHighlight`, `updateChapterHighlight(id, userId, isAdmin, { note?, is_public? })`, `deleteChapterHighlight(id, userId, isAdmin)` — обе мутации сначала читают `user_id` и сверяют владение (или admin).
- `toggleHighlightLike(highlightId, userId)` — лайкнуть можно только публичную либо свою.

**Правки:** `fetchChapterEditorialNotes(chapterId)`, `createEditorialNote`, `updateEditorialNoteStatus` (проставляет `resolved_at` при `resolved`/`ignored`), `deleteEditorialNote` — последняя **никем не вызывается**, HTTP-роута под неё нет.

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
| POST | `/[id]/like` | авторизация, toggle |

### Правки — `/api/chapter-editorial-notes`
| метод | путь | доступ |
|---|---|---|
| GET | `?chapterId=` | роль `admin` \| `editor` \| `author` |
| POST | — | те же роли |
| PATCH | `/[id]/status` — `open`/`resolved`/`ignored` | те же роли |

DELETE-роута нет.

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
- `findTextRange(paragraph, text, contextBefore)` — ищет Range: сначала прямое вхождение `text`, затем fallback по `context_before` + первые 20 символов. Узлы внутри уже созданного `<mark>` пропускаются. Кросс-узловые выделения (текст, разорванный тегом) не находятся — молча пропускаются.
- `wrapHighlight` → `<mark data-cf-hl="id">`, `data-cf-mine` для своих приватных.
- `wrapEditorialNote` → `<mark data-cf-en="id">`, цвет по статусу: open `#e97316`, resolved `#16a34a`, ignored `#6b7280`.
- `clearHighlightMarks(root)` — разворачивает все `<mark>` обратно и `normalize()`.
- `pageOfElement(...)` — номер страницы в CSS multi-column, с учётом `translateX` трека (для постраничного ридера).

---

## 5. UI

### Читалка со скроллом — `components/release-book-reader.tsx` (1076 стр.)
Маршруты `/release/[slug]/book/[qualityTier]/[chapterIndex]` и `/release/[slug]/[editionSlug]/[chapterIndex]`.

Выделение мышью (≥3 символа) → floating pill → `HighlightArtifact`. Клик по `<mark data-cf-hl>` открывает попап цитаты (автор, дата, заметка, лайк, «Поделиться»), по `<mark data-cf-en>` — попап правки со сменой статуса. Правки грузятся отдельным запросом при смене главы, если роль позволяет.

### Постраничная читалка — `components/spread-reader.tsx` (971 стр.)
Маршрут `/reader/[editionId]`. Тот же цикл для цитат + навигация к цитате через `pageOfElement`. **Editorial notes не поддерживает.**

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
`components/highlight-scroller.tsx` — через 600 мс ищет `mark[data-cf-hl="id"]`, скроллит и подсвечивает outline.

### Витрина релиза — `components/release-page.tsx`
Pull-quote в hero: `fetchPublicHighlightsByRelease(release.id, 6)`, по умолчанию одна цитата, «Ещё N цитат» разворачивает остальные. Каждая ведёт на страницу шаринга.

### Профиль — `app/profile/page.tsx:140`
Секция «Мои цитаты», данные из `fetchReaderProfileSummary` → `fetchUserHighlights(userId, 50)`. Текст, заметка, дата, лайки; для публичных — ссылка «Поделиться», для приватных — статичная метка «приватная».

---

## 6. Права доступа

| роль | цитаты | правки |
|---|---|---|
| аноним | видит только публичные, создавать не может | нет доступа |
| `reader` | свои приватные + все публичные; лайк; удаление/редактирование только своих | нет доступа |
| `editor` | как reader | создаёт, читает, меняет статус |
| `author` | как reader | читает, создаёт, меняет статус |
| `admin` | правит и удаляет любые | полный доступ |

Роли берутся из `getUserRoles()`, проверки — в каждом роуте. `requireStudioSession()` и гварды владения из `lib/server/studio-auth.ts` в highlight-роутах **не используются** — владение проверяется вручную через `user_id` записи (см. «Что не доделано»).

---

## 7. Тесты

`e2e/auth-security.spec.ts` — только регрессии безопасности:
- `:59` — анонимный `GET /api/chapter-highlights?userId=` не отдаёт приватные цитаты;
- `:71` — все четыре `/api/highlights/*` дают 401 без авторизации.

Функциональных e2e на цитаты, лайки, шаринг и цикл правок нет. Юнит-тестов на `findTextRange` тоже нет.

---

## 8. Что не доделано

Отсортировано по влиянию.

**Ломает пользовательский сценарий**
1. `spread-reader.tsx:810` — `onSaveEditorial={async () => {}}`. Редактор в постраничной читалке видит поле «Замечание редактора», жмёт «Отправить» — правка не сохраняется, ошибки нет.
2. `PATCH /api/chapter-highlights/[id]` не вызывает **ни один** клиент. После создания цитаты нельзя ни изменить заметку, ни переключить публичность — ни из панели пометок, ни из профиля. Иконки `Eye`/`EyeOff` в `bookmarks-panel.tsx:274` — некликабельные `<span>`.
3. Правку невозможно удалить: `deleteEditorialNote()` (`lib/server/chapter-highlights.ts:303`) без HTTP-роута и без вызовов. Вернуть статус в `open` из UI тоже нельзя, хотя API это принимает.
4. `editorial-notes-panel.tsx:99,106` считает `paragraph_index` от `document.querySelectorAll('p, …')` по **всей странице**, а `editorial-notes-overlay.tsx:52` — только внутри `.ProseMirror`. Индексы систематически расходятся; спасает лишь fallback-поиск по тексту.
5. Overlay пересчитывается только на `resize` и смену `notes` — при наборе текста и скролле полоски разъезжаются с параграфами.
6. `HighlightScroller` — одна попытка через 600 мс, без ретраев и фолбэка; при медленной гидрации или пагинации цитата не находится, outline после подсветки не снимается.

**Технический долг**
7. `release-book-reader.tsx:1023-1075` держит собственные копии `findTextRange` / `styleMark` / `wrapHighlight` / `wrapEditorialNote` вместо импорта из `lib/reader/highlights-dom.ts`. Там же `accent_for_hl()` игнорирует аргумент и возвращает хардкод `#d52525`.
8. `spread-reader.tsx` не поддерживает editorial notes в принципе — ни загрузки, ни разметки, ни попапа.
9. Хардкод hex вместо `cf-*`-переменных: `highlight-scroller.tsx:11`, `highlights-dom.ts:114`, `editorial-notes-overlay.tsx:123`, `release-book-reader.tsx:1073`, плюс `bg-orange-50`/`text-green-700` в `editorial-notes-panel.tsx`. Нарушает `docs/design-system.md`.
10. Мёртвый тип `HighlightType` в `lib/types.ts:247`.
11. `spread-reader.tsx:49` — проп `userName` передаётся, но не деструктурируется.
12. `bookmarks-panel.tsx:189` — футер «Только вы видите свои закладки» противоречит наличию публичных цитат. Удаление — без подтверждения и через `opacity: 0` вне hover (недоступно с клавиатуры и на тач-устройствах).
13. `app/profile/page.tsx:90` — три `<section>` в двухколоночной сетке, «Диалоги» съезжает.
14. `ChapterHighlight.release_slug?: string`, а `fetchUserHighlights` кладёт туда `null`, глуша это через `as`.
15. `POST /api/chapter-highlights` и `POST /api/chapter-editorial-notes` валидируют тело вручную (`if (!chapter_id …)`), а не zod-схемой из `lib/schemas/`. `text_content` цитаты ограничен 5000 символами, у правки лимита нет вообще.
16. `text_content` и `note` не проходят через `lib/sanitize.ts` перед записью, хотя правило проекта — санитизация на сервере до записи в БД.
17. На CRUD-роуты цитат и правок рейт-лимит не навешен (только на LLM-ручки) — создание цитат ничем не ограничено.
18. Функциональных e2e нет; обещанного теста на `findTextRange` (комментарий `spread-reader.tsx:970`) не существует.
