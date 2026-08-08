# Баги

Авто-сгенерировано из GitHub Issues. Не редактировать вручную.
Синхронизировано: 8 августа 2026 г.

---

### Bug: #22 — auth.config.ts: PII (email, профиль) в прод-логах + линковка OAuth по непроверенному email
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

1. PII в логах

В app/(auth)/auth.config.ts при каждом входе печатаются email, имя, id пользователя и данные профиля провайдера. Логи Vercel хранятся, индексируются и доступны всем с доступом к проекту:

| Строка | Что печатает |
|---|---|
| 199-206 | userEmail, userName, userId, profileDa

---

### Bug: #21 — Код подтверждения email не отправляется: addEmail пишет код в БД, но письма нет
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

addEmail в настройках профиля генерирует 6-значный код, кладёт его в email_verifications и возвращает пользователю «Код подтверждения отправлен». Письмо при этом не отправляется — код выводится только в серверную консоль и только в dev:

ts
// lib/actions/account-settings.ts:130-144
const 

---

### Bug: #20 — Загрузка картинок к постам персонажей идёт мимо image-upload.ts (нет проверки сигнатуры, размера)
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

lib/server/image-upload.ts написан специально для того, чтобы загрузки проходили проверку по сигнатуре байт, а не по MIME из запроса. В комментарии к нему прямо указано, зачем: SVG со скриптом на публичном blob-URL — это stored XSS, а file.type целиком задаёт клиент.

Загрузка картинок к п

---

### Bug: #19 — Проверка TLS-сертификата БД отключена: ssl.rejectUnauthorized=false перекрывает sslmode=verify-full
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

lib/db.ts содержит normalizeConnectionString(), который переписывает sslmode=require|prefer|verify-ca в verify-full — по комментарию, чтобы обойти смену семантики в pg v9. Но сразу после этого пул создаётся с явным объектом ssl:

ts
cachedPool = new Pool({
  connectionString,              

---

### Bug: #18 — XSS: JSON-LD не экранирует </script> — контент автора попадает в исполняемый скрипт
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

JSON-LD вставляется в разметку через dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }} без экранирования <. В схемы попадает контент, который пишет любой пользователь с ролью author: release.title, release.annotation, release.description, character.bio, news.title. Последователь

---

### Bug: #35 — /api/feedback: обращения не сохраняются (только console.info), PII в логах, нет лимитов
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/feedback принимает обращение пользователя, отвечает { ok: true } — и не сохраняет его никуда:

