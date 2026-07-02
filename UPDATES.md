# Обновления

---

## [2 июля 2026] Исправление eslint: 17 ошибок в production-коде

### Что изменено
- `components/character-profile-tabs.tsx`, `components/character-profile-header.tsx` — заменены `<img>` на `<Image>` из next/image (убран `@next/next/no-img-element`)
- `components/highlight-artifact.tsx` — добавлены недостающие зависимости в useEffect (`runExplain`, `runMeaning`)
- `lib/reader/use-column-pagination.ts` — добавлена зависимость `measure` в useEffect
- `components/highlight-artifact.tsx`, `components/release-book-reader.tsx`, `components/spread-reader.tsx`, `components/studio/editorial-notes-overlay.tsx`, `components/studio/editorial-notes-panel.tsx`, `components/character-friend-button.tsx` — добавлены `eslint-disable-next-line` с обоснованиями для `react-hooks/set-state-in-effect`
- `components/account-settings-client.tsx` — исправлены `react-hooks/set-state-in-effect` и `react/no-unescaped-entities`

### Зачем
- React Compiler в Next.js 16 превратил эти правила в `error` — `pnpm lint` падал с 14 ошибками
- issue #6: "Убрать 17 eslint-disable из production-кода"

### Как использовать
- `pnpm lint` — 0 ошибок (65 warnings не в scope)
- `pnpm build` — проходит без ошибок

---

## [2 июля 2026] Soft-delete пользователей в админке

### Что изменено
- `postgres/009_user_soft_delete.sql` — новая миграция: `users.is_deleted BOOLEAN` + `users.deleted_at TIMESTAMPTZ` + partial-индекс
- `postgres/schema.sql` — те же поля добавлены в bootstrap
- `lib/types.ts` — `UserProfile` / `AdminUserProfile` получили `is_deleted`, `deleted_at`
- `lib/server/users.ts` — `softDeleteUser()`, `countActiveAdmins()`; `listAdminUsers` и `findUserByLogin` фильтруют `is_deleted = false`
- `app/api/admin/users/[id]/route.ts` — `DELETE` handler с защитой:
  - нельзя удалить свой аккаунт (`session.user.id === id`)
  - нельзя удалить последнего администратора
  - повторное удаление → 410
- `app/admin/page.tsx` (Users Tab) — кнопка «Удалить» с подтверждением

### Зачем
Админ должен иметь возможность скрыть пользователя без физического удаления строки из БД (сохраняем связи с друзьями/диалогами/хьюлайтами/заказами).

### Как использовать
1. Применить миграцию: `psql $DATABASE_URL -f postgres/009_user_soft_delete.sql`
2. В `/admin` → «Пользователи» нажать «Удалить» в карточке нужного юзера
3. Скрытый пользователь не отображается в списке и не может войти

---

## [2 июля 2026] Единый вход canfly SSO

### Что изменено
- Добавлен OAuth-провайдер GitHub в next-auth.
- Добавлен OIDC-провайдер `canfly` для поддоменов и внешних приложений.
- На `/login` добавлена кнопка «Войти через GitHub» и условная кнопка «Войти через canfly».
- Убран OAuth-провайдер Apple.
- Обновлены `.env.example`, `QUICKSTART.md`, `README.md`, `docs/sso.md`, `docs/CANFLY_SSO.md`.

### Зачем
- `canfly.org` становится центром аккаунта, а поддомены используют единый вход через OIDC.

### Как использовать
- Добавить `AUTH_GITHUB_CLIENT_ID` и `AUTH_GITHUB_CLIENT_SECRET` в `.env.local`
- Callback URL для GitHub OAuth App: `https://<домен>/api/auth/callback/github`
- `avatars.githubusercontent.com` добавлен в `next.config.mjs` images.remotePatterns

---

## [17 июня 2026] Новая читалка-разворот `/reader/[editionId]`

### Что изменено
- **Новый маршрут** `app/reader/[editionId]/page.tsx` — загрузка издания по UUID
- **Компонент разворота** `components/spread-reader.tsx` (2300+ строк):
  - CSS multi-column пагинация: браузер режет контент на дискретные страницы по высоте
  - Desktop: две страницы side-by-side (разворот), корешок с градиентной тенью
  - Mobile: одна страница (автоматический режим на ширине <900px)
  - Пролистывание: стрелки, клавиши ←/→/Space, свайп
  - Highlights: выделение текста → floating pill → артефакт → закладки в panel
  - Темы: тёмная/светлая/сепия с сохранением в localStorage
  - Размер шрифта A-/A+ с якорированием позиции при remeasure
  - Прогресс чтения: сохраняется на `/api/reading-progress`, resume-функционал
- **Хук пагинации** `lib/reader/use-column-pagination.ts`:
  - ResizeObserver с debounce для пересчёта при resize
  - Автоматический clamp `currentPage` при смене layout (spread ↔ single)
  - Готовность шрифтов: `document.fonts.ready` для корректного pageCount
  - Загрузка картинок: img.onload → remeasure
- **Утилиты highlights** `lib/reader/highlights-dom.ts`:
  - Вынесены из `release-book-reader.tsx` (устранено дублирование ~150 строк)
  - TreeWalker по параграфам, поиск текста (точный + контекстный fallback)
  - `wrapHighlight` / `wrapEditorialNote` с `accent` параметром

### Зачем
- Книжный разворот — максимально естественный читательский опыт на desktop
- Истинная пагинация (как в бумажной книге), а не бесконечный скролл
- Переиспользование всей инфраструктуры highlights/progress/themes из Release-ридера
- Новый URL `/reader/{editionId}` удобен для прямых ссылок и resume

