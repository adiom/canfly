# Canfly — Артхаусное издательство комиксов и книг

Полнофункциональный веб-сайт для издательства комиксов, книг и аудиокниг с единой вселенной. Проект включает публичный каталог, онлайн-читалку, магазин с корзиной и полноценную администраторскую панель.

![Canfly Preview](https://images.unsplash.com/photo-1618835962148-cf2c217ea5c0?w=800)

## ✨ Основные возможности

### Для читателей и покупателей
- 📖 **Главная страница** с интерактивным слайдером избранных книг/комиксов
- 👥 **Каталог персонажей** с визуальным графом взаимосвязей между героями
- 🎨 **Подробные профили персонажей** со способностями и связями
- 📚 **Магазин** с каталогом всех изданий, ценами и описаниями
- 🛒 **Корзина** для добавления товаров и оформления заказов
- 👓 **Онлайн-читалка** для просмотра страниц книг напрямую на сайте
- 🌐 **Ссылки на внешние магазины** (Ozon, Litres и т.д.) для покупки

### Для администраторов
- 📋 **Админ-панель** с управлением контентом
- 📕 **Управление книгами** (добавление, редактирование, удаление)
- 🎭 **Управление персонажами** и их взаимосвязями
- 📦 **Просмотр заказов** с деталями и статусами
- 🔐 **Защищённый доступ** с простой аутентификацией

## 🚀 Быстрый старт

### 1. Клонирование и установка

```bash
# Клонировать проект
git clone https://github.com/your-username/canfly.git
cd canfly

# Установить зависимости
pnpm install

# Копировать переменные окружения
cp .env.example .env.local
```

### 2. Настройка Postgres

1. Создайте Postgres базу в Neon/Vercel
2. Выполните SQL из `postgres/schema.sql`
3. Обновите `.env.local`:

```env
DATABASE_URL=postgres://user:password@host/db?sslmode=require
NEXT_PUBLIC_BASE_URL=http://localhost:3000
ADMIN_PASSWORD=admin123
```

### 3. Запуск приложения

```bash
pnpm dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## 📍 Навигация по сайту

| Страница | URL | Описание |
|----------|-----|---------|
| Главная | `/` | Слайдер избранных книг + информация |
| Персонажи | `/characters` | Граф взаимосвязей и карточки персонажей |
| Профиль персонажа | `/characters/[slug]` | Полное описание и связи персонажа |
| Магазин | `/shop` | Каталог всех книг и комиксов |
| Корзина | `/cart` | Товары в корзине и оформление заказа |
| Читалка | `/books/[slug]` | Просмотр страниц книги онлайн |
| Админ вход | `/admin/login` | Форма входа для администраторов |
| Админ-панель | `/admin` | Управление контентом и заказами |

## 🔐 Вход в админ-панель

```
Email: admin@canfly.local
Пароль: admin123
```

## 🏗️ Архитектура проекта

### Frontend (React 19 + Next.js 16)
- **Pages**: Server Components для статического контента
- **Components**: Переиспользуемые UI компоненты (shadcn/ui)
- **Client Components**: Интерактивные элементы (слайдер, корзина, админка)
- **Hooks**: `useCart()` для управления корзиной

### Backend (Next.js API Routes)
- **Books API**: GET `/api/books`, `/api/books?featured=true`
- **Characters API**: GET `/api/characters`, `/api/characters/[slug]`
- **Orders API**: POST `/api/orders`, GET `/api/admin/orders`
- **Auth API**: POST `/api/admin/login`

### База данных (Neon/Vercel Postgres)
```
books → type: comic|book|audiobook
        preview_pages: JSON массив URL
        external_links: JSON объект {store: url}

characters → abilities: JSON массив
             avatar: URL изображения

character_relationships → многие ко многим

book_characters → many-to-many

orders → items: JSON с деталями товаров
         status: pending|confirmed|shipped|completed

admins → email whitelist для доступа в админку
```

## 🎨 Дизайн и стили

### Цветовая палитра
- **Основной фон**: Глубокий тёмный синий (`#0f172a`)
- **Вторичный фон**: Тёмный синий со сливок (`#1e293b`)
- **Акцент**: Фиолетовый (`#a855f7`) и розовый (`#ec4899`)
- **Текст**: Светлый серый (`#f1f5f9`)

### Дизайн-система
- **Компоненты**: shadcn/ui на базе Radix UI
- **Стилизация**: Tailwind CSS v4
- **Адаптивность**: Mobile-first approach
- **Типография**: Geist + Geist Mono

## 📦 Развертывание

### На Vercel (рекомендуется)

```bash
# 1. Создайте репозиторий на GitHub
git init && git add . && git commit -m "Initial commit"

# 2. Подключите на Vercel (vercel.com)
# 3. Добавьте переменные окружения в Project Settings
# 4. Разверните
git push origin main
```

### На собственный сервер

```bash
# Build
pnpm build

# Start
pnpm start

# Или используйте PM2/systemd для автозапуска
```

## 🛠️ Разработка и кастомизация

### Добавление новой книги

```sql
INSERT INTO books (
  title, slug, type, description, cover_image, 
  price, is_featured, display_order
) VALUES (
  'Название',
  'slug-названия',
  'comic', -- или 'book', 'audiobook'
  'Описание...',
  'https://image-url.jpg',
  59999, -- цена в копейках
  true,
  6
);
```

### Добавление персонажа

```sql
INSERT INTO characters (
  name, slug, avatar, bio, full_description
) VALUES (
  'Имя Персонажа',
  'slug-имени',
  'https://avatar-url.jpg',
  'Краткое описание',
  'Полное описание...'
);
```

### Создание связи между персонажами

```sql
INSERT INTO character_relationships (
  character_id, related_character_id, relationship_type, description
) VALUES (
  (SELECT id FROM characters WHERE slug = 'cipher'),
  (SELECT id FROM characters WHERE slug = 'nova'),
  'Союзник',
  'Боец сопротивления присоединяется...'
);
```

## 📚 Документация

- **[SETUP.md](./SETUP.md)** — Подробная инструкция установки и использования
- **[QUICKSTART.md](./QUICKSTART.md)** — Быстрый старт и тестирование функциональности
- **[PROJECT_CHECKLIST.md](./PROJECT_CHECKLIST.md)** — Полный чек-лист реализованных функций

## 🔧 Технический стек

### Frontend
- Next.js 16 (App Router)
- React 19.2
- TypeScript 5.7
- Tailwind CSS v4
- shadcn/ui компоненты
- Embla Carousel (слайдер)

### Backend
- Next.js API Routes
- pg
- PostgreSQL (Neon/Vercel)

### DevTools
- ESLint
- Tailwind CSS CLI
- PostCSS

## 📊 Статистика проекта

- **Pages**: 12+
- **API Routes**: 7
- **React Components**: 30+
- **База данных**: 6 таблиц
- **Строк кода**: ~2500+
- **Документация**: 4 файла

## ⚙️ Система

### Требования
- Node.js 18+
- pnpm 9+

### Переменные окружения
```
DATABASE_URL                    # Основная строка подключения Neon/Postgres
# или POSTGRES_URL              # Vercel Postgres/Neon integration
NEXT_PUBLIC_BASE_URL            # URL приложения
AUTH_SECRET                     # Секрет next-auth
AUTH_GOOGLE_CLIENT_ID           # OAuth Google client id
AUTH_GOOGLE_CLIENT_SECRET       # OAuth Google secret
AUTH_GITHUB_CLIENT_ID           # OAuth GitHub client id
AUTH_GITHUB_CLIENT_SECRET       # OAuth GitHub client secret
AUTH_CANFLY_ISSUER              # Issuer общего canfly OIDC/Logto
AUTH_CANFLY_CLIENT_ID           # Client id поддомена в canfly SSO
AUTH_CANFLY_CLIENT_SECRET       # Client secret поддомена в canfly SSO
NEXT_PUBLIC_CANFLY_SSO_ENABLED  # true показывает кнопку «Войти через canfly»
```

## 🐛 Решение проблем

**Q: Ошибка "Таблицы не найдены"**
A: Убедитесь, что SQL из `postgres/schema.sql` выполнен в Neon/Vercel Postgres.

**Q: Корзина пуста после перезагрузки**
A: Это нормально — корзина хранится в localStorage браузера. В продакшене используйте БД.

**Q: Админ-панель требует вход каждый раз**
A: Токен хранится в localStorage. Его может очистить браузер. Добавьте session storage для persistent auth.

**Q: Изображения не загружаются**
A: Убедитесь, что URLs изображений доступны. Используйте https URL для продакшена.

## 🎯 Планы развития

### MVP (реализовано)
- ✅ Главная страница со слайдером
- ✅ Каталог персонажей с графом
- ✅ Магазин и корзина
- ✅ Админ-панель

### Phase 2
- [ ] Аутентификация для пользователей
- [ ] Система рецензий и рейтингов
- [ ] Поиск и фильтрация
- [ ] Уведомления по email

### Phase 3
- [ ] Платежная система (Stripe)
- [ ] Рекомендации и ML
- [ ] Аналитика
- [ ] Мобильное приложение

## 👤 Автор

Создано с помощью v0 (Vercel AI)

## 📄 Лицензия

©  Canfly. Все права защищены.

---

**Готово к использованию!** Вопросы? Смотрите документацию в SETUP.md или QUICKSTART.md.
