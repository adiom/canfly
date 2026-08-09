# Обновления

---

## [9 августа 2026] Ссылки изданий ведут в читалку-разворот, чистка формы издания

### Что изменено

**`components/release-page.tsx`** — кнопки изданий на странице релиза ведут прямо в читалку `/vvvvv/[слаг издания]` вместо оглавления (`getEditionTocUrl`). Для digital-изданий поведение прежнее: внешняя ссылка на площадку. Импорт `getEditionTocUrl` убран — сама утилита осталась и продолжает использоваться в `app/sitemap.ts`.

**`components/studio/edition-setup-page.tsx`** — из формы настройки издания убраны поля «Обложка» и «Аннотация». Оба редактировали не издание, а *релиз*: у релиза может быть несколько изданий, и правка обложки из карточки одного из них молча меняла её для всех. Место этих полей — в настройках релиза. Вместе с полями ушли состояния `coverImage`/`annotation`, импорт `CoverImageUploader` и передача `cover_image`/`annotation` в `updateEditionSetupAction`.

Серверная часть не менялась: в `lib/actions/studio.ts:600` запись в релиз идёт под `if (data.cover_image !== undefined || data.annotation !== undefined)`, поля опциональны — не передавать их безопасно.

### Файлы
- `components/release-page.tsx` — href изданий
- `components/studio/edition-setup-page.tsx` — минус два поля формы

### Как использовать
Из карточки релиза кнопка издания открывает читалку сразу с первой главы. Обложка и аннотация правятся в настройках релиза.

---

## [9 августа 2026] Удалён legacy-контур книг: /books, /shop, /cart и админка книг

### Что изменено

**Удалены публичные страницы и читалки legacy-системы:**
- `app/books/**` (каталог, страница книги, глава, полная версия)
- `components/book-reader.tsx`, `components/books-client.tsx`, `components/comic-reader.tsx`
- `app/shop/page.tsx`, `app/cart/**`, `lib/cart-context.tsx` вместе с `CartProvider` из `app/layout.tsx`

**Удалена админка книг и заказов:**
- `app/admin/books/**`, `app/api/admin/books/**`, `app/api/admin/orders/route.ts`
- `app/admin/_components/`: `book-form.tsx`, `chapter-editor.tsx`, `comic-pages-editor.tsx` (использовались только формой книги; у Студии свои `components/studio/chapter-editor-page.tsx` и `comic-pages-editor.tsx`)
- В `app/admin/page.tsx` убраны вкладки «Книги» и «Заказы» — остались персонажи, новости, пользователи

**Удалён слой данных и типы:**
- `lib/server/books.ts` — единственный код, который читал таблицы `books` и `book_characters`
- `lib/types.ts`: `Book`, `BookType`, `BookChapter`, `BookCharacterLink`, `BookWithCharacters`, `BookCharacterRole`, `CharacterBookAppearance`, `BookReview`, `CartItem`, `Order`, `OrderItem`, `OrderStatus`, а также `Highlight` и `ChapterRating` — обе висели на `book_id` из мёртвой системы, живой хайлайт живёт в `chapter_highlights`
- `lib/api/normalizers.ts`: `normalizeBookPayload`, `normalizeChapters`, `BOOK_TYPES`, `normalizeExternalLinks`, `normalizeCharacterIds` — после удаления `/api/admin/books` их никто не звал
- `lib/seo/schema.ts`: `generateBookSchema`, `generateBooksCollectionSchema` (`generateBookEditionSchema` для Release-системы остался)
- `components/markdown-renderer.tsx`: функция `highlightText` и проп `highlights` — опирались на удалённый тип `Highlight`, а единственный вызов компонента (`components/studio/passport-editor.tsx`) их не передавал

### Что осталось намеренно

- **301-редиректы в `proxy.ts`** (`/books/*` → `/release/[slug]`, `/shop`, `/cart` → `/releases/`). Старые URL годами живут в индексе Google — без редиректа они отдавали бы 404 и теряли вес.
- **Надгробия API**: `GET|POST /api/books` и `POST /api/orders` продолжают отвечать «retired» (у orders — 410). Возвращать `/api/orders` нельзя: он принимал анонимный POST с ценой из тела запроса.
- **Таблицы `books`, `book_characters`, `orders`** в `postgres/schema.sql` и в базе — как архив. Живого кода к ним больше нет, миграцию с `DROP TABLE` не делали.
- Из `app/robots.ts` убран `disallow: '/cart'` — страницы нет, есть редирект на каталог.

### Файлы
- Удалены: `app/books/**`, `app/shop/`, `app/cart/`, `app/admin/books/**`, `app/api/admin/books/**`, `app/api/admin/orders/`, `app/admin/_components/{book-form,chapter-editor,comic-pages-editor}.tsx`, `components/{book-reader,books-client,comic-reader}.tsx`, `lib/server/books.ts`, `lib/cart-context.tsx`
- Изменены: `app/layout.tsx`, `app/admin/page.tsx`, `app/robots.ts`, `lib/types.ts`, `lib/api/normalizers.ts`, `lib/seo/schema.ts`, `components/markdown-renderer.tsx`, `e2e/admin.spec.ts`, `AGENTS.md`

### Как использовать
1. Контент создаётся только в Студии (`/studio`), админка отвечает за персонажей, новости, слайды и пользователей.
2. Старые ссылки на книги, витрину и корзину продолжают работать через 301 — новых ссылок на них не создавать.
3. `npx tsc --noEmit` проходит чисто.

---

## [9 августа 2026] Одна читалка-разворот: `/reader` удалён, `/vvvvv` забрал SEO

### Что изменено

**Удалён маршрут `/reader/[editionId]`** — он на 80% дублировал `/vvvvv/[slug]`: та же цепочка загрузки, тот же `SpreadReader`, те же пропсы. Отличался только SEO-блоком и отсутствием диспетчеризации по формату (любое издание уходило в `SpreadReader`, включая comic и audio).

**`/vvvvv/[slug]` — полный SEO-блок вместо заглушки A/B:**
- `title` теперь `«Название» — читать | canfly` (было `— A/B reader`)
- `description` — `release.description` (фолбэк: `annotation`, затем автогенерация с названием формата)
- OpenGraph: `title`, `description`, `url`, `type: 'article'`, `locale: 'ru_RU'`, `siteName`, обложка 600×900 при наличии `cover_image`
- Twitter Card: `summary_large_image` с обложкой, `summary` без неё
- `alternates.canonical`
- `robots: { index: false, follow: true }` — читалку не индексируем, но вес по ссылкам со страницы передаём (было `follow: false`)
- В `formatLabels` добавлен `digital`

**301-редирект в `proxy.ts`**: `/reader/[editionId]` → `/vvvvv/[editionId]` — старые прямые ссылки и закладки не ломаются. Добавлен матчер `/reader/:path*`.

**`/vvvvv/[slug]` открывается и по UUID, и по слагу издания.** Новая функция `fetchEditionByIdOrSlug()` в `lib/server/editions.ts` ветвится по форме строки: UUID-регексп → `fetchEditionById`, иначе → `fetchEditionBySlug`. Без проверки формата Postgres бросал бы `invalid input syntax for type uuid`, то есть слаг в URL давал 500 вместо 404. Канонический адрес в метаданных — по слагу (фолбэк на id, если слаг пуст).

**Убран водопад запросов на странице читалки.** Было ~9 последовательных round-trip к Neon на холодный заход, стало ~5:
- `loadEdition` / `loadRelease` / `loadChapters` обёрнуты в React `cache()` — `generateMetadata` и сам рендер больше не дублируют одни и те же два запроса (`dbQuery` своей дедупликации не имеет);
- релиз, главы и `getCurrentUser()` уходят одним `Promise.all` — они друг от друга не зависят;
- роли и прогресс чтения — вторым `Promise.all`.

Порядок проверок сохранён: сначала `notFound()` по релизу, затем по пустым главам, затем диспетчеризация по формату.

### Файлы
- `app/reader/[editionId]/page.tsx` — удалён
- `app/vvvvv/[slug]/page.tsx` — SEO-метаданные, `digital` в `formatLabels`, резолв по id/слагу, `cache()` + `Promise.all`
- `lib/server/editions.ts` — `fetchEditionByIdOrSlug()`
- `proxy.ts` — редирект `/reader/*` + матчер
- `docs/HIGHLIGHT.md` — маршрут постраничной читалки обновлён на `/vvvvv/[editionId]`

### Как использовать
1. Читалка-разворот живёт по `/vvvvv/<слаг или UUID издания>`; ссылка из UI — в `components/release-edition-toc.tsx:157`.
2. Старые ссылки `/reader/<UUID>` отдают 301 на новый адрес.
3. Диспетчеризация по формату: `comic` → `ReleaseComicReader`, `audiobook`/`audiorelease`/`album` → `ReleaseAudioPlayer`, `book`/`magazine` → `SpreadReader`, остальное → 404.