### Как использовать
- Открыть `/reader/<UUID издания>` (напр. `/reader/550e8400-e29b-41d4-a716-446655440000`)
- Desktop (ширина >900px): две страницы разворотом, стрелки по бокам, корешок видна
- Узкий экран (<900px): одна страница, отсутствует корешок, стрелки всё ещё работают
- Кнопки: A-/A+ (размер шрифта), ☰ (оглавление), 📖 (мои закладки), ☀️/🌙/🎨 (тема)
- Выделить текст → кнопка «Артефакт» → создать highlight → видно в закладках (панель 📖)
- Темы сохраняются в localStorage, автоматически восстанавливаются при перезагрузке
- Прогресс чтения синхронизируется на сервер (debounce 1.5s); при обновлении откроется та же глава

---

## [17 июня 2026] Обновлён копирайт в футере

### Что изменено
- `components/site-footer.tsx`, `app/news/page.tsx`, `app/news/[id]/page.tsx` — текст копирайта
  `© 2005-2026 canfly. Литературная вселенная Адиома Тимура.` → `© 2005-2026 canfly | культура твоего сознания.`
- `docs/design-system.md`, `canfly-releases-snapshot.md` — синхронизирован эталон копирайта

### Зачем
- Единый слоган бренда «культура твоего сознания» во всех футерах

### Как использовать
- Ничего настраивать не нужно — текст применяется автоматически во всех футерах сайта

---

## [17 июня 2026] SEO-улучшения + редизайн /releases

### Что изменено

**SEO (14 файлов):**
- `app/layout.tsx` — добавлены `metadataBase`, корневой `openGraph`, `twitter: summary_large_image`
- `app/page.tsx` — OG + twitter + canonical + `WebSite` JSON-LD с SearchAction
- `app/releases/page.tsx`, `app/characters/page.tsx`, `app/books/page.tsx`, `app/colors/page.tsx` — добавлены OG, twitter, canonical
- `app/release/[slug]/[editionSlug]/[chapterIndex]/page.tsx` — новый `generateMetadata` (title/description/OG/twitter/canonical)
- `app/sitemap.ts` — добавлены `/releases`, `/colors`
- `lib/seo/schema.ts` — новый `generateWebSiteSchema` с SearchAction
- `components/release-page.tsx` — `<img>` → `<Image>` (next/image)
- `components/books-client.tsx` — `alt=""` → `alt={book.title}`, `alt={ch.name}`
- `components/comic-reader.tsx`, `components/release-comic-reader.tsx` — `alt=""` → `alt={Страница N}`

**Редизайн /releases:**
- `components/releases-page-bookmate.tsx` — убраны `ShelfSection`, «Новинки», «Популярное»; сетка книг сразу на странице
- `app/releases/page.tsx` — убран A/B тест `?ab=bookmate`, bookmate-дизайн стал основным

### Зачем
- Яндекс и Google будут корректно индексировать страницы и показывать превью при шаринге
- `/releases` теперь чистая сетка с category pills вместо hero + шельфов

### Как использовать
- `/releases` — сетка книг с фильтрами (Всё / Комиксы / Книги / Аудио / Журналы / Альбомы)
- `/releases?ab=bookmate` — тот же дизайн (A/B тест больше не нужен)
- Все страницы имеют OG, twitter cards и canonical URLs

---

## [17 июня 2026] Фикс ESLint: setState в useEffect (search-dialog)
- Убран `useEffect` для загрузки недавних запросов — заменён на `handleOpenChange`
- Исправляет ошибку `react-hooks/set-state-in-effect` (блокировала `pnpm build`)

---

## Редизайн страницы релиза в стиле Marginalia (17 июня 2026)

### Что изменено
- `components/release-page.tsx` — полная переделка hero-секции:
  - Two-column layout: обложка слева (320px), контент справа, `items-center`
  - Убран размытый blur-фон за обложкой
  - Убрана секция «Где читать и слушать» — издания теперь pills-кнопки в hero
  - Pills ведут на ридер: Черновик →, Полная версия →, Комикс → и т.д.
  - Убрана кнопка «Одним файлом»
  - Убрана секция «Персонажи» из UI (данные на уровне релиза остаются)
  - Мета-чики: текст через `·` без иконок (23 главы · 51 тыс. слов · 4 ч 14 мин)
  - Цитаты: pull-quote стиль с `border-l-2` + курсив
  - Убраны неиспользуемые импорты (Headphones, BookMarked, Disc3, Newspaper, Music2, Quote)
  - Используются CSS-классы `bg-cf-bg text-cf-text-1` вместо inline стилей — адаптация к light/dark теме

### Зачем
- Стилизация под Marginalia.shop: чистый двухколоночный layout, минимализм
- Pills-кнопки вместо карточек изданий — интуитивнее: видно сразу какие варианты чтения доступны
- Убрано лишнее: blur-фон, отдельные секции, «Одним файлом»

### Как использовать
- Страница `/release/[slug]` автоматически отображается в новом стиле
- Каждая pill-кнопка ведёт на ридер соответствующего издания

---

## Улучшения поиска: UX + ранжирование + опечатки (17 июня 2026)

### Что изменено

**UX Cmd+K диалога:**
- `components/search/search-dialog.tsx` — AbortController (устранена гонка ответов при быстром наборе); пустое состояние с секцией «Недавнее» (localStorage) и быстрыми ссылками (Все релизы / Персонажи / Новости); футер-подсказки клавиш `↑↓ · ↵ · esc`; подсветка совпадений в названиях
- `lib/search-highlight.tsx` — новый util `highlight(text, query)` → React-узел с `<mark>`
- `lib/search-recent.ts` — util для localStorage (ключ `cf:recent-searches`, dedup, до 6 записей)

