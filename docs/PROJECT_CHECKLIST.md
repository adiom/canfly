# Canfly - Чек-лист проекта

## ✅ Завершённые компоненты

### 1. База данных (Neon / Postgres)
- [x] Таблица `books` с полями: title, slug, type, description, cover_image, preview_pages, external_links, price, is_featured, display_order
- [x] Таблица `characters` с полями: name, slug, avatar, bio, full_description, abilities, personality_traits, reply_mode
- [x] Таблица `character_relationships` для связи персонажей
- [x] Таблица `book_characters` для связи книг и персонажей
- [x] Таблица `orders` для заказов
- [x] Таблица `users` и `user_roles` для авторизации (next-auth)
- [x] Система релизов: `releases`, `series`, `editions`, `chapters`, `chapter_versions`
- [x] Хайлайты: `chapter_highlights`, `chapter_highlight_likes`, `chapter_editorial_notes`
- [x] Соцсеть персонажей: `character_posts`, `character_wall_posts`, `character_friendships`, `character_conversations`, `character_messages`
- [x] Магические токены: `magic_tokens` (passwordless auth)
- [x] Слайды главной: `homepage_slides`
- [x] Индексы для оптимизации запросов
- [x] Атомарные миграции в `postgres/`

### 2. Главная страница (`/`)
- [x] SiteHeader с логотипом, навигацией, поиском и темой
- [x] Hero-слайдер (Embla Carousel, 5 тем, авторотация 8.5с)
- [x] HomepageSlides из БД с темами: atelier, night-city, pvz, volga, dreams
- [x] Информационные секции (миры, выпуски, блог)
- [x] SiteFooter с вариантами full/simple

### 3. Страница персонажей (`/characters`)
- [x] Сетка с карточками персонажей
- [x] Фильтрация по типу отношений
- [x] Интеграция с API

### 4. Профиль персонажа (`/characters/[slug]`)
- [x] Полное отображение информации (аватар, био, описание, способности)
- [x] Раздел "Связи с другими персонажами"
- [x] AI-чат с персонажем (Vercel AI SDK, GPT-4o-mini)
- [x] Посты персонажа, стена, дружба
- [x] Dynamic metadata для SEO

### 5. Магазин (`/shop`)
- [x] Сетка товаров с адаптивной версткой
- [x] Типы товаров (Комикс, Книга, Аудиокнига)
- [x] Ссылки на внешние магазины
- [x] Загрузка данных с API

### 6. Корзина (`/cart`)
- [x] Контекст `CartProvider` с управлением корзиной
- [x] Хранение в localStorage
- [x] Управление количеством (+/-), удаление, очистка
- [x] Форма заявки с валидацией
- [x] Отправка заказа на сервер

### 7. Система релизов (Release, основная читалка)
- [x] Читалка книг: `release-book-reader.tsx` (хайлайты, DOM-обёртка, прогресс)
- [x] Читалка комиксов: `release-comic-reader.tsx`
- [x] Аудиоплеер: `release-audio-player.tsx`
- [x] Маршруты: `/release/[slug]/[editionSlug]/[chapterIndex]`
- [x] Server actions: `lib/actions/studio.ts`

### 8. Studio
- [x] Доступ для ролей: author, editor, admin
- [x] Tiptap-редактор: `telegraph-editor.tsx`
- [x] Управление релизами, изданиями, главами, сериями
- [x] Управление персонажами, постами

### 9. Админ-панель
- [x] next-auth v5 (JWT, magic link, Yandex/Google OAuth)
- [x] Защита middleware (`proxy.ts`)
- [x] CRUD книги, персонажи, новости, слайды, пользователи
- [x] Нормалайзеры API в `lib/api/normalizers.ts`

### 10. API Routes
- [x] `GET /api/books` — получить все книги
- [x] `GET /api/books?featured=true` — избранные книги
- [x] `GET /api/characters` — все персонажи
- [x] `GET /api/characters/[slug]` — персонаж с его связями
- [x] `POST /api/orders` — создать заказ
- [x] `POST /api/characters/chat` — AI-чат
- [x] `GET /api/search?q=` — поиск (ILIKE)
- [x] Admin API: books, characters, news, homepage-slides, users