---

## [9 августа 2026] Редизайн страницы релиза + цифровые издания

### Что изменено

**Страница релиза (`/release/[slug]`):**
- Типографика: заголовок Cormorant `text-6xl→8xl`, аннотация EB Garamond `text-xl→2xl` всегда видна
- Новые секции: персонажи (horizontal scroll), серия (card-стиль), цитаты (grid 2 колонки)
- Кнопки изданий показывают название площадки для digital (например "Litres" вместо "Цифровой релиз")
- Digital-издания открываются в новой вкладке

**Цифровой релиз (новый формат издания):**
- Добавлен формат `digital` для книг на внешних площадках (Litres, Amazon, Bookmate)
- Миграция: `postgres/014_add_digital_format.sql`
- В Studio: платформа и ссылка скрыты для book, показаны для digital
- Digital-издания не содержат глав — только ссылка на площадку

**Slug изданий через `@adiom/hash`:**
- Slug генерируется автоматически при создании издания (12-символьный хеш)
- Slug immutable — больше не меняется после создания
- Убрано поле slug из формы настройки издания

**Studio: реработка `release-design-form.tsx`:**
- Все стили переведены на cf-* токены (был violet/glassmorphism)
- Превью, чекбоксы, кнопки — в стиле canfly design system

### Файлы
- `components/release-page.tsx` — полный редизайн
- `app/release/[slug]/page.tsx` — передача characters + otherSeriesReleases
- `lib/releases-types.ts` — добавлен `'digital'` в EditionFormat
- `lib/slug-utils.ts` — `generateEditionSlug()` через @adiom/hash
- `lib/server/editions.ts` — slug генерируется автоматически, immutable
- `components/studio/edition-format-selector.tsx` — цифровой релиз
- `components/studio/edition-page-client.tsx` — digital без глав
- `components/studio/release-design-form.tsx` — cf-* токены

### Как использовать
1. Применить миграцию `014_add_digital_format.sql`
2. Создать digital-издание: ввести площадку (Litres, Amazon) и ссылку
3. На странице релиза кнопка покажет название площадки и откроет в новой вкладке

---

## [9 августа 2026] VVVVV: лендинг литературной среды на `/vvvvv`

### Что изменено

У экспериментального ридера появилось лицо. Раньше существовал только `app/vvvvv/[slug]/page.tsx` (A/B-ридер `SpreadReader`), а корневой `/vvvvv` отдавал 404.

- **`app/vvvvv/page.tsx`** (новый Server Component) — статический лендинг без обращений к БД, индексируемый (в отличие от `[slug]`, где стоит `robots: { index: false }`). Секции: тонкий хедер VVVVV с возвратом на `canfly` → герой на ~78vh почти пустого экрана → «что произошло» → «присутствие» → словарь позиционирования → живой разворот → `SiteFooter variant="simple"`.
- **`components/vvvvv/vvvvv-spread-demo.tsx`** (новый Client Component) — настоящий книжный разворот с листаемым фрагментом. Переиспользует существующий хук `useSpreadPagination` из `lib/reader/use-spread-pagination.ts` без изменений в нём: хук не завязан на БД и уже отдаёт `isSpread: false` под 900px и в портретной ориентации, поэтому мобильный однополосный режим достался бесплатно.
- **`app/globals.css`** — блок `.vvvvv-scope` с собственными токенами `--vv-*`, намеренно не завязанными на `.dark`: страница остаётся в темноте void при любой выбранной теме. Плюс `::selection` в охре, keyframe `vv-rise`, стили `.vv-page-button` и `.vv-spread-track`, всё под `prefers-reduced-motion: reduce`.

Два неочевидных решения в демо, оба продиктованы контрактом хука:

- **Номер страницы свой, геометрия — хука.** `setCurrentPage` внутри `useSpreadPagination` округляет разворот вниз до чётной страницы, из-за чего при нечётном общем числе страниц последняя недостижима. В ридере это некритично, на лендинге отрезало бы хвост фрагмента — поэтому компонент держит собственный `page` и берёт у хука только `pageWidth` / `gutter` / `spreadWidth` / `pageCount` / `isSpread`.
- **Горизонтальных полей внутри трека нет.** Хук считает шаг листания как `pageWidth + gutter`, любой горизонтальный `padding` на треке рассинхронизировал бы колонки со страницами. Поля книги вынесены на внешнюю обёртку, внутри трека остались только вертикальные.

Листы-прямоугольники под текстом не рисуются: при разнице `#161714` против `#111210` они почти не читались, а геометрию усложняли. Из структурных меток остался один корешок.

### Зачем

Задача была не продать функции читалки, а объявить бренд внутри экосистемы canfly: VVVVV — не reader, а литературная среда, альтернатива культуре бесконечной ленты. Отсюда отказ от лексики «ebook reader / reading app / viewer», щедрые поля как аргумент против ленты и финал не кнопкой, а самой средой — посетитель трогает разворот, а не читает о нём.

Собственная палитра вместо `cf-*` — сознательное отступление от `docs/design-system.md`, согласованное с автором: VVVVV подан как самостоятельный бренд. Правило «hex только в `globals.css`» при этом соблюдено — токены живут в scoped-блоке, а не в компонентах.

### Как использовать

1. Открыть `/vvvvv`.
2. Разворот листается кнопками, а также стрелками ← → — но только когда он в фокусе (Tab), иначе страница теряла бы обычную прокрутку.
3. Ниже 900px или в портретной ориентации — одна страница вместо разворота.
4. Текст фрагмента лежит в экспортируемой константе `DEMO_EXCERPT` наверху компонента и меняется без правки логики.
5. Страница не добавлена в `NAV_ITEMS` (`lib/nav.ts`) намеренно — вход только по прямой ссылке.

---

## [8 августа 2026] Spread-reader: переносы, книжный абзац, EPUB3-спред, дискретное листание

### Что изменено

Точечные визуальные и UX-правки `components/spread-reader.tsx` и `lib/reader/use-spread-pagination.ts` поверх компоновки «книжный разворот без теней». Структура компонента, пропсы и публичное API хука не менялись.

- **Переносы слов по слогам.** `.book-columns` и контейнер контента получили `hyphens: 'auto'` (+ префиксы `-webkit-/-moz-/-ms-`); на контентный `div` дополнительно проставлен `lang="ru"`, потому что `dangerouslySetInnerHTML` не наследует язык от `<html>` гарантированно. Реки пробелов в `text-align: justify` убраны.
- **Книжный абзац.** На контентный контейнер добавлен класс `cf-reader-content`, плюс глобальный `<style>`: `.cf-reader-content p { margin: 0; text-indent: 1.5em }` и `:first-child { text-indent: 0 }`. Первый абзац главы идёт без отступа, остальные — с красной строкой.
- **EPUB3-семантика спреда.** В `useSpreadPagination.measure()` добавлена проверка `window.matchMedia('(orientation: portrait)').matches`. Спред теперь включается только в альбомной ориентации И при ширине viewport ≥ 900px (`!isPortrait && vpW >= SPREAD_BREAKPOINT`). На мобильном в портретной ориентации — всегда одна страница, как требует EPUB3 `rendition:spread`. ResizeObserver уже пересчитывает при повороте, отдельный `orientationchange`-listener не понадобился.
- **Дискретное листание вместо нативного скролла.** `.book-columns` больше не имеет `overflowX: 'auto'` и `scrollSnapType: 'x mandatory'`; страницы переключаются мгновенно через `transform: translateX(-currentPage * colStep)`. `colStep = pagination.pageWidth + pagination.gutter` взят из самого хука, чтобы шаг был идентичен `pageCount`-расчёту и не давал дрифта при многократном листании. Анимация `transition` на transform убрана: переход между страницами без slide/fade, как у бумажной книги.
- **Clamp на последней странице.** `pageCount` в хуке считается через `Math.round`, что на коротких главах может давать полоску соседней колонки через `overflow: hidden`. Добавлен `maxTranslate = max(0, track.scrollWidth - viewport.clientWidth)`, пересчитываемый по двойному `requestAnimationFrame` после remeasure. На последней странице (`currentPage >= maxPage`) формула clamp'ится по `maxTranslate`; промежуточные страницы остаются без clamp, чтобы не терять шаги при округлении `pageCount` вниз.
- **Клик-зоны листания в полях страницы.** Две `button`-зоны «Предыдущая страница» / «Следующая страница» перенесены из `<main>` наружу — сразу после `</div>` `.reader-container`, в общий `<div className="fixed inset-0">`. Ширина полос — `sideGutter = max(28, padding 40px + (viewportW − 1200) / 2)`, то есть от внешнего края экрана до границы 1200px-контейнера с книгой. На широких экранах это `(vw − 1200) / 2 + 40px`, на узких — минимум 28px под палец. Текстовый блок больше не перекрыт, выделение цитаты работает штатно без конфликтов.
- **Дубль «Глава N» убран.** Eyebrow над `h1` показывает только жанр для первой главы (`currentIndex === 0 && release.genre`), иначе — пустая строка. Номер главы остался только в footer. Если в `chapter.title` из БД приходит префикс «Глава 4.» — это данные, не код.
- **Группировка toolbar.** Кнопки `A−`/`A+` убраны из `<header>`. Управление размером вошло в панель «Шрифт и размер», открываемую по иконке `Type`: сверху секция «Размер» с `A−` / числовым индикатором / `A+`, разделитель, ниже — список шрифтов. `title` кнопки `Type` обновлён на `Шрифт и размер: <label> · <px>`.
- **Тень корешка убрана.** Блок `cf-spine-shadow` (градиент `pageInner → spineLine → pageInner` поверх корешка) удалён — пользователь предпочёл чистый стык колонок. Токены `spineLine`/`pageInner`/`pageOuter` в `THEMES` оставлены на случай будущего включения, как и `spineCenter`/`gutter` в хуке — `pageOfElement` ими всё ещё пользуется.