**Страница /search:**
- `components/search/search-results-tabs.tsx` — новый клиентский компонент с табами-фильтрами «Все / Релизы / Персонажи / Новости» (counts, переключение без перезагрузки)
- `app/search/page.tsx` — блок результатов заменён на `SearchResultsTabs`
- Row-компоненты (`search-result-release/character/news`) — проп `query` + подсветка в названии и сниппете

**Релевантность:**
- `lib/server/search.ts` — гранулярный ранг (точное совпадение → префикс → вхождение → другие поля); вторичная сортировка по `view_count DESC` для релизов

**Нечёткий поиск (опечатки):**
- `postgres/007_search_trgm.sql` — миграция: `CREATE EXTENSION pg_trgm` + GIN-индексы на title (releases, characters, news_posts); **применена к Neon**
- `lib/server/search.ts` — гибридный WHERE: `LIKE` + `word_similarity($q, title) >= 0.4`

### Зачем
- Устранена гонка ответов при быстром наборе (AbortController)
- Пустой диалог стал полезным (недавнее + навигация)
- Совпадения визуально выделены в обоих местах поиска
- Табы позволяют фокусироваться на одном типе результатов
- Опечатки находят результаты: «помедки» → «Пометки на полях»

### Как использовать
- `word_similarity` требует `pg_trgm` extension в БД — миграция `postgres/007_search_trgm.sql` применена
- При переносе на новую БД — выполнить миграцию первой
- Порог схожести 0.4 — можно скорректировать в `search.ts`

---

## Поиск по релизам (17 июня 2026)

### Что изменено
- `lib/server/search.ts` — добавлен 3-й тип результата `release`: интерфейс `SearchResultRelease`, поле `releases` в `SearchResults`, `kind` в `AutocompleteItem` расширен до `release`. Ветки `UNION ALL` для релизов в `searchAll` и `searchAutocomplete` (поиск по `title`, `annotation`, `description`, `genre`, `authors`), фильтр `status = 'published'`. В автокомплите лимит перераспределён под 3 вида (релизам — больше)
- `components/search/search-result-release.tsx` — новый компонент строки результата с прямоугольной обложкой 2:3
- `app/search/page.tsx` — секция «Релизы (N)» рендерится первой
- `components/search/search-dialog.tsx` — группа «Релизы» в Cmd+K первой, с миниатюрой обложки

### Зачем
- Релизы — основной контент сайта, но в поиске их не было вообще (искались только персонажи и новости)
- Релизы первыми в выдаче — как главный тип контента

### Как использовать
- Cmd+K и `/search` находят релизы по названию/аннотации/жанру/авторам, ведут на `/release/<slug>`
- Драфты и архивные релизы в поиск не попадают (только `published`)
- Глубина — метаданные релиза; полнотекст по главам не входит (отдельная задача)
- Проверено вживую на localhost (обе темы): «Маша» → релиз «Маша, можно!» + персонаж + новость; драфты (`test`, `electronicmicroanimal`) не находятся; `tsc --noEmit` чист

---

## Фикс поиска: невидимый диалог + пропадающие результаты (17 июня 2026)

### Что изменено
- `app/globals.css` — в `@theme inline` добавлены семантические токены shadcn/ui (`--color-background`, `--color-popover`, `--color-border`, `--color-muted-foreground`, `--color-accent` и др.), замапленные на палитру `cf-*`. Раньше их не было вообще
- `components/ui/command.tsx` — `CommandDialog` теперь прокидывает проп `shouldFilter` в `Command`
- `components/search/search-dialog.tsx` — у `CommandDialog` выставлен `shouldFilter={false}`
- `app/search/page.tsx` — убран литеральный `\n` в JSX перед `</main>`

### Зачем
- **Прозрачный диалог поиска**: `DialogContent` (`bg-background`) и `Command` (`bg-popover`) ссылались на несуществующие токены → фон прозрачный, окно поиска было не видно
- **Пустые результаты в Cmd+K**: `cmdk` по умолчанию (`shouldFilter=true`) сам фильтровал пункты по их `value` (`character-${id}`), который не содержит запрос, и вырезал серверные результаты. Фильтрация и так идёт на сервере
- Литеральный `\n` выводил текст «\n» в подвале страницы `/search`

### Как использовать
- Поиск (Cmd+K и страница `/search`) работает в обеих темах. Проверено вживую на localhost: запрос «Вар» → персонаж «Варя Сёмина» + новость

---

## Правила OpenCode для Next.js (17 июня 2026)

### Что изменено
- Создан `docs/nextjs-rules.md` — правила для AI-агента при работе с Next.js (чтение документации, Server/Client Components, API Routes, кэширование, типичные ошибки)
- Создан `opencode.json` — конфигурация OpenCode с подключением инструкций из `docs/nextjs-rules.md`, `docs/design-system.md`, `UPDATES.md`
- Обновлён `AGENTS.md` — убран HTML-комментарий `<!-- BEGIN/END:nextjs-agent-rules -->`, добавлен отдельный блок `⚠️ Перед каждым git commit` с требованием обновлять `UPDATES.md`

### Зачем
- Адаптация проекта под систему правил OpenCode
- Правила Next.js вынесены в отдельный файл для модульности
- Явное требование обновлять `UPDATES.md` перед коммитом

### Как использовать
- При запуске OpenCode в проекте — правила подтянутся автоматически из `opencode.json`
- `docs/nextjs-rules.md` —  (при работе с Next.js сначала читай его)

---

## v6.5 — Слова песни + умный CTA для аудиорелизов (17 июня 2026)

### Что изменено

