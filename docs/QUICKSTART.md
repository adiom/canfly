# Canfly - Быстрый старт

## 1. Требования

- Node.js 18+
- PostgreSQL 15+ (Neon, локальный, или Vercel Postgres)
- pnpm

## 2. Запуск приложения

```bash
pnpm install
pnpm dev
```

Приложение откроется на [http://localhost:3000](http://localhost:3000)

## 3. Переменные окружения

Скопируйте `.env.example` в `.env.local`:

```env
# Postgres (Neon / Vercel Postgres / локальный)
DATABASE_URL=postgres://user:password@host/db?sslmode=require

# next-auth v5
AUTH_SECRET=xxx
AUTH_YANDEX_CLIENT_ID=xxx
AUTH_YANDEX_CLIENT_SECRET=xxx
AUTH_GOOGLE_CLIENT_ID=xxx
AUTH_GOOGLE_CLIENT_SECRET=xxx
AUTH_GITHUB_CLIENT_ID=xxx
AUTH_GITHUB_CLIENT_SECRET=xxx

# canfly SSO client mode для поддоменов
AUTH_CANFLY_ISSUER=https://canfly.org/oidc
AUTH_CANFLY_CLIENT_ID=xxx
AUTH_CANFLY_CLIENT_SECRET=xxx
NEXT_PUBLIC_CANFLY_SSO_ENABLED=false

# OpenAI (чат с персонажами)
OPENAI_API_KEY=sk-xxx

# Vercel Blob (загрузка изображений)
BLOB_READ_WRITE_TOKEN=xxx

# App
NEXT_PUBLIC_BASE_URL=http://localhost:3000
```

## 4. База данных

Миграции находятся в `postgres/`. Выполните в указанном порядке:

```bash
psql $DATABASE_URL -f postgres/schema.sql
psql $DATABASE_URL -f postgres/002_release_system.sql
psql $DATABASE_URL -f postgres/003_add_audiorelease.sql
psql $DATABASE_URL -f postgres/004_release_design.sql
psql $DATABASE_URL -f postgres/highlights-migration.sql
```

Или откройте `postgres/schema.sql` в Neon Console → SQL Editor.

### Тестовый вход

После запуска зарегистрируйтесь через `/login` — первый пользователь получает роль `reader`. Роли (`author`, `editor`, `admin`) назначаются через SQL:
```sql
INSERT INTO user_roles (user_id, role) VALUES ('user-uuid', 'admin');
```

## 5. Основные маршруты

| Страница | Путь | Авторизация |
|---|---|---|
| Главная | `/` | Нет |
| Книги | `/books` | Нет |
| Персонажи | `/characters` | Нет |
| Магазин | `/shop` | Нет |
| Корзина | `/cart` | Нет |
| Читалка (Release) | `/release/[slug]` | Нет |
| Профиль | `/profile` | Нужна |
| Studio | `/studio` | author/editor/admin |
| Админ-панель | `/admin` | admin |

## 6. Публичные API endpoints

- `GET /api/books` — все книги
- `GET /api/books?featured=true` — избранные
- `GET /api/characters` — все персонажи
- `GET /api/characters/[slug]` — персонаж со связями
- `POST /api/orders` — создать заказ
- `GET /api/search?q=` — поиск

## 7. Сборка

```bash
pnpm build
pnpm start
```

## 8. Структура файлов

```
app/
├── (auth)/          # next-auth конфиг
├── release/         # Release система (основная)
├── books/           # Старая читалка
├── characters/      # Персонажи
├── shop/            # Магазин
├── cart/            # Корзина
├── search/          # Поиск
├── studio/          # Studio для авторов
├── admin/           # Админ-панель (legacy)
└── profile/         # Профиль
components/
├── ui/              # shadcn/ui
├── studio/          # Studio компоненты
├── site-header.tsx  # Шапка
└── site-footer.tsx  # Подвал
lib/
├── server/          # Серверные репозитории
├── actions/         # Server actions
├── db.ts            # pg Pool
├── types.ts         # Типы
└── api/
    └── normalizers.ts  # Нормалайзеры API
```

## 9. Полезные команды

```bash
pnpm lint          # Линтинг
pnpm test:smoke    # E2E smoke тесты
pnpm test:e2e      # Все E2E тесты
pnpm db:structure  # Структура БД
```

---

**Готово к использованию!**

Вопросы? Смотрите `SETUP.md` для подробной документации.