### Зачем

Пользователь жаловался на «киношные» пережитки (тени/градиенты, drag-scroll вместо листания), дрифт страницы после нескольких переходов и на конфликт листалок с выделением текста. Заодно привёл компоновку к более «бумажному» виду: книжный абзац с красной строкой, переносы по слогам, спред только в альбомной ориентации по стандарту EPUB3.

### Как использовать

1. Перейти на `/reader/[id]` или `/vvvvv/[id]` для любого published-издания с форматом `book` или `magazine`.
2. На мобильном в портретной ориентации — одна страница, листание по клику в полях (или свайпом, или стрелками клавиатуры).
3. В альбомной ориентации (≥ 900px ширины viewport) — двухстраничный разворот.
4. `pnpm lint` и `pnpm build` — без новых ошибок.

---

## [8 августа 2026] Spread-reader: книжный разворот, темы из canfly-colors, выбор шрифта

### Что изменено

`components/spread-reader.tsx` переведён на новую компоновку по типу реальной книги и расширен пользовательскими настройками без CSS-теней и градиентов.

- **Книжная зона**: убраны тени разворота, корешок с радиальным градиентом, боковые page-shadows и плавающие стрелки листания. Вместо этого — простой grid-каркас `header / .book-viewport / footer` с `column-count: 2` и `column-gap: 60px` для альбомного режима (1 колонка на портретной ориентации через media-query). Контент «перетекает» между страницами естественно, без transform-track.
- **Темы**: три листа из палитры `lib/canfly-colors.ts` — `Void` (CF-004 «before the first photon»), `Manuscript` (CF-003 «burned papyrus») и `Sepia` (локальный hardcode — в canfly-палитре нет сепии, помечен комментарием). Старые ключи `dark/light/sepia` мигрируют в новые id автоматически при первом запуске.
- **Шрифты**: пять пресетов в поповере тулбара с образцами текста в каждом шрифте — `Cormorant Garamond`, `EB Garamond`, `Geist Sans`, `Geist Mono`, `Atkinson Hyperlegible`. Выбор сохраняется в `canfly-reader-font`. EB Garamond и Atkinson Hyperlegible добавлены через `next/font/google` с `preload: false, display: 'swap'` и проброшены в `@theme inline` (`app/globals.css`).
- **Hydration mismatch исправлен**: компонент использует `mounted`-флаг (см. `components/theme-toggle.tsx:9-14` — тот же паттерн в проекте) и до монтирования на клиенте возвращает минимальный каркас, идентичный серверному. Только после mount подтягиваются реальные значения из `localStorage`.
- **Новый хук `lib/reader/use-spread-pagination.ts`**: симметрия 50/50 (как решено), ограничение `pageW ≤ 720px` на очень широких экранах, расширенная геометрия (`spreadWidth`, `spineCenter`). `useColumnPagination` не трогали — другие читалки (`release-book-reader`) продолжают им пользоваться.
- **Управление в `header`**: вместо правого вертикального тулбара — компактные кнопки в шапке (назад, `A−`/`A+`, оглавление, закладки, шрифт, тема). Поповеры открываются под кнопкой, без `backdrop-filter`, без `box-shadow`.

### Зачем

Пользователь жаловался на «киношный» визуал читалки (тени, градиенты) и на отсутствие возможности настроить шрифт/тему. Хотел простую книжную разметку с реальными полями у страницы (по шаблону с `column-count: 2`). Заодно привязал темы к существующей палитре canfly-colors вместо локального хардкода.

### Как использовать

1. В читалке (`/reader/[id]`, `/vvvvv/[id]`) кнопки `A−/A+` регулируют размер, иконка `Type` открывает выбор шрифта, иконка `☾/☼/🎨` — выбор темы. Выбор сохраняется в localStorage и применяется при следующем заходе.
2. Никаких изменений API, схемы БД, миграций и тестов не требуется.
3. `pnpm lint` и `pnpm build` — без ошибок.

---

## [8 августа 2026] Cleanup: удаление устаревших seed-скриптов и схемы в `scripts/`

### Что изменено

Удалены ранние SQL-скрипты из `scripts/`, которые дублировали актуальную схему из `postgres/` и содержали вымышленные тестовые данные. Схема БД теперь правится строго миграциями в `postgres/` (см. AGENTS.md: «Схема БД правится только миграцией в postgres/»).

Жёстко удалены (без применения в коде):
- `scripts/001_create_tables.sql` — дубль `postgres/schema.sql` (books, characters, orders, homepage_slides, admins + триггеры/индексы).
- `scripts/002_seed_data.sql` — вымышленный seed: книги «Крылья Судьбы» / «Тени Небес» / «Падение Ангелов» / «Голоса Бездны» / «Артбук: Мир Canfly» и персонажи `kira-volkova` / `dmitry-cherny` / `liza-svetlova` / `arseniy-gromov` / `mira`. Ни один slug из seed не встречается в кодовой базе.
- `scripts/003_homepage_slides.sql` — дубль DDL `homepage_slides` из `schema.sql` + `INSERT` тех же 4 слайдов (они уже в БД и в `data/homepage-slides.json`).
- `scripts/004_import_homepage_slides_from_local.sql` — одноразовый импорт из JSON; слайды управляются через админку и fallback в `lib/homepage-slide-store.ts`.
- `scripts/005_social_roles_characters.sql` — дубль `users` / `user_roles` / `character_friendships` / `character_conversations` / `character_messages` / `character_user_memories` и ALTER `characters`/`book_characters` из `schema.sql`.
- `scripts/006_advanced_reader.sql` — устаревшее: `highlights`, `chapter_ratings`, `book_reviews`. `chapter_ratings` и `book_reviews` сознательно удалены `postgres/highlights-migration.sql:55-56` (`DROP TABLE`), а активная сущность — `chapter_highlights`.

Перенесена в миграцию (а файл удалён):
- `scripts/007_character_social.sql` → **`postgres/016_character_wall.sql`**. Содержимое было активно: таблица `character_wall_posts` (`lib/server/character-wall.ts`) и колонки `character_posts.scheduled_at` / `author_user_id` (≈53 упоминаний в `lib/server/character-posts.ts`, `lib/actions/studio-characters.ts`, `app/api/characters/posts/route.ts`, UI). Раньше эти объекты создавались **только** скриптом вне цепочки миграций — чистая БД, развёрнутая только по `postgres/`, ломала стену и отложенные посты. Миграция идемпотентна (`IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`), как остальные в `postgres/`.

### Зачем

В репозитории сосуществствовали две ветки схемы: `postgres/` (актуальные миграции, применяемые в прод/CI) и `scripts/00x*.sql` (их ранние клоны + вымышленные данные). Скрипты в `scripts/` ни разу не вызываются из `package.json`, `docs/` или e2e — они просто лежали и вводили в заблуждение: кто-то мог бы применить `002_seed_data.sql`, создав вымышленные «Крылья Судьбы» в `books`, либо, не зная про `007`, не создал `character_wall_posts` при раскатке новой БД.

### Как использовать

1. Перед деплоем применить новую миграцию: `psql $DATABASE_URL -f postgres/016_character_wall.sql` (или через ваш деплой-пайплайн миграций). Она безопасна на уже применённой БД (CREATE TABLE IF NOT EXISTS / ADD COLUMN IF NOT EXISTS).
2. Старые скрипты больше не нужны — удалить локально, если кто-то их применял вручную.
3. `pnpm build` и `pnpm lint` — без новых ошибок (3 pre-existing warnings в `app/series/[slug]/page.tsx` и `components/release-page.tsx`, не связанные с этим рефакторингом).

### Примечание