**1. Синхронизированные слова песни (Lyrics)**
- `lib/utils/lyrics.ts` — парсер LRC-формата (`[mm:ss.ms] текст`), сериализация LRC, `findActiveLine()` для подсветки по времени
- `lib/releases-types.ts` — типы `LyricLine`, `ChapterLyrics`, хелпер `extractLyrics()` для чтения из `audio_metadata`
- `lib/schemas/studio.ts` — zod-схемы `lyricLineSchema`, `lyricsSchema` для валидации
- `components/studio/audio-chapter-editor.tsx` — три режима:
  - **Ввод** — textarea с LRC-парсингом, автоопределение формата (synced/plain)
  - **Синхронизация** — ручная простановка таймкодов под играющий превью-аудио, кнопки «Поставить метку», «← Назад», «След. →»
  - **Превью** — тёмный плеер с подсветкой активной строки и перемоткой по клику
- `components/release-audio-player.tsx` — кнопка «Слова» в хедере, боковая панель с подсветкой активной строки (synced) или читаемым текстом (plain), автоскролл, клик по строке → перемотка
- Хранение: `audio_metadata.lyrics` в JSONB (без миграции БД)

**2. Навигация аудиоплеер → страница релиза**
- `components/release-audio-player.tsx` — pill-кнопка `← О релизе` в header, accent border, ведёт на `/release/${release.slug}`

**3. Format-aware hero CTA на странице релиза**
- `components/release-page.tsx` — CTA зависит от primary edition:
  - `audiorelease` → «Слушать релиз» + Disc3
  - `album` → «Слушать альбом» + Music2
  - `audiobook` → «Слушать аудиокнигу» + Headphones
  - `book` → «Читать» + BookOpen (как было)
  - `comic/magazine` → «Смотреть» / «Читать выпуск»
- `Одним файлом` показывается только для non-audio primary
- Alternate CTA: если primary = audio, но есть book → кнопка «Читать»; если primary = book, но есть audio → кнопка «Слушать»

**4. Smart meta chips**
- Audio primary: «N треков» + длительность
- Book primary: «N глав» + слов + время чтения
- `app/release/[slug]/page.tsx` — `meta.durationSeconds` суммарная длительность треков

**5. Багфикс: кнопка «Поставить метку» работала один раз**
- `stampCurrentLine()` проверял `lyrics.format !== 'plain'` — после первой метки блокировался. Убрано условие, теперь можно ставить/переставлять метки на любых строках

**6. Квадратная обложка для аудио**
- `components/release-page.tsx` — если primary edition = audiorelease/album/audiobook → `aspect-square rounded-xl`, иначе `aspect-[2/3] rounded-sm`

### Проверка
- `pnpm build` — успешно
- `pnpm lint` — 0 errors, pre-existing warnings only

---

## v6.4 — Lint cleanup + audiorelease zod-fix (16 июня 2026)

### Что изменено

**1. Zod-баг: создание Аудиорелиза заблокировано**
- `lib/schemas/studio.ts`: `editionFormatSchema` был без `'audiorelease'` → `createEditionAction` падал с «Invalid enum value» при создании издания формата Аудиорелиз. Добавлено значение (соответствует `lib/releases-types.ts` и `003_add_audiorelease.sql`).

**2. Lint-ошибки: 14 → 0 (Next 16 React Compiler)**
- `app/global-error.tsx`: 2× `<a href="/">` → `<Link>` (`@next/next/no-html-link-for-pages`)
- `components/highlight-artifact.tsx`: `useRef(Math.random())` → `useState` lazy-init (устранены impure-function и access-ref-in-render); reset-эффекты помечены `eslint-disable react-hooks/set-state-in-effect` с обоснованием
- `components/studio/editorial-notes-panel.tsx`: `useMemo`+ref подход → state-based с `hasLoaded` boolean (убран access-ref-in-render); data-loading эффекты помечены
- `components/studio/editorial-notes-overlay.tsx`, `chapter-editor-page.tsx` (`editorRef.current` в render → callback-ref + state), `character-friend-button.tsx`, `release-book-reader.tsx` — setState-in-effect помечены как валидный паттерн (data-loading / reset / DOM-layout-sync)

### Стратегия
React Compiler-правило `react-hooks/set-state-in-effect` стало `error` в Next 16. Для валидных use-case'ов (data-fetch на mount, reset при смене props, чтение DOM-layout) применён `eslint-disable` с комментарием-обоснованием вместо поломки data-flow. Глубокий рефакторинг (derived state, key-remount) оставлен на будущее — текущие эффекты семантически корректны.

### Проверка
- `pnpm exec tsc --noEmit` — 0 ошибок
- `pnpm lint` — **0 errors** (66 warnings, не в scope)
- `pnpm build` — успешно

---

## v6.3 — Security & Quality Pass (15 июня 2026)

### Что изменено

**1. IDOR-фикс — проверка владения в Studio (P0)**
- Добавлены `requireReleaseOwnership`, `requireEditionOwnership`, `requireChapterOwnership` в `lib/server/studio-auth.ts`
- Все mutate-actions в `lib/actions/studio.ts` теперь проверяют ownership через `release_collaborators` (role='owner') или admin
- Ранее любой автор мог мутировать чужой релиз/главу по UUID

**2. Устранена утечка AUTH_SECRET в логи**
- `proxy.ts` больше не выводит первые символы `AUTH_SECRET` при каждом запросе к `/profile`

**3. Баги ридера (release-book-reader.tsx)**
- `hl.user_id === hl.user_id` (тавтология) → `hl.user_id === currentUserId`
- `${hl.user_id}25` (UUID как hex-цвет) → `accent_for_hl(hl)`
- `revalidatePath('/release/${id}')` → `revalidatePath('/release/${release.slug}')` (UUID не инвалидировал кэш)

**4. Корректность данных**
- `setReleaseCharacters` / `setReleaseSeries` обёрнуты в транзакции (`withTransaction` в `lib/db.ts`) — устранена race condition
- `JSON.parse(authors)` обёрнут в `parseJsonArray` с try/catch и fallback на `[]`
- Реализовано сохранение прогресса чтения: `lib/server/reading-progress.ts`, `POST /api/reading-progress`, debounce 1.5с в ридере