### 11. Дизайн и UX
- [x] Тёмная тема с CSS-переменными (`cf-*`)
- [x] Артхаусный стиль: фон `#111210`, текст `#f4efe5`, акцент `#d52525`
- [x] Типография: заголовки `font-black uppercase`
- [x] Адаптивная верстка (mobile-first)
- [x] Плавные переходы и hover эффекты
- [x] Единый SiteHeader/SiteFooter на всех страницах
- [x] Design system: `docs/design-system.md`

### 12. Документация
- [x] `SETUP.md` — подробная инструкция установки
- [x] `QUICKSTART.md` — быстрый старт
- [x] `AGENTS.md` — инструкции для AI-агентов
- [x] `docs/design-system.md` — дизайн-система
- [x] `.env.example` — пример переменных окружения

---

## 📊 Статистика проекта

### Файлы
- **Pages**: 30+ (App Router)
- **API Routes**: 25+
- **Components**: 50+ (включая shadcn/ui)
- **Lib**: 20+ файлов утилит и конфигурации
- **Миграции**: 5 SQL файлов

### База данных
- **Таблицы**: 25+
- **Миграции**: Идемпотентные, в `postgres/`

### Функциональность
- **Авторизация**: next-auth v5 (JWT, 2 OAuth провайдера, magic link)
- **AI**: Чат с персонажами, Vercel AI SDK
- **Читалка**: Книги, комиксы, аудио, хайлайты, редакторские заметки
- **Studio**: Tiptap-редактор, управление контентом
- **Поиск**: ILIKE по книгам, персонажам, новостям

---

## 🚀 Готовность к запуску

### Что нужно сделать:
1. [x] Создать PostgreSQL базу (Neon / Vercel Postgres)
2. [x] Выполнить SQL миграции
3. [x] Создать `.env.local` с DATABASE_URL и AUTH_SECRET
4. [x] Запустить `pnpm dev`

### Что можно сделать потом:
- [ ] Интегрировать платёжную систему (Stripe)
- [ ] Email-уведомления (Resend / Nodemailer)
- [ ] Оптимизировать изображения
- [ ] Рейтинг и комментарии читателей
- [ ] Уведомления в реальном времени

---

## 🎨 Дизайн-система

### Цвета (CSS-переменные cf-*)
| Переменная | Тёмная тема | Светлая тема | Назначение |
|---|---|---|---|
| `--cf-bg` | `#111210` | `#f4efe5` | Фон |
| `--cf-bg-2` | `#1b1c19` | `#ebe5d9` | Карточки |
| `--cf-text-1` | `#f4efe5` | `#1a1816` | Основной текст |
| `--cf-text-heading` | `#fff8ea` | `#0e0d0c` | Заголовки |
| `--cf-accent` | `#d52525` | `#d52525` | Красный акцент |

Полная таблица: `docs/design-system.md`

### Типография
- **Заголовки**: `font-black uppercase`
- **Основной текст**: `leading-7 text-cf-text-caption`
- **Капшн**: `text-sm text-cf-text-caption`

### Кнопки
- **Primary**: `bg-cf-accent text-white font-black uppercase`
- **Secondary**: `border border-cf-text-1/18 uppercase`
- **Ghost**: `text-cf-text-2 hover:bg-cf-text-1/6`

---

## 🔗 Ссылки на основные файлы

- Главная страница: `app/page.tsx`
- SiteHeader: `components/site-header.tsx`
- SiteFooter: `components/site-footer.tsx`
- NavItems: `lib/nav.ts`
- Дизайн-система: `docs/design-system.md`
- Типы данных: `lib/types.ts`, `lib/releases-types.ts`
- Нормалайзеры: `lib/api/normalizers.ts`
- Типы персонажей: `lib/types.ts`

---

**Проект Canfly — литературная вселенная Адиома Тимура.**

При возникновении вопросов см. `AGENTS.md` или `docs/design-system.md`.