В `docs/UPDATES.md` в истории (строки ~1129/1142) сохранились ссылки на `scripts/005_social_roles_characters.sql` — это архив прошлых записей и не менялся, чтобы не нарушать workflow `pnpm sync:tasks`.

---

## [8 августа 2026] Профиль читателя: `/user`, `/user-settings`, `/user/[handle]`

### Что изменено
Три новых маршрута рядом со старым `/profile` — старые страницы не трогаем.
- `/user` — приватный дашборд. Полоса-паспорт, разрез чтения на 52 недели (керн), полка «читает» с реальным прогрессом, публичные цитаты, голоса.
- `/user-settings` — личность, аватар, handle, цветовой паспорт (15 цветов каталога), видимость, доступ (email + OAuth через существующий `AccountSettingsClient`). Живое превью справа показывает то, что увидит публика.
- `/user/[handle]` — публичная страница читателя. `notFound()` для неавторизованных зрителей при `profile_is_public = false`. Владелец видит баннер «так тебя видят другие».

### Концепция
Профиль как запись в каталоге canfly: цветовой паспорт из `CANFLY_COLORS`, керн как осадочный разрез чтения, человек — как совокупность вынесенного на свет. Имя в Cormorant light italic, без `font-black uppercase` — профиль это не рубрика. Полоса паспорта — тот же приём, что в `app/login/sky-panel.tsx`, но кадр фиксированный.

### Как пользоваться
- Зайти magic-link'ом, открыть `/user-settings`, выбрать цвет, загрузить аватар, написать одну строку `tagline`.
- Сменить handle — публичный URL изменится, кулдаун 14 дней.
- `/user/<handle>` работает анонимно; выключить видимость — страница отдаёт 404.

### Зачем
Раньше профиль читал только friends/highlights, читатель не мог менять имя/handle/аватар, прогресс чтения нигде не возвращался. Теперь `/user` — это личный зал, а `/user/[handle]` — визитная карточка читателя, как каталог цветов.

### Что под капотом
- `postgres/015_user_profile.sql`: `tagline`, `signature_color`, `profile_is_public`, `show_reading`, `handle_changed_at` + `UNIQUE INDEX (LOWER(handle))` (закрывает `@Adiom`/`@adiom`).
- `lib/server/user-profile.ts`: `fetchShelf`, `fetchCoreWeeks`, `fetchPublicQuotes`, `fetchUserByHandle`, `isHandleAvailable`, `fetchUserProfileById`. `chapter_number` через `ROW_NUMBER` по опубликованным — маршруты ридера адресуют главу позицией, не `chapters.chapter_index`.
- `lib/user-signature.ts`: паспортный цвет (`signature_color` → иначе дефолт из `users.id`), `isDarkHex` для выбора читаемой краски текста на полосе.
- `lib/actions/user-profile.ts`: `updateIdentity`, `changeHandle`, `updateSignatureColor`, `updateVisibility`, `updateAvatar`. Гонка при смене handle ловится по `23505`; `users.email`-логика не задета.
- `app/api/user/avatar/route.ts`: 10/час на пользователя, проверка сигнатуры байтов в `handleImageUpload`.
- `proxy.ts`: гварды `/user` и `/user-settings` по тому же JWT-блоку, что у `/profile`; публичный `/user/[handle]` в матчер не попадает.
- `lib/server/session.ts`: `SessionUser` расширен `tagline`, `signature_color`, `profile_is_public`, `show_reading`, `created_at` — лишний запрос на каждой странице больше не нужен.

### Ограничения
- OG-картинка `/user/[handle]/opengraph-image` — следующая задача; сейчас в `generateMetadata` только title/description и canonical.

---
### Что изменено

**Страница перешла на токены `cf-*`.** До этого `/login` была размечена хардкодом `#111210` / `#1b1c19` / `#f4efe5` и потому оставалась тёмной всегда: читатель со светлой темой на всём сайте попадал на чёрный экран. Теперь фон, текст и акцент берутся из `app/globals.css`, страница следует теме.

**Вёрстка — сплит 50/50 на `lg+`.** Слева форма прямо на фоне, без карточки и рамки: вордмарк `canfly` сверху, заголовок «Место, на котором вы *остановились*» (Cormorant, курсив в `cf-accent`), поля на нижней линейке вместо `<Input>` shadcn, волосяная сетка OAuth-провайдеров 2×N вместо четырёх полноширинных кнопок, нижняя строка «← на главную · коллекция цветов». Ниже `lg` панель схлопывается в полосу 26vh над формой.

**Правая панель — `app/login/sky-panel.tsx` (новый).** Залита одним цветом из коллекции, раз в 8 с перетекает в следующий (кроссфейд 1.2 с), в углу архивный штамп `CF-009 · deepsleep` / «небо перед сном» / `21:30 местного времени` — ссылка на `/colors`. Последовательность не случайная: это сутки одного неба, `CF-010 → CF-002 → CF-012 → CF-011 → CF-001 → CF-009 → CF-015 → CF-007` (полдень → закат → ночь → предрассветный час). Стартовый кадр считает сервер по текущему часу и передаёт пропом — клиент, взявший час сам, разошёлся бы при гидрации. При `prefers-reduced-motion: reduce` цикл не запускается.

**Коллекция цветов переехала в `lib/canfly-colors.ts`.** Её теперь читает не только `/colors`, а импорт `app/colors/**` → `app/login/**` был бы путаным кросс-роутовым. `app/colors/data.ts` остался реэкспортом, три его текущих импорта не менялись. Там же живут `SKY_COLORS` и `skyIndexForHour()`.

**`lib/login-ui.ts` (новый)** — общие константы полей и кнопок логина (`LOGIN_FIELD`, `LOGIN_PRIMARY`, `LOGIN_GHOST`, `LOGIN_NOTE`, …). В `lib/`, а не в `app/login/`, потому что их использует ещё и `components/magic-link-form.tsx`.

**`e2e/setup/login-helper.ts`** — хелпер выцеплял dev-код по хардкодному hex-классу, который редизайн удалил. Код теперь помечен `data-testid="magic-code"`, локатор — `page.getByTestId('magic-code')`.

Логика авторизации не тронута: `signIn`/`signOut`/`safeInternalPath`/`errorMessages`, гварды и комментарии о прошлых уязвимостях переехали дословно.

### Зачем