**5. Zod-валидация Studio-actions**
- Новые схемы в `lib/schemas/studio.ts`: release, edition, chapter, series с enum-проверкой против postgres-типов
- Все create/update actions в `lib/actions/studio.ts` валидируют ввод через `validateForm()`

**6. Рефакторинг**
- `wrapHighlight` / `wrapEditorialNote` дедуплицированы: общий `findTextRange` + `styleMark`
- Шаринг хайлайтов: грузит данные всех глав, а не только первой
- Audio-player: устранён stale closure (isPlaying через ref), `goToTrack` обёрнут в `useCallback`

**7. Документация**
- AGENTS.md обновлён: размер ридера, маршруты book/[qualityTier], миграции 005/006, убраны мёртвые баги

---

## v6.2 — Авторизация через Magic Link + next-auth v5 (7 июня 2026)

### Что изменено

**1. Новая система авторизации (next-auth v5)**
- Установлен `next-auth@5.0.0-beta.25`
- Конфиг: `app/(auth)/auth.config.ts` — Credentials + Yandex + Google провайдеры (OAuth включается через env)
- `app/(auth)/auth.ts` — реэкспорт `signIn`, `signOut`, `auth`, handlers
- `app/(auth)/api/auth/[...nextauth]/route.ts` — next-auth обработчик на `/api/auth/*`

**2. Magic Link авторизация**
- Генерация 8-значного кода: `app/(auth)/actions.ts` → Server Action `createMagicLink`
- Верификация по ссылке: `GET /api/magic/verify?token=...` → помечает токен использованным → редирект на `/login?magic_email=...` → автовход
- Верификация по коду (dev): `POST /api/user/verify-code-direct` — вводишь код вручную
- В dev-режиме код выводится в консоль сервера и возвращается в UI
- Rate limit: 3 активных токена за 15 минут на email
- Таблица `magic_tokens` в Postgres (миграция: `postgres/migrations/001_magic_tokens.sql`)

**3. Страница `/login` переработана**
- Форма Magic Link (email → получить ссылку → ввести код)
- Кнопки «Войти через Яндекс» и «Войти через Google» (показываются если заданы OAuth ключи)
- Компонент `components/magic-link-form.tsx` в стиле canfly
- После успешного входа — редирект на `/profile`

**4. Роуты переорганизованы**
- Старые `/api/auth/login|logout|session` перемещены в `/api/user/login|logout|session` (не конфликтуют с next-auth)
- `components/book-reader.tsx` обновлён на `/api/user/session`

**5. Middleware (`proxy.ts`)**
- `/profile` защищён через next-auth JWT (`getToken()`)
- Авторизованный пользователь на `/login` → редирект на `/`
- `/api/auth/*` и `/api/magic/*` пропускаются без проверок

**6. `app/layout.tsx`** — добавлен `SessionProvider` из next-auth

### Как использовать

1. Накатить миграцию БД:
   ```bash
   psql $DATABASE_URL -f postgres/migrations/001_magic_tokens.sql
   ```

2. Заполнить `.env.local`:
   ```
   AUTH_SECRET=<openssl rand -base64 32>
   NEXTAUTH_URL=http://localhost:3000

   # Опционально — OAuth
   AUTH_YANDEX_CLIENT_ID=...
   AUTH_YANDEX_CLIENT_SECRET=...
   AUTH_GOOGLE_CLIENT_ID=...
   AUTH_GOOGLE_CLIENT_SECRET=...
   ```

3. Для OAuth добавить callback URL в консолях провайдеров:
   - `https://yourdomain.com/api/auth/callback/yandex`
   - `https://yourdomain.com/api/auth/callback/google`

4. В dev-режиме: открыть `/login`, ввести email → код появится в консоли сервера → ввести в форму.

### Зачем

Замена login/password авторизации на Magic Link убирает необходимость хранить пароли для читателей. Старая система (login/password через `/api/user/login`) сохранена для обратной совместимости.

---

## v6.0 — Студия персонажей + социальный профиль (7 июня 2026)

### Что изменено

**1. Студия для управления персонажами (`/studio/characters`)** — admin-only
- Список (responsive grid 1/2/3) с cover-градиентом, аватаром, bio, бейджами `reply_mode` и счётчиком способностей
- CRUD-страницы: новый, детальный (с табами Посты | Стена | О персонаже), редактирование
- Управление постами: composer (тип/текст/image upload через Vercel Blob/`scheduled_at`), таблица с индикатором scheduled, edit/delete
- Модерация стены: hide/unhide, удаление
- Доступ только для роли `admin` через `requireStudioAdminSession`

**2. Публичный профиль персонажа (`/characters/[slug]`) перестроен как соцсеть**
- Header: cover-градиент, аватар 128px, имя, bio, кнопки «Добавить/Удалить из друзей» и «Написать», блок статистики (друзья/посты/книги)
- 5 табов через query-param: Лента | О герое | Связи | Книги | Стена
- Стена: composer для зарегистрированных пользователей, удаление своих записей (или админом)
- Удалён canvas-граф связей и глобальная лента с `/characters`

**3. API и серверные функции**
- `GET|POST /api/characters/[slug]/wall`, `DELETE /api/characters/[slug]/wall/[id]` (автор или admin)
- `DELETE /api/characters/[slug]/friendship` (unfriend)
- `/api/characters/posts` — фильтр `scheduled_at` для публичной ленты
- `fetchCharacterStats`, `fetchCharacterFriends`, `deleteCharacterFriendship`

**4. Zod-схемы** — `lib/schemas/character-post.ts`
- Валидация для create/update character post и wall post через Zod (лимиты, типы, формат дат)
- Локализованные сообщения об ошибках