ts
// app/api/feedback/route.ts:11-25
const { message, page } = await request.json()
if (!message?.trim()) {
  return NextResponse.json({ error: 'Сообщение не может быть пустым' }, { st

---

### Bug: #34 — Стена персонажа: POST без рейт-лимита (+ revalidatePath на каждый пост)
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/characters/[slug]/wall создаёт пользовательский контент — и это единственная такая точка без рейт-лимита.

Роут сделан аккуратно: apiHandler, авторизация, zod (wallPostSchema), безопасный разбор тела (request.json().catch(() => null)). Не хватает только checkRateLimit:

ts
// app

---

### Bug: #33 — version-history: dangerouslySetInnerHTML из несанитизированного content.slice(0,500)
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

Превью версии главы в Studio рендерит сырой HTML из БД:

tsx
// components/studio/version-history.tsx:81-84
<div
  className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-xs"
  dangerouslySetInnerHTML={{ __html: v.content.slice(0, 500) }}
/>


Источник — fetchChapterVersions (lib/

---

### Bug: #32 — news.ts: контент новостей пишется без санитизации, withSafeContent только в одной из трёх функций чтения
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

Правило AGENTS.md: «Санитизация делается на сервере перед записью, а не только при рендере». В lib/server/news.ts контент пишется в БД как есть:

ts
// lib/server/news.ts:37-53
export async function createNewsPost(data: Record<string, unknown>) {
  return dbQueryOne<NewsPost>(
    INSERT I

---

### Bug: #31 — setUserRoles: DELETE+INSERT без транзакции — окно без ролей и потеря прав при сбое
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

setUserRoles переписывает роли двумя отдельными запросами без транзакции:

ts
// lib/server/users.ts:67-86
export async function setUserRoles(userId: string, roles: UserRole[]) {
  const normalizedRoles = Array.from(new Set(roles)).filter((role): role is UserRole =>
    ['reader', 'author'

---

### Bug: #29 — Сохранение настроек издания сбрасывает is_primary в false (updateEdition — полнострочный UPDATE)
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

updateEdition — полнострочный UPDATE: он перечисляет все колонки и подставляет дефолт для каждого непереданного поля.

ts
// lib/server/editions.ts:95-111
UPDATE editions SET
  format = $2::edition_format, platform = $3, external_url = $4,
  slug = $5, status = $6::edition_status, is_prima

---

### Bug: #28 — /api/characters/chat: нет zod, пустое тело → 500, длина сообщения не ограничена, авторизация после запроса в БД
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/characters/chat — платный LLM-эндпоинт, но вход не валидируется zod (правило AGENTS.md: «каждая мутация — zod»), в отличие от соседнего guardHighlightRequest (lib/ai/highlight-actions.ts:53-58), где всё сделано правильно.

1. Пустое тело → 500

ts
// app/api/characters/chat/route

---

### Bug: #26 — /api/reading-progress: нет zod, не-UUID и пустое тело дают 500, глава не сверяется с изданием
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/reading-progress — единственная мутация без zod-схемы (правило AGENTS.md: «каждая мутация — zod»). Валидация ручная и неполная:

ts
// app/api/reading-progress/route.ts:16-24
const body = await request.json()
const { editionId, chapterId, progressPercent } = body ?? {}

if (!edit

---

### Bug: #25 — chapter-highlights: LIMIT собирается интерполяцией, ?limit=1.5 → 500, ?limit=abc отключает лимит
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

limitClause в fetchChapterHighlights собирается интерполяцией строки, а значение приходит из query-параметра без валидации:

ts
// app/api/chapter-highlights/route.ts:13
const limit = searchParams.has('limit') ? Number(searchParams.get('limit')) : undefined

ts
// lib/server/chapter-highli

---

### Bug: #24 — Ридер: нечисловой номер главы в URL даёт 500 вместо 404 (parseInt → NaN)
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

Нечисловой сегмент главы в URL приводит к 500 вместо 404.

ts
// app/release/[slug]/book/[qualityTier]/[chapterIndex]/page.tsx:66-67
const chapterNumber = parseInt(ciStr, 10)
const chapterIndex = chapterNumber - 1
...
if (chapterIndex < 0 || chapterIndex >= chapters.length) notFound()
...


---

### Bug: #23 — /api/releases/download/markdown: не обёрнут в apiHandler, не проверяет связь издания с релизом
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

app/api/releases/download/markdown/route.ts — единственный роут в app/api/, экспортирующий голый обработчик:

ts
// :35
export async function GET(request: NextRequest) { ... }


Все остальные обёрнуты в apiHandler из lib/api-handler.ts, который логирует 5xx и маскирует сообщения pg в проде

---

### Bug: #40 — Уборка: слипшаяся строка в lib/db.ts:5 и недостижимое условие в proxy.ts:66
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

Две мелочи в коде, который читают чаще всего.

1. lib/db.ts:5 — слипшаяся строка

ts
function getDatabaseUrl() {  const databaseUrl =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    ...


Тело функции начинается на строке объявления, дальше идёт перенос — форматирование

---

### Bug: #39 — makeUniqueEditionSlugGlobal: гонка SELECT→INSERT, цикл до 100000, LIKE без экранирования
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

Подбор свободного slug'а для издания вытягивает все похожие строки в память и крутит цикл до 100 000:

ts
// lib/server/editions.ts:65-78
async function makeUniqueEditionSlugGlobal(baseSlug: string): Promise<string> {
  const existing = await dbQuery<{ slug: string }>(
    SELECT slug FROM

---

### Bug: #38 — /api/cron/cleanup: без apiHandler, прямой getPool() вместо dbQuery, метод в AGENTS.md указан неверно
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

app/api/cron/cleanup/route.ts — второй роут в app/api/, экспортирующий голый обработчик мимо apiHandler (первый — markdown-выгрузка, отдельная issue). И единственный, кто ходит в пул напрямую:

ts
import { NextResponse } from 'next/server'
import { getPool } from '@/lib/db'

export async f

---

### Bug: #37 — /api/chapters/rate отвечает 200 status:retired вместо 410, как /api/orders
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/orders и GET|POST /api/chapters/rate — оба legacy-заглушки снятой функциональности, но отвечают по-разному: orders отдаёт 410 Gone, rate — 200 OK с телом { status: 'retired' }.

ts
// app/api/chapters/rate/route.ts — 200 в обоих методах


200 на снятую функциональность — неверный

---

### Bug: #36 — use-column-pagination: document.fonts.ready.then(measure) не отменяется в cleanup
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

В useLayoutEffect два асинхронных источника вызова measure, но cleanup отменяет только один:

ts
// lib/reader/use-column-pagination.ts:89-94
useLayoutEffect(() => {
  const id = requestAnimationFrame(() => requestAnimationFrame(measure))
  document.fonts.ready.then(measure)
  return () =>

---

### Bug: #30 — deleteEditorialNote игнорирует userId/isAdmin, но JSDoc обещает проверку прав — заготовка под IDOR
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

deleteEditorialNote принимает userId и isAdmin, обещает в JSDoc проверку прав — и игнорирует оба аргумента:

ts
// lib/server/chapter-highlights.ts:361-374
/
  Удаляет замечание. Разрешено автору замечания и админу.
  Возвращает false, если записи нет или прав недостаточно.
 /
export async

---

### Bug: #27 — apiHandler клонирует и вычитывает тело ответа на 5xx — опасно для стриминговых роутов
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

apiHandler на ответах со статусом ≥500 клонирует ответ и читает тело целиком, чтобы залогировать текст ошибки:

ts
// lib/api-handler.ts:34-42
const result = await (handler as HandlerFn)(request, context)
if (result.status >= 500) {
  try {
    const body = await result.clone().json()
    

---

### Bug: #5 — Neon холодный старт: первый запрос 5+ секунд
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 02.07.2026

Описание

Бесплатный план Neon «засыпает» через 5 минут бездействия. Первый запрос после паузы длится до 5 секунд вместо обычных 20-50мс.

Где

lib/db.ts — pg Pool, без keepalive.

Ожидание

Приемлемое время первого запроса (менее 1с) или прозрачная обработка задержки (скелетон/лоадер).

Варианты ре

---