Прошлый проход (issue #22) сознательно отложил перевод `/login` на токены — этот его закрывает. Заодно страница перестала выглядеть как логин любого SaaS: единственный насыщенный цвет приходит из данных, а не из CSS, и порядок кадров несёт время суток — иначе это была бы просто карусель swatch'ей.

### Как использовать

Ничего настраивать не нужно. Проверить руками: светлая тема → `/login` кремовая, тёмная → `void`; панель меняет цвет через ~8 с плавно, при «уменьшить движение» стоит; на 375px полоса неба сверху и форма не обрезана; Tab проходит email → кнопка → провайдеры → штамп → нижние ссылки с видимым фокусом; `/colors` открывается как раньше.

---

## [8 августа 2026] Canfly Colors — 7 новых цветов + копирование hex

### Что изменено

**Палитра расширена с 8 до 15 цветов.** Добавлены:

- Синяя группа: `deepsleep` (#2F4F72) — небо перед сном в детстве, `macroscope` (#54A1D7) — чистое небо как взгляд в космос.
- Звуковая серия: `Au The` (#66D2F4) — "Аум", `Aye` (#63C0D9) — "да", `Am:ui` (#75F1D9) — "я — это ты видишь".
- `Ailice` (#732096) — фиолетовая футболка, которую помнят дольше вещи.
- `Sleedy` (#0A2359) — 3 часа ночи на пустом шоссе.

**Клик по hex копирует его в буфер обмена.** Компонент `CopyHex` в `colors-parts.tsx`: при клике текст временно меняется на «скопировано» (1.5 сек). Работает в карточках и модалке.

---

## [8 августа 2026] Выход из аккаунта + закрытие дыр в авторизации (issue #22)

### Что изменено

**Выход из аккаунта появился вообще.** До этого `signOut` жил в трёх местах, и все три недоступны обычному читателю: `app/admin/page.tsx`, `app/admin/slider/page.tsx` (роль `admin`) и `app/studio-access-denied/page.tsx`. В `components/site-header.tsx` авторизационного UI не было ни в каком виде, а `proxy.ts` жёстко уносил авторизованного с `/login` на `/`. Войдя один раз, читатель не мог ни выйти, ни сменить аккаунт — только руками чистить cookies.

- **`components/header-auth.tsx`** (новый) — «Войти» для анонима, меню профиля для авторизованного: Профиль, Настройки, Studio (по ролям из JWT), Выйти. Клиентский на `useSession` намеренно: `SiteHeader` рендерится в том числе на главной с `revalidate = 60`, и серверный `auth()` утянул бы её в динамику, сломав ISR.
- **`components/site-header.tsx`**, **`components/mobile-nav.tsx`** — подключение; на мобильном те же пункты после разделителя.
- **`app/login/page.tsx`** — стала серверным компонентом: читает сессию через `getCurrentUser()` и ветвится. Форма вынесена в **`app/login/login-form.tsx`**, интерстишл — в **`app/login/already-signed-in.tsx`** («Продолжить как X» / «Войти в другой аккаунт»).
- **`proxy.ts`** — удалён редирект `/login` → `/` и `'/login'` из `config.matcher`.

**Два открытых редиректа.**

- **`lib/safe-redirect.ts`** (новый) — `safeInternalPath()`: пропускает только внутренние пути, режет абсолютные, протокол-относительные (`//example.com`) и `/\example.com`. Применён в `magic-link-form.tsx`, `login-form.tsx`, `already-signed-in.tsx`, `header-auth.tsx`, `mobile-nav.tsx`.
- **`app/(auth)/auth.config.ts`**, callback `redirect` — сравнение origin вместо `url.startsWith(baseUrl)`. Старая проверка пропускала `https://canfly.org.example.com` и одновременно схлопывала относительный `/profile` в `baseUrl`, из-за чего `?redirect=` после OAuth-входа терялся.

**`cf_oauth_link` не чистилась** (`components/account-settings-client.tsx`): ставилась на 600 с и гасла только по истечении, а пока жила — вход тем же провайдером уходил в ветку линковки и падал с `link_error=session`. То есть после привязки Google вход через Google ломался на 10 минут. Cookie снимается сразу по возвращении с провайдера, срок уменьшен до 300 с, `?link_error=` наконец читается и показывается тостом.

**Issue #22.**

- PII из логов убрана: `console.log` в `auth.config.ts` удалены, в `console.warn`/`console.error` остались причина и `provider` — без `email`, `user`, `profile`.
- Ветка обычного OAuth-входа переписана: основной ключ поиска — `provider_account_id`, а не email. Связь есть → это и есть пользователь, email не участвует. Связи нет → ищем по email: пользователя нет → создаём аккаунт и связь; пользователь есть → сливаем только при `profile.email_verified === true`, иначе `/login?error=link_required`. GitHub и Yandex подтверждение не присылают (`providers/github.js` игнорирует `verified` у primary-email, `providers/yandex.js` отдаёт `default_email` без признака), так что до этого вход по чужому непроверенному адресу отдавал чужой аккаунт целиком.
- `findOrCreateUserByEmail` разделена на `findUserByEmail` + `createUserWithReaderRole`, вставка связи вынесена в `linkOAuthAccount`.
- Послабление `AUTH_TRUSTED_EMAIL_PROVIDERS` (список через запятую) в `.env.example` — вернуть слияние по email для конкретных провайдеров.

### Зачем

Отправная точка — issue #22 и предложение «делать logout, если авторизованный заходит на `/login`». Автологаут по GET отвергнут осознанно: `signOut` в next-auth — это POST с CSRF-токеном именно потому, что смена состояния по GET небезопасна; любой `<Link href="/login">` с prefetch или сторонний `<img src="/login">` молча выкидывал бы пользователя из аккаунта. Вместо этого интерстишл с явной кнопкой. При разборе выяснилось, что за предложением стоит более крупная поломка — выхода из аккаунта в проекте не было вовсе; попутно нашлись оба редиректа и незакрывающаяся cookie, которых нет ни в issues, ни в `docs/BUGS.md`.

### Как использовать

Ничего настраивать не нужно — выход появился в шапке и в мобильном меню. Опционально: `AUTH_TRUSTED_EMAIL_PROVIDERS=github,yandex` в `.env.local`, если для инстанса приемлемо сливать аккаунты по неподтверждённому email.

Ручная проверка: `/login` под сессией показывает интерстишл; «Войти в другой аккаунт» гасит сессию и возвращает форму; `/login?redirect=https://canfly.org.example.com` после входа оставляет на `/profile`; после привязки провайдера в `/profile/settings` cookie `cf_oauth_link` в DevTools отсутствует и вход этим же провайдером работает сразу.

Не вошло сюда (отдельные issue): протухание ролей в JWT — `session.maxAge` не задан, снятая роль живёт в токене до перелогина; вторичные адреса из `user_emails` не участвуют в поиске при OAuth-входе; перевод `/login` с хардкодных hex на токены `cf-*`.

---

## [8 августа 2026] Аудит кода: 23 новых issue (#18–#40)

### Что изменено

- **`docs/BUGS.md`**, **`docs/TASKS.md`** — пересинхронизированы `pnpm sync:tasks` после заведения issue. Багов стало 24.

Код не менялся — это результат аудита, оформленный в трекер.

### Зачем

Прошёл авторизацию, API-роуты, репозитории `lib/server/*`, server actions, zod-схемы, SEO-слой и хуки ридера в поиске дефектов, которых ещё нет в трекере. Найдено 23; каждый заведён отдельным issue с разбором и планом починки.

Пять инвариантов из AGENTS.md оказались нарушены в коде — на этих разрывах и сидят самые серьёзные находки:

| Инвариант | Где нарушен | Issue |
|---|---|---|
| все роуты через `apiHandler` | `releases/download/markdown`, `cron/cleanup` | #23, #38 |
| все загрузки через `image-upload.ts` | `lib/actions/studio-characters.ts` | #20 |
| санитизация на сервере перед записью | `lib/server/news.ts` | #32 |
| нет `console.log` в проде | `app/(auth)/auth.config.ts`, `/api/feedback` | #22, #35 |
| каждая мутация — zod | `/api/reading-progress`, `/api/characters/chat` | #26, #28 |

### Как использовать

Порядок работ — по меткам приоритета:

1. **`priority-high` + `security`** (#18–#22): XSS через JSON-LD, отключённая проверка TLS-сертификата БД, загрузка картинок мимо валидации, неотправляемый код подтверждения email, PII в логах + линковка OAuth по непроверенному email.
2. **`priority-medium`** (#23–#26, #28, #29, #31–#35): класс «500 вместо 4xx» на невалидном вводе, затем целостность данных — сброс `is_primary`, роли без транзакции, санитизация новостей и версий глав, рейт-лимит стены, хранение фидбека.
3. **`priority-low`** (#27, #30, #36–#40) — уборочным коммитом.

Тела issue детальные: где именно, чем воспроизвести, что делать (с кодом) и как проверить. `docs/BUGS.md` вручную не править — он генерируется `pnpm sync:tasks`.

---

## [8 августа 2026] Обновление Next.js 16.3.0 — фикс ChunkLoadError (issue #4)

### Что изменено

- **Next.js 16.2.7 → 16.3.0**, `eslint-config-next` 16.2.12 → 16.3.0
- В 16.3 Turbopack **по умолчанию** ретраится при неудачной загрузке чанка (vercel/next.js#94918) — прямой фикс issue #4.
- Обновлён `docs/TROUBLESHOOTING.md` — инструкция для ChunkLoadError.

### Зачем

Issue #4 — Turbopack: `ChunkLoadError` при быстром HMR в dev-режиме. Фикс вошёл в Turbopack 16.3, отдельный конфиг не нужен.

### Примечание по переустановке

Из-за смены pnpm store приходилось переустанавливать зависимости: `node_modules` удалён, `pnpm config set store-dir /Users/adiom/.pnpm --global`, нужен `pnpm install` + `pnpm add next@latest`.

---

## [8 августа 2026] priority для LCP-изображений (issue #15)

### Что изменено

- **`components/release-comic-reader.tsx`** — `priority={index === 0}` для первой страницы комикса (LCP).
- **`components/highlight-artifact.tsx`** — `priority` для главного артефакта иллюстрации хайлайта.

### Зачем

Issue #15 — замены `<img>` → `<Image>` уже были сделаны и `sizes`/remotePatterns на месте, не хватало `priority` для LCP-элементов. Добавлено.

---

## [8 августа 2026] Страница серий /series/[slug]

### Что изменено

- **`app/series/[slug]/page.tsx`** (новый) — публичный маршрут страницы серии.
- **`components/series-page.tsx`** (новый) — Server Component: hero серии + список релизов с обложками, датами и номерами томов. Ссылка на каждом релизе ведёт на `/release/[slug]`.
- **`lib/server/series.ts`** — добавлена `fetchSeriesWithReleases(slug)`: загрузка серии + опубликованных релизов с `phase_number` и массивом форматов.
- **`lib/actions/studio.ts`** — добавлено `updateReleaseSeriesAction` (присваивает серию релизу) и `getReleaseSeries` (загрузка текущих связей).
- **`components/studio/release-page-client.tsx`** — добавлена вкладка «Серия» с выбором серии из списка + фазы (номер тома).
- **`components/release-page.tsx`** — название серии в жанре релиза теперь кликабильная ссылка на `/series/[slug]`.
- **`components/studio/edition-setup-page.tsx`** — серия убрана из страницы издания (больше не назначается на уровне издания).
- **`lib/actions/studio.ts`** (`updateEditionSetupAction`, `getEditionSetupData`) — параметр `series_links` удалён.
- **`app/sitemap.ts`** — серии добавлены в sitemap.
- **`components/release-page.tsx`** — для админов на странице релиза появилась кнопка «Studio» (ссылка на `/studio/releases/[id]`).

### Зачем

Раньше серия назначалась на уровне **издания**, а не релиза — архитектурная неправильность (издание = формат: book/comic/audio, серия = повествовательная связь между релизами). Теперь:

1. Серия назначается на релиз → одна серия = один набор томов везде.
2. Публичная страница `/series/[slug]` показывает все томы серии в хронологическом порядке.
3. С релиза можно перейти к другим томам той же серии.

### Как использовать

- В Studio (`/studio/releases/[id]`) → вкладка «Серия» → выбрать серию и указать номер тома (фазу).
- Публичная страница: `/series/<slug-серии>` — список всех опубеликованных релизов в серии.
- Пример: https://canfly.org/release/kroy-po-dushe-tom-1 → ссылка на серию в шапке.

---

## [1 августа 2026] Highlights: устойчивый AI-контур

### Что изменено
- AI stream-ручки используют `req.signal`, timeout всей операции 30 секунд и timeout между chunks 8 секунд.
- Stable Diffusion ограничен 45 секундами; ответы валидируются и ограничены 8 МБ.
- Ошибки нормализованы, а клиент отменяет предыдущую генерацию и показывает точную причину сбоя.

### Зачем
Не оставлять зависшие платные запросы и не принимать некорректные ответы внешнего сервиса.

---

## [1 августа 2026] Highlights: устойчивые якоря и состояние ридера

### Что изменено
- DOM resolver строит Range через несколько текстовых узлов и использует сохранённые offsets.
- Обе читалки используют общий resolver; дублированная реализация удалена.
- Загрузка цитат и editorial notes отменяется при смене главы; сетевые ошибки показываются пользователю.
- Лайки используют идемпотентный `PUT` и функциональные обновления состояния.

### Зачем
Сохранить подсветку после изменения HTML-разметки, исключить stale state и зависшие запросы при быстрой навигации.

---

## [1 августа 2026] Highlights: целостность данных и контроль доступа

### Что изменено
- Добавлена миграция `014_highlights_stability.sql`: idempotency key, точные offsets, версия главы и `updated_at`.
- CRUD переведён на Zod, plain-text санитизацию и Postgres rate limit.
- Создание цитат и правок стало идемпотентным; лайки выполняются атомарно и получили идемпотентный `PUT`.
- Исправлены приватные цитаты профиля и проверка принадлежности share-ссылки релизу.
- Editorial notes доступны только владельцу релиза и admin.

### Зачем
Исключить дубликаты после сетевых повторов, рассинхрон лайков, IDOR и утечки/потерю приватных цитат.

### Как использовать
Перед деплоем применить `postgres/014_highlights_stability.sql`. Новые клиенты передают `client_request_id`; старые запросы остаются совместимыми.

---

## [1 августа 2026] Studio/highlights: приведение UI к дизайн-системе

### Что изменено

**1. Семантические токены статусов правок (`app/globals.css`)**
- Добавлены `--cf-status-open` / `--cf-status-resolved` / `--cf-status-ignored` в оба блока тем и их маппинг в `@theme inline`. Цвета подобраны по палитре сайта (контраст к `cf-bg-2` ≥ 4.5:1), а не скопированы из дефолтов Tailwind.
- Добавлен `--cf-accent-hover` вместо хардкода `#b01e1e` в разметке.

**2. Единый источник визуала статусов (`lib/studio/editorial-status.ts` — новый)**
- Карта `EDITORIAL_STATUS` + `editorialStatusStyle()`: подпись, значение для inline `style` и классы карточки/бейджа. Переиспользует существующий тип `EditorialNoteStatus`.
- Раньше тройка `#e97316 / #16a34a / #6b7280` дублировалась хардкодом в трёх местах: `editorial-notes-overlay.tsx`, `editorial-notes-panel.tsx`, `chapter-editor-page.tsx`. Теперь все три берут цвет оттуда.

**3. Вёрстка редактора главы (`components/studio/chapter-editor-page.tsx`)**
- Дефолтные Tailwind-цвета (`violet-*`, `emerald-*`, `amber-*`, `red-*`, `gray-*`, `bg-white/60`, `border-white/70`) заменены на токены `cf-*`. Карточки приведены к `border border-cf-text-1/10 bg-cf-bg-2` из дизайн-системы.
- Подсветка абзаца при переходе к правке теперь строится через `color-mix(in srgb, …)` — hex-суффиксы прозрачности (`${color}33`) с CSS-переменными не работают.

**4. Точечные правки**
- `components/studio/news-editor.tsx` — `hover:bg-[#b01e1e]` → `hover:bg-cf-accent-hover`.
- `components/studio/audio-chapter-editor.tsx` — inline `style={{ color: '#d52525' }}` у активной строки лирики → `text-cf-accent`.

### Зачем

`docs/design-system.md` §13 запрещает хардкод hex вне `app/globals.css` и дефолтные Tailwind-палитры: при переключении темы такие цвета не адаптируются, а `bg-white/60` в светлой теме давал белые карточки поверх кремового фона. Плюс убран тройной дубль карты статусов.

### Как использовать

Для статусов редакторских правок импортировать из `lib/studio/editorial-status.ts`:

```ts
import { EDITORIAL_STATUS, editorialStatusStyle } from '@/lib/studio/editorial-status'

<div className={editorialStatusStyle(note.status).card}>…</div>
<span style={{ backgroundColor: editorialStatusStyle(note.status).color }} />
```

Новые цвета заводить переменной в `app/globals.css` (оба блока тем + `@theme inline`), а не хексом в разметке.

### Известное ограничение

`components/spread-reader.tsx` держит собственные палитры читалки (`THEMES`: dark/light/sepia) хексами — это независимый от темы интерфейса выбор пользователя. Не тронуто; вынос в `--cf-reader-*` — отдельная задача.

---

## [1 августа 2026] Highlights: починка сломанных сценариев (Этап 1)

### Что изменено

**1. Редакторские правки в постраничной читалке (`components/spread-reader.tsx`)**
- Заглушка `onSaveEditorial={async () => {}}` заменена рабочим сохранением. Раньше редактор писал замечание, жал «Отправить», получал успех — и ничего не сохранялось.
- Добавлены загрузка правок главы, разметка `<mark data-cf-en>`, клик по разметке и попап замечания — паритет с `release-book-reader`.

**2. Общий хук `lib/reader/use-editorial-notes.ts` (новый)**
- Загрузка/создание/смена статуса/удаление правок вынесены из читалок в один хук; дедупликация загруженных глав через `useRef<Set<string>>` вместо `eslint-disable` на зависимостях.

**3. Удаление правок (`app/api/chapter-editorial-notes/[id]/route.ts` — новый)**
- `DELETE` с проверкой прав: автор замечания или admin. `deleteEditorialNote()` в `lib/server/chapter-highlights.ts` раньше не проверял ничего и ниоткуда не вызывался.
- Кнопки удаления и «Вернуть в работу» (статус `open`) добавлены в обе читалки и в `components/studio/editorial-notes-panel.tsx` — раньше решённое замечание нельзя было ни переоткрыть, ни удалить.

**4. Автор новой правки (`lib/server/chapter-highlights.ts`)**
- `createEditorialNote` возвращает `author_name` / `author_avatar` через CTE. Раньше свежесозданное замечание показывалось как «Редактор» до перезагрузки страницы.

**5. Управление цитатой (`PATCH /api/chapter-highlights/[id]`)**
- Эндпоинт существовал, но UI его не вызывал. Теперь в `components/bookmarks-panel.tsx` бейдж публичности — кликабельный тумблер, заметку можно править inline, удаление подтверждается.
- Карточка перестроена: строка метаданных вынесена за пределы обёртывающего `<button>` (вложенные кнопки недопустимы).
- В профиле (`app/profile/page.tsx`) статичная надпись «приватная» заменена клиентским островком `components/profile/highlight-visibility-toggle.tsx`.

**6. `paragraph_index` в Studio (`components/studio/editorial-notes-panel.tsx`)**
- Индекс абзаца считался по `document.querySelectorAll(...)` — то есть по всей странице вместе с боковой панелью, и расходился с оверлеем, который обходит `.ProseMirror`. Теперь оба используют общий `lib/studio/paragraphs.ts` (новый) и считают только внутри редактора. Выделение вне редактора игнорируется.

**7. Оверлей правок (`components/studio/editorial-notes-overlay.tsx`)**
- Позиции пересчитываются на `scroll` и на правки текста (`MutationObserver`), а не только на `resize` — раньше метки уезжали от абзацев при наборе.
- Индикаторы стали кнопками: клик открывает соответствующую правку.

**8. Переход к расшаренной цитате (`components/highlight-scroller.tsx`)**
- Одна попытка через 600 мс заменена 3 ретраями по 400 мс, фолбэком на абзац по `paragraph_index` и снятием подсветки через 2 с (раньше рамка оставалась навсегда).

### Зачем
Все восемь пунктов — сценарии, которые пользователь мог начать, но не мог завершить: сохранение не срабатывало, статус не откатывался, публичность не переключалась, метки не совпадали с текстом.

### Как использовать
- В читалке: панель «Пометки» → клик по «публичная/приватная» переключает видимость, карандаш правит заметку.
- В профиле: тот же тумблер под каждой цитатой; ссылка «Поделиться» появляется у публичных.
- В Studio: выделить текст в редакторе → «Добавить правку»; полоска слева от абзаца кликабельна; решённую правку можно вернуть в работу или удалить.

---

## [1 августа 2026] Актуализация AGENTS.md

### Что изменено
Переписан `AGENTS.md` (импортируется в `CLAUDE.md`) под фактическое состояние кода:
- убран устаревший тезис «email не отправляется» — magic link работает через Postmark, погашение токена атомарное (`lib/server/magic-token.ts`);
- добавлен раздел про security-слой хотфикса 29.07.2026: `rate-limit.ts`, `guardHighlightRequest`, `image-upload.ts`, `sanitize-html` вместо DOMPurify, CSP-заголовки, 410 на `/api/orders`;
- описано реальное поведение `proxy.ts` (гвард `/studio`, 301-редиректы `/release` → `/releases/`, legacy-маршруты);
- добавлены `withTransaction` в `lib/db.ts`, ownership-гварды `studio-auth.ts`, миграции 007–013, GitHub/canfly OIDC провайдеры с верными именами env, cron `/api/cron/cleanup`, e2e `auth-security.spec.ts` и команды запуска одного теста;
- вместо перечня файлов — объяснение архитектуры (release → edition → chapter, две системы контента, три слоя авторизации); палитра заменена ссылкой на `docs/design-system.md`.

### Зачем
Документ расходился с кодом: агенты повторяли устаревшие факты и могли обойти защиту, добавленную в хотфиксе.

### Как использовать
Читать `AGENTS.md` перед задачей; версии зависимостей брать из `package.json`, env — из `.env.example`.

---

## [1 августа 2026] Оптимизация dev на 8 GB RAM (macOS)

### Что изменено

**1. Лимит heap для V8 (`package.json`)**
- `dev` скрипт: добавлен `--max-old-space-size=3072`. На 8 GB RAM V8 по умолчанию разгоняет heap до ~1.5 GB, но Turbopack + 60 страниц могут пушить выше, загоняя систему в swap. 3 GB — безопасный лимит, ~4 GB остаётся macOS.

**2. Webpack memory optimizations (`next.config.mjs`)**
- `experimental.webpackMemoryOptimizations: true` — снижает память webpack (подтверждено в `node_modules/next/dist/docs/01-app/02-guides/memory-usage.md`). Незначительно замедляет компиляцию, но на 8 GB RAM это оправдано.

**3. Отключение预加载 всех страниц (`next.config.mjs`)**
- `experimental.preloadEntriesOnStart: false` — Next по умолчанию грузит JS модули всех 60 страниц при старте dev-сервера. Отключение экономит ~200-400 MB памяти. Первые запросы к новым страницам будут медленнее (ленивая загрузка).

**4. `optimizePackageImports` НЕ добавлен**
- `lucide-react`, `date-fns`, `recharts` уже оптимизированы по умолчанию в Next.js 16 (см. `optimizePackageImports.md:21-48`). Добавлять их повторно бессмысленно.

### Зачем
Dev-машина: Mac M1, 8 GB RAM. Без лимитов V8 + Turbopack загоняют систему в swap, load avg 22+ при старте. Цель — стабильный dev без тормозов.

### Как использовать
1. `pnpm dev` — heap лимитирован до 3 GB, webpack потребляет меньше памяти
2. Первая загрузка страницы может быть чуть медленнее (preloadEntriesOnStart=false)
3. Проверить: `sysctl vm.swapusage` → swap used ≈ 0 при работающем dev

---

## [29 июля 2026] Security-хотфикс: обход аутентификации, утечка цитат, XSS

### Что изменено

**1. Обход аутентификации (CRITICAL)**
- `Credentials.authorize` (`app/(auth)/auth.config.ts`) раньше выдавал сессию по голому `email` из тела запроса, без проверки magic-кода — `POST /api/auth/callback/credentials` с любым email давал полноценную сессию, включая admin. Теперь единственный фактор входа — токен: `authorize` вызывает `validateAndConsumeMagicToken`, который атомарно (`UPDATE ... WHERE used=false RETURNING`, без TOCTOU) гасит его и только тогда возвращает пользователя. `findOrCreateUserByEmail` из `authorize` убран — пользователь создаётся только вместе с погашением токена.
- `lib/server/magic-token.ts` — переписан: атомарный CAS, счётчик попыток (`attempts`, лимит 5), отдельный длинный `link_token` (32 байта, `crypto.randomBytes`) для входа по ссылке — 8-значный код теперь используется только при ручном вводе и защищён привязкой к email внутри SQL.
- `app/(auth)/actions.ts` — `validateMagicCode` удалён (проверка теперь только в `authorize`); код генерируется через `crypto.randomInt` вместо `Math.random()`; `magicLink` и `console.log` кода убраны из production-ответа/логов — раньше код утекал в обоих.
- `app/login/page.tsx` — удалён авто-логин по `?magic_email=` (вектор фишинга: ссылка с чужим email логинила под жертвой).
- `app/hi/[token]/*` — токен больше не гасится на GET (страница), а только при явном `signIn` — раньше ссылку «съедал» любой префетчер (антивирус, почтовый клиент, unfurl).
- `lib/actions/account-settings.ts` — код подтверждения email тоже на `crypto.randomInt` + счётчик попыток; `users.email` теперь пишется только после подтверждения кода, а не сразу при добавлении.
- Миграция: `postgres/012_magic_token_hardening.sql`.

**2. Утечка приватных цитат (HIGH)**
- `lib/server/chapter-highlights.ts` — `fetchChapterHighlights` фильтровал видимость только в одной ветке `if/else`; анонимный `GET /api/chapter-highlights?chapterId=` и запрос `?userId=<чужой>` отдавали приватные цитаты и заметки. Фильтр `is_public = true (OR user_id = свой)` теперь безусловный.

**3. Открытые LLM-эндпоинты (HIGH)**
- `app/api/highlights/{explain,meaning,rewrite,illustrate}` были без авторизации, без лимитов — публичный прокси к OpenAI за счёт владельца. Общая защита вынесена в `lib/ai/highlight-actions.ts`: авторизация, zod (1–600 символов), rate limit, явное отделение пользовательского текста от промпта (защита от prompt injection).
- `lib/server/rate-limit.ts` + `postgres/013_rate_limits.sql` — фиксированное окно на Postgres (без внешнего Redis), применено к LLM-ручкам и `POST /api/characters/chat`.

**4. Заказы (HIGH)**
- `POST /api/orders` принимал `item.price` от клиента без авторизации — заказ на любую сумму. `/cart` и `/shop` уже недостижимы (редиректятся в `proxy.ts`), поэтому ручка отключена (410) по образцу `/api/books`.

**5. Загрузка файлов (HIGH)**
- `app/api/{studio,admin}/upload` не проверяли размер и принимали `image/svg+xml` (stored XSS через blob-URL) — `file.type` из multipart полностью задаёт клиент. Общий `lib/server/image-upload.ts`: лимит 10 МБ, проверка по сигнатуре байтов (PNG/JPEG/GIF/WebP/AVIF), SVG запрещён.

**6. XSS на `/news/[id]` + CSP (HIGH)**
- Санитизация вернулась, но на сервере при чтении/записи (`lib/server/chapters.ts`, `lib/server/news.ts`, `lib/server/news-studio.ts`) — `lib/sanitize.ts` переведён с `isomorphic-dompurify` (падал на Vercel из-за jsdom) на `sanitize-html`. Клиентские ридеры (`release-book-reader`, `spread-reader`, `release-full-page`, `release-reader`) больше не тянут санитайзер в бандл.
- `components/markdown-renderer.tsx` — самописный regex-санитайзер обходился через `<svg/onload=...>` и закодированный `javascript:`; заменён на белый список URL-схем.
- `next.config.mjs` — добавлены security-заголовки (CSP, `X-Frame-Options`, HSTS и др.) — раньше отсутствовали полностью.

**7. IDOR в Studio + защита `/admin` (MEDIUM)**
- `lib/actions/studio.ts` — `createEditionAction`, `getRelease/getEditions/getEdition/getChapters/getChapter/getChapterVersions/getEditionSetupData` проверяли только авторизацию, без владения релизом — черновики и мутации по чужому UUID. Добавлены `requireReleaseOwnership`/`requireEditionOwnership`/`requireChapterOwnership`. Мутации серий (`create/update/deleteSeriesAction`) ограничены ролью admin.
- `app/admin/layout.tsx` — добавлена серверная проверка `requireStudioAdminSession()` (раньше защита держалась только на `proxy.ts`); `/admin/login` вынесен в отдельную route-группу `app/(admin-login)/`, чтобы не редиректить сам на себя.
- `lib/api-handler.ts` — в production больше не отдаёт наружу `error.message` (сообщения `pg` с именами таблиц/constraint'ов); `NEXT_REDIRECT`/`NEXT_NOT_FOUND` пробрасываются, а не превращаются в 500.

**8. Битые SQL-плейсхолдеры**
- `lib/server/releases.ts` — `setReleaseCharacters`/`setReleaseSeries` строили `VALUES` без `$` перед номером плейсхолдера, из-за чего запрос падал и привязка персонажей/серий к релизу молча не работала. Исправлено.

### Зачем
Аудит проекта выявил рабочий обход входа в систему (любая сессия, включая admin, одним HTTP-запросом без пароля и кода) и ряд смежных дыр. Полный список находок и обоснование — в плане `peaceful-singing-pie.md`.

### Как использовать
1. Применить миграции: `psql $DATABASE_URL -f postgres/012_magic_token_hardening.sql` и `-f postgres/013_rate_limits.sql`
2. `pnpm install` — добавлены `sanitize-html`, `server-only`, удалён `isomorphic-dompurify`
3. Вход по коду/ссылке работает как раньше для пользователя; изменилась только внутренняя проверка

### Проверка
- `pnpm build` — 0 ошибок типов
- `pnpm lint` — 0 ошибок (только pre-existing warnings)
- `e2e/auth-security.spec.ts` — новый регрессионный тест на обход входа, приватные цитаты, авторизацию LLM-ручек

---

## [3 июля 2026] Новости в Studio + хаб типов контента

### Что изменено

**1. Хаб создания контента `/studio/new`**
- `app/studio/new/page.tsx` — страница выбора типа контента (Релиз / Новость)
- `lib/actions/studio-create.ts` — `createDraftAction`: мгновенный INSERT пустого черновика с UUID → редирект в редактор
- Кнопка «+ НОВЫЙ» в `app/studio/page.tsx` теперь ведёт на `/studio/new` (вместо `/studio/releases/new`)
- Архитектура: любой тип контента создаётся единым путём — выбрать тип → получить UUID → править в Studio

**2. Новости в Studio (полный CRUD)**
- `postgres/011_news_studio.sql` — миграция: `author_user_id`, `status` (draft/published/archived), `cover_image`, `published_at`, `updated_at`. Backfill: `is_active→status`, первый admin-юзер → автор
- `lib/server/news-studio.ts` — studio-fns: `listMyNews`, `fetchNewsForEdit`, `requireNewsOwnership`, `updateNews`, `updateNewsStatus`, `deleteNews`
- `lib/actions/studio-news.ts` — server actions с zod-валидацией и ownership-проверкой
- `lib/schemas/studio-news.ts` — `newsFormSchema`, `newsStatusSchema`
- `app/studio/news/page.tsx` — список новостей (drafts / published / archived секции)
- `app/studio/news/[id]/page.tsx` — детальная страница-редактор
- `components/studio/news-editor.tsx` — клиентский редактор: Tiptap (StarterKit + Link + Image), статический toolbar + BubbleMenu, автосохранение (debounce 1.5с), управление статусом, удаление с подтверждением

**3. Публичные страницы новостей обновлены**
- `app/news/page.tsx` — фильтр `status='published'` (вместо `is_active`), обложки, сортировка по `published_at DESC`
- `app/news/[id]/page.tsx` — обложка (next/Image + priority), Tiptap HTML рендер через `sanitizeChapterHtml`, OG image из cover, дата из `published_at`
- `lib/server/news.ts` — все запросы обновлены под новые колонки
- `lib/server/search.ts` — фильтр `status='published'` в обоих ветках (searchAll + autocomplete)
- `lib/seo/schema.ts` — `generateNewsArticleSchema` поддерживает `cover_image` и `published_at`
- `lib/types.ts` — `NewsPost` расширен новыми полями

**4. Навигация**
- В Studio dashboard добавлена ссылка «Новости» → `/studio/news`

### Зачем
- Новости переносятся из legacy `/admin` в Studio — единое место управления контентом
- Хаб `/studio/new` — первый шаг к унифицированной модели «контентный объект» (как avrora.click): любой объект — UUID + тип + статус + автор, редактируется в Studio
- Tiptap-редактор даёт форматирование (заголовки, списки, цитаты, ссылки, изображения) вместо plain-text

### Как использовать
1. Применить миграцию: `psql $DATABASE_URL -f postgres/011_news_studio.sql`
2. В Studio (`/studio`) нажать «+ НОВЫЙ» → выбрать тип (Релиз / Новость)
3. Для новостей: редактор открывается автоматически после создания черновика
4. Кнопки статуса внизу редактора: Черновик / Опубликовать / Архив
5. Публичная страница: `/news/{uuid}` — видна только для `status='published'`

### Проверка
- `pnpm exec tsc --noEmit` — 0 ошибок
- `pnpm lint` — 0 ошибок (66 pre-existing warnings)

---

## [2 июля 2026] Пагинация + shelf-редизайн /releases (Feature #11)

### Что изменено
- `lib/server/releases.ts` — новая `fetchReleasesPage({ status, format, page, pageSize })` возвращает `{ items, total, page, pageSize, totalPages }`. Фильтр по формату — в SQL через `EXISTS`-подзапрос (`edition_format[]`); COUNT — отдельным запросом. Категория «Аудиокниги» = `audiobook + audiorelease`. Старая `fetchReleasesWithEditions` сохранена для бэкомпат.
- `postgres/010_releases_pagination_indexes.sql` — составные индексы `(status, release_date DESC, created_at DESC)` и `(release_id, format, status)`.
- `components/ui/pagination.tsx` — новый shadcn-style компонент на `cf-*` токенах: Prev/Next + окно номеров с эллипсисом (`1 … 4 [5] 6 … 20`), всё через `<Link>` (progressive enhancement, нет клиентского JS), `aria-current`, touch ≥40px.
- `components/releases-page-bookmate.tsx` — переделан в **Server Component** (убран `'use client'` + `useState`): состояние фильтра/страницы — в URL (`searchParams`). Eyebrow + H1, category pills (активная `bg-cf-accent`), shelf-сетка `items-end` с нижней линией-полкой и градиент-тенью под обложками. Счётчик `N–M из total`.
- `components/release-card-bookmate.tsx` — миграция на `cf-*` токена (был хардкод `#f4f2ef`/`#3456f3`/`#302119`), hover-lift `-translate-y-1` + `ring-cf-warm/45`, chip формата `text-cf-warm`, `sizes` для LCP, `priority` на первых 4.
- `app/releases/page.tsx` — async `searchParams` (Next 16) + валидация category/page (clamp, unknown→all), `generateMetadata` с динамическим canonical `?category=&page=`.

### Зачем
- Раньше грузились ВСЕ опубликованные релизы одним запросом + клиентский `.filter()` — при 50+ тормозило, при 200+ упало бы. Теперь 24 записи за запрос, фильтр в SQL.
- Компонент нарушал `docs/design-system.md` §13 (хардкод hex, нет dark-mode) — мигрирован на `cf-*` с автоадаптацией к теме.
- URL-driven пагинация: SEO-friendly, sharable, работает back/forward без JS.

### Как использовать
1. Применить миграцию: `psql $DATABASE_URL -f postgres/010_releases_pagination_indexes.sql`
2. `/releases` — 24 релиза на страницу; `/releases?category=book&page=2` — фильтр + страница
3. Категории: Всё / Комиксы / Книги / Аудиокниги (вкл. аудиорелизы) / Журналы / Альбомы
4. Светлая/тёмная тема адаптируется автоматически через `cf-*` переменные

### Проверка
- `pnpm exec tsc --noEmit` — 0 ошибок
- `pnpm lint` — 0 ошибок (66 pre-existing warnings)
- Build компилируется (падение static-gen на `/` и `/sitemap.xml` — DB-таймаут, Bug #5, не связано с изменениями)

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