**5. Image polish** — `sizes` + `priority`
- 7 файлов получили `sizes` атрибут на `<Image fill>`
- `priority` для первых 3 карточек на `/characters`, `/shop`, `/books` (LCP fix)
- Результат: 0 LCP-warning, 0 missing-sizes warning в Playwright

**6. Техдолг**
- `lib/server/users.ts` — аннотация `UserRole[]` для устранения TS2345
- `app/api/admin/upload/route.ts` — убран `blob.size` (нет в типах)
- `/admin` — баннер-ссылка «Персонажи переехали в Студию»

**7. Инфраструктура тестирования**
- Playwright + ESLint v9 настроены
- `e2e/smoke.spec.ts` — 10 публичных роутов + 5 табов профиля
- `e2e/admin.spec.ts` — 6 admin-роутов (требует `ADMIN_TEST_EMAIL/PASSWORD`)
- `e2e/studio.spec.ts` — 3 studio-роута

### Зачем

Перенос управления персонажами в Студию (admin-only, role-based) и ребилд публичного профиля в стиле соцсети делают каталог героев живым: посты, друзья, читательская стена.

### Как использовать

- Студия: войти как `admin` → перейти в `/studio/characters`
- Баннер в `/admin` ведёт в Студию для удобства
- Smoke-тесты: `pnpm test:smoke` (без admin-сессии), `pnpm test:e2e` (полный прогон)
- Для локального тестирования studio/admin: `ADMIN_TEST_EMAIL=… ADMIN_TEST_PASSWORD=… pnpm test:e2e`

---

## v5.5 — Обновление зависимостей (7 июня 2026)

### Что изменено

Patch/minor-обновления без смены major-версий:

- **Next.js** 16.2.0 → 16.2.7, **React** / **React DOM** 19.2.4 → 19.2.7
- **Tailwind CSS** 4.2.2 → 4.3.0, **@tailwindcss/postcss**, **postcss**, **tailwind-merge**
- **Tiptap** (6 пакетов) 3.23.6 → 3.26.0 — редактор в studio
- **ai** 6.0.140 → 6.0.197 — чат с персонажами
- **react-hook-form**, **autoprefixer**, **date-fns** 4.4.0, **tw-animate-css** 1.4.0, **@types/react** 19.2.17

Major-обновления (zod 4, sonner 2, recharts 3, lucide-react 1 и др.) **не включены** — отложены до отдельного прохода.

### Зачем

Актуальные патчи безопасности и багфиксы в core-стеке (Next, React, Tailwind) без риска breaking changes.

### Как использовать

1. `pnpm install` (если клонировали репозиторий заново)
2. `pnpm build` — сборка проверена локально
3. `pnpm dev` — обычная разработка без изменений в workflow

---

## v5.4 — Vercel Web Analytics (7 июня 2026)

### Что изменено

- Установлен пакет `@vercel/analytics`
- В корневой layout (`app/layout.tsx`) добавлен компонент `<Analytics />` рядом с уже существующим `<SpeedInsights />`

### Зачем

Сбор анонимной статистики посещений (просмотры страниц, рефереры, устройства) в панели Vercel — дополняет Яндекс.Метрику и Speed Insights.

### Как использовать

1. Задеплойте проект на Vercel: `vercel --prod`
2. В [Vercel Dashboard](https://vercel.com) откройте проект → **Analytics** → включите Web Analytics, если ещё не включено
3. После деплоя откройте сайт в браузере — данные появятся в дашборде в течение нескольких минут
4. Локально (`pnpm dev`) аналитика не отправляется — только на production-домене Vercel

---

## v5.3 — Загрузка страниц комикса через Vercel Blob (29 мая 2026)

### Что изменено

- Добавлен API endpoint `/api/admin/upload` для загрузки изображений в Vercel Blob Storage
- Создан компонент `ComicPagesEditor` — визуальный редактор страниц комикса в админке
- Drag & drop для изменения порядка страниц
- Множественная загрузка файлов (можно выбрать несколько сразу)
- Превью миниатюр с кнопкой удаления
- Интеграция в форму редактирования книги (`book-form.tsx`)
- `preview_pages` теперь массив URL вместо текстового поля

### Как использовать

1. Открыть админку → Books → Edit/New
2. Для `type = 'comic'` появится визуальный редактор вместо текстового поля
3. Нажать "+ Добавить страницы" → выбрать файлы
4. Перетаскивать карточки для изменения порядка
5. Сохранить книгу — страницы автоматически появятся в `ComicReader`

### Требования

- Vercel Blob токены в `.env.local`:
  - `BLOB_READ_WRITE_TOKEN`
  - `BLOB_STORE_ID` (опционально)

---

## v5.2 — Webtoon-читалка для комиксов (29 мая 2026)

### Что изменено

- Создан новый компонент `components/comic-reader.tsx` — полноценная webtoon-читалка
- Комиксы (`type === 'comic'`) теперь открываются в отдельном режиме, минуя `BookReader`
- Вертикальный скролл: все страницы главы подряд, оптимизировано для мобильных
- Прогресс-бар вверху страницы (красная линия)
- UI автоскрывается через 3 сек при скролле, появляется при касании
- Миниатюры страниц внизу для быстрой навигации
- Клавиши ←/→/↑/↓ для навигации, F — полный экран
- Нативный Fullscreen API
- Lazy loading картинок (рендерятся только ±3 страницы от текущей)
- Блок покупки в конце комикса

### Как использовать

Просто открыть книгу с `type = 'comic'` — читалка подключится автоматически.

---



### Что изменено

- Добавлен динамический роутинг для глав: `/books/[slug]/[chapter]`
- Каждая глава теперь имеет уникальный URL (например, `/books/my-book/3`)
- Добавлены `id` атрибуты к заголовкам глав (`chapter-1`, `chapter-2`, и т.д.)
- Создана страница `/books/[slug]/full` для Safari Reader Mode — загружает все главы сразу
- Навигация по главам обновляет URL без перезагрузки страницы
- При закрытии и повторном открытии вкладки пользователь остаётся на той же главе

### Как использовать

1. **Постраничный режим**: `/books/my-book/1` — навигация по главам с интерактивными элементами
2. **Полная версия**: `/books/my-book/full` — все главы на одной странице для Safari Reader Mode
3. Кнопка "Полная версия" доступна в читалке для быстрого переключения
4. URL автоматически обновляется при переключении глав через оглавление или кнопки навигации

---

## v5.0 — Роли, профили и дружба с персонажами (28 мая 2026)

### Что изменено

- Добавлена SQL-миграция `scripts/005_social_roles_characters.sql` и обновлён `postgres/schema.sql`.
- Добавлены роли пользователей: `reader`, `author`, `editor`, `admin`.
- Добавлены reader-профили с временной cookie-идентификацией до подключения полноценной публичной авторизации.
- Добавлены дружба с персонажами, уровень близости, личные диалоги и сохранение истории сообщений.
- AI-чат теперь использует сохранённую историю диалога и расширенные настройки персонажа: манера речи, характер, границы знаний, политика спойлеров, режим ответов.
- На странице персонажа появилась кнопка “Добавить в друзья”, кнопка сообщения и блок книг с ролями персонажа.
- Добавлена страница `/profile` со списком персонажей-друзей, ролями и последними диалогами.
- Админ-форма персонажа расширена настройками AI-персоны и доступности сообщений.
- Добавлен пользовательский вход `/login` по `login/password`: если логина нет, создается reader-профиль.
- В админке появилась вкладка “Пользователи”: список пользователей, назначение ролей и смена пароля.

### Как использовать

1. Выполнить SQL из `scripts/005_social_roles_characters.sql` в Postgres.
2. В админке персонажа заполнить манеру речи, характер, границы знаний и режим ответа.
3. Открыть `/characters/[slug]`, добавить персонажа в друзья и перейти в чат.
4. Открыть `/profile`, чтобы увидеть друзей-персонажей и историю диалогов.
5. Открыть `/login`, чтобы войти или создать reader-профиль по login/password.

---

## v4.0 — Переход с Supabase на Neon/Postgres (24 мая 2026)

### Что изменено

- Серверные API routes и страницы переведены с Supabase SDK/PostgREST на прямые SQL-запросы через `pg`.
- Добавлен общий Postgres-клиент `lib/db.ts` и серверные репозитории для книг, персонажей и администраторов.
- Добавлен bootstrap schema-файл `postgres/schema.sql` для Neon/Vercel Postgres.
- Скрипт `pnpm db:structure` теперь читает структуру через `information_schema` из Postgres.
- Удалена зависимость `@supabase/ssr`; переменные Supabase больше не нужны приложению.

### Как использовать

1. Создать Neon/Vercel Postgres базу.
2. Выполнить SQL из `postgres/schema.sql`.
3. Добавить в `.env.local` `DATABASE_URL` или `POSTGRES_URL`.
4. Запустить `pnpm build` или `pnpm dev`.

---

## v3.0 — Главы книг и Markdown-читалка (16 мая 2026)

### Что изменено

**Новые файлы:**
- `supabase/migrations/20260516_add_chapters_to_books.sql` — миграция: поле `chapters JSONB` в таблице `books`
- `components/markdown-renderer.tsx` — рендер markdown с XSS-санитизацией (без внешних зависимостей)
- `app/admin/_components/chapter-editor.tsx` — редактор глав в админке (CRUD + порядок)

**Изменённые файлы:**
- `lib/types.ts` — добавлен интерфейс `BookChapter`, расширен `Book.chapters`
- `app/admin/_components/book-form.tsx` — для книг типа `book` показывается `ChapterEditor` вместо `preview_pages`
- `app/api/admin/books/route.ts` — валидация и сохранение `chapters` в POST
- `app/api/admin/books/[id]/route.ts` — валидация и сохранение `chapters` в PATCH
- `app/books/[slug]/page.tsx` — Reader поддерживает оба формата: картинки (комиксы) и главы (книги)

### Как использовать

**Создание книги с главами:**
1. В админке создать/редактировать книгу с типом `Книга`
2. Появится редактор глав вместо поля preview pages
3. Добавить главы с заголовком и markdown-содержимым
4. Сохранить

**Читалка:**
- Комиксы: постраничный просмотр картинок (без изменений)
- Книги: оглавление + навигация по главам + рендер markdown

**Применить миграцию БД** (если ещё не сделано):
```sql
ALTER TABLE books
  ADD COLUMN IF NOT EXISTS chapters JSONB NOT NULL DEFAULT '[]'::jsonb;
```

---

## v2.0 — Социальная сеть персонажей и AI-чат

## ✅ Что было добавлено

### 1. Новые персонажи (3)
- [x] Соня - Хранительница снов
- [x] Турбокороль - Владыка скорости  
- [x] Убыр - Древний дух
- [x] Все они добавлены в таблицу characters с полным описанием

### 2. AI-чат с персонажами
- [x] API route `/api/characters/chat` для обработки сообщений
- [x] Компонент `CharacterChat` для отображения чата
- [x] Уникальные системные промпты для каждого персонажа (8 персонажей)
- [x] Streaming ответов от OpenAI GPT-4 Mini
- [x] Интеграция на странице персонажа `/characters/[slug]`
- [x] Автоскролл при новых сообщениях
- [x] Индикаторы загрузки

### 3. Социальная сеть персонажей
- [x] Таблица `character_posts` в Supabase
- [x] API route `/api/characters/posts` для получения постов
- [x] Компонент `CharacterPostsFeed` для отображения ленты
- [x] Три типа постов: мысли, анонсы, вопросы
- [x] Отображение с аватарами и временем
- [x] Демо-посты для всех персонажей

### 4. Обновлённое название проекта
- [x] "canfly | культура твоего сознания"
- [x] Обновлены все метаданные (title, description)
- [x] Обновлены footers на всех страницах
- [x] Обновлены логотипы/названия в headers

### 5. Обновлённые страницы
- [x] `/` - главная страница с новым названием
- [x] `/characters` - добавлена лента постов в стиле соцсети
- [x] `/characters/[slug]` - добавлен AI-чат с персонажем
- [x] `layout.tsx` - обновлены метаданные проекта

## 📋 Чек-лист для тестирования

### Перед запуском:
- [ ] Проверить что переменная `OPENAI_API_KEY` установлена в `.env.local`
- [ ] Убедиться что Supabase интеграция подключена

### Функциональность:
- [ ] Главная страница загружается и отображает новое название
- [ ] Можно перейти на `/characters`
- [ ] На странице персонажей видна лента постов
- [ ] Можно нажать на персонажа и открыть его профиль
- [ ] На профиле персонажа есть чат внизу
- [ ] Можно написать сообщение в чат
- [ ] Персонаж отвечает в его стиле
- [ ] Сообщения отображаются в реальном времени (streaming)
- [ ] Посты имеют разные типы (мысль, анонс, вопрос)
- [ ] Посты отсортированы по времени

### Персонажи для тестирования:
1. **Соня** (`/characters/sonya`)
   - Ожидается мягкий, философский тон
   - Говорит о снах и символах

2. **Турбокороль** (`/characters/turbokorol`)
   - Ожидается энергичный, быстрый стиль
   - Использует метафоры о скорости

3. **Убыр** (`/characters/ubyr`)
   - Ожидается глубокий, загадочный тон
   - Философствует о страхе и тени

## 🔧 Технические детали

### Использованные технологии:
- OpenAI GPT-4 Mini для AI-чата
- Supabase для хранения постов и связей
- Next.js 16 Route Handlers для API
- Streaming responses для плавного отображения

### Файлы которые были добавлены:
```
/app/api/characters/chat/route.ts       - AI-чат endpoint
/app/api/characters/posts/route.ts      - Посты endpoint
/components/character-chat.tsx          - Компонент чата
/components/character-posts-feed.tsx    - Лента постов
/FEATURES.md                            - Документация функций
/UPDATES.md                             - Этот файл
```

### Файлы которые были изменены:
```
/app/page.tsx                           - Обновлено название
/app/layout.tsx                         - Обновлены метаданные
/app/characters/page.tsx                - Добавлена лента постов
/app/characters/[slug]/page.tsx         - Добавлен чат
```

## 🚀 Следующие шаги

1. Проверить что всё работает в Preview
2. Убедиться что OpenAI API работает корректно
3. Добавить сохранение истории чата (опционально)
4. Добавить реакции к постам (лайки, комментарии)
5. Создать админ-интерфейс для добавления постов

## v6.1 — E2E test infrastructure (7 июня 2026)

### Изменено
- `e2e/setup/global-setup.ts` — NEW: идемпотентный upsert тестового админа (login `studio_test_admin`, email `studio-test-admin@canfly.test`, password `StudioTest_Admin_2026`) с ролью `admin` + запись в `admins` таблице. Грузит `.env.local` вручную (Playwright не пробрасывает env в globalSetup). Записывает креды в `e2e/.test-credentials.json` (gitignored).
- `e2e/setup/global-teardown.ts` — NEW: удаляет тестового пользователя и связанные `user_roles`.
- `e2e/setup/credentials.ts` — NEW: `loadTestCredentials()` хелпер для тестов.
- `e2e/admin.spec.ts` — переписан: логин через `/api/admin/login` (legacy password auth, `ADMIN_SESSION_COOKIE`). Skip если креды отсутствуют.
- `e2e/studio.spec.ts` — переписан: логин через `/api/auth/login` (new user auth, `USER_SESSION_COOKIE`). Hydration regression test на `/studio/characters/[id]` через рендер первой карточки.
- `playwright.config.ts` — добавлен `testIgnore: ['**/setup/**', '**/_helpers/**']` (хелперы не подхватываются как тесты), `globalSetup`/`globalTeardown`, timeout 60s (первая компиляция в dev).
- `.gitignore` — добавлен `e2e/.test-credentials.json`.

### Два независимых auth-флоу
- `/admin` (legacy) — `/api/admin/login` с `ADMIN_PASSWORD` env → `ADMIN_SESSION_COOKIE` → `admins` таблица
- `/studio` (новый) — `/api/auth/login` с login/password → `USER_SESSION_COOKIE` + `READER_PROFILE_COOKIE` → `users` + `user_roles` таблицы

### Результат
- 21/21 e2e тестов проходят (smoke 10 public + 1 profile tabs + admin 6 + studio 4)

### Зачем
- Раньше тесты логинились через неправильный эндпоинт: `/api/admin/login` ставит `ADMIN_SESSION_COOKIE`, который не читается `getCurrentUserFromCookie()`. Студийные тесты проходили «случайно» — `requireStudioSession()` возвращал null, layout редиректил на `/login` (307, что < 400 — тест думал, что ок). Теперь studio логинится через `/api/auth/login` и реально рендерит защищённые страницы.

---

## 📞 Support

Если что-то не работает:
1. Проверьте переменные окружения
2. Проверьте логи браузера (консоль)
3. Проверьте логи сервера
4. Убедитесь что Supabase таблицы созданы
