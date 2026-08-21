# Баги

Авто-сгенерировано из GitHub Issues. Не редактировать вручную.
Синхронизировано: 21 августа 2026 г.

---

### Bug: #43 — Magic link: лимит только по email — рассылка писем и рост magic_tokens без предела
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

createMagicLink ограничивает частоту только по email — по IP и по общему
объёму ограничений нет.

[app/(auth)/actions.ts:99-110](../blob/main/app/(auth)/actions.ts#L99-L110):

ts
const recent = await dbQueryOne<{ cnt: string }>(
  SELECT COUNT() AS cnt FROM magic_tokens
   WHERE email = $1 AND created_at > NOW() - INTERVAL '15 minutes' AND used = false,
  [email],
)

if (recent && Number(recent.cnt) >= 3) { ... }


Дальше идёт безусловный INSERT в magic_tokens и безусловный вызов Postmark.
Ключ окна — email, поэтому один клиент, перебирая адреса, отправляет письма без
предела:

-…

---

### Bug: #21 — Код подтверждения email не отправляется: addEmail пишет код в БД, но письма нет
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

addEmail в настройках профиля генерирует 6-значный код, кладёт его в email_verifications и возвращает пользователю «Код подтверждения отправлен». Письмо при этом не отправляется — код выводится только в серверную консоль и только в dev:

ts
// lib/actions/account-settings.ts:130-144
const code = generateVerificationCode()          // randomInt(100_000, 1_000_000) — 6 цифр
const expiresAt = new Date(Date.now() + 15  60  1000)
await dbQuery(
  INSERT INTO email_verifications (user_id, email_id, code, expires_at) VALUES ($1,$2,$3,$4),
  [user.id, newEmail.id, code, expiresAt],
)
if…

---

### Bug: #20 — Загрузка картинок к постам персонажей идёт мимо image-upload.ts (нет проверки сигнатуры, размера)
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

lib/server/image-upload.ts написан специально для того, чтобы загрузки проходили проверку по сигнатуре байт, а не по MIME из запроса. В комментарии к нему прямо указано, зачем: SVG со скриптом на публичном blob-URL — это stored XSS, а file.type целиком задаёт клиент.

Загрузка картинок к постам персонажей этот модуль не использует:

ts
// lib/actions/studio-characters.ts:212-214 и 252-254
const ext = file.name.split('.').pop() || 'bin'
const filename = character-posts/${characterId}/${Date.now()}-${crypto.randomUUID()}.${ext}
const blob = await put(filename, file, { access: 'public'…

---

### Bug: #19 — Проверка TLS-сертификата БД отключена: ssl.rejectUnauthorized=false перекрывает sslmode=verify-full
- Приоритет: `priority-high`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

lib/db.ts содержит normalizeConnectionString(), который переписывает sslmode=require|prefer|verify-ca в verify-full — по комментарию, чтобы обойти смену семантики в pg v9. Но сразу после этого пул создаётся с явным объектом ssl:

ts
cachedPool = new Pool({
  connectionString,                                   // ...sslmode=verify-full
  ssl: isLocal ? false : { rejectUnauthorized: false },  // ← перекрывает
  max: 3,
  idleTimeoutMillis: 10000,
})


В node-postgres объект ssl в конфиге имеет приоритет над sslmode из строки подключения. То есть rejectUnauthorized: false побеждает,…

---

### Bug: #49 — /api/user/session глотает ошибки БД и отвечает 200 «не авторизован»
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

GET /api/user/session при любой ошибке отвечает 200 и «пользователь не авторизован».

[app/api/user/session/route.ts](../blob/main/app/api/user/session/route.ts):

ts
export async function GET() {
  try {
    const user = await getCurrentUser()
    if (!user) return NextResponse.json({ user: null, roles: [], isAuthenticated: false })
    const roles = await getUserRoles(user.id)
    return NextResponse.json({ user, roles, isAuthenticated: true })
  } catch (error) {
    console.error('Session error:', error)
    return NextResponse.json({ user: null, roles: [], isAuthenticated:…

---

### Bug: #44 — chapter_versions хранит отсанитизированный HTML — ложные версии и невосстановимый исходник
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

История версий главы хранит уже отсанитизированный HTML, а не то, что автор
написал. Санитизация происходит на чтении, и в архив попадает результат чистки.

[lib/server/chapters.ts:11-14](../blob/main/lib/server/chapters.ts#L11-L14) —
withSafeContent применяется в fetchChapterById (строка 68) и в списках:

ts
function withSafeContent<T extends { content?: string | null }>(row: T): T {
  if (!row.content) return row
  return { ...row, content: sanitizeChapterHtml(row.content) }
}


[lib/actions/studio.ts:342-351](../blob/main/lib/actions/studio.ts#L342-L351) —
в архив пишется именно…

---

### Bug: #42 — /api/search: нет рейт-лимита, три LIKE '%…%' без индексов → исчерпание пула
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

GET /api/search — единственный публичный эндпоинт без авторизации и без
рейт-лимита, который на каждый запрос делает три LIKE '%…%' по таблицам
releases, characters, news_posts.

[lib/server/search.ts:222-294](../blob/main/lib/server/search.ts#L222-L294):

sql
WHERE LOWER(name) LIKE LOWER($1) OR LOWER(bio) LIKE LOWER($1)
   OR word_similarity($2, name) >= 0.4
...
AND (LOWER(title) LIKE LOWER($1) OR LOWER(content) LIKE LOWER($1)
     OR word_similarity($2, title) >= 0.4)


Ведущий % в шаблоне (pattern = '%' + q + '%') делает индекс по title
неприменимым, а LOWER(content) по…

---

### Bug: #41 — /api/search: нечисловой ?limit доходит до SQL как NaN → 500
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

/api/search?limit=abc доходит до SQL как NaN и роняет запрос.

[app/api/search/route.ts:10](../blob/main/app/api/search/route.ts#L10):

ts
const limit = Math.min(Number(searchParams.get('limit') ?? '6'), 20)


Number('abc') → NaN, Math.min(NaN, 20) → NaN. Дальше в
[lib/server/search.ts:219-220](../blob/main/lib/server/search.ts#L219-L220):

ts
const releaseLimit = Math.max(2, Math.ceil(limit / 2))   // Math.max(2, NaN) === NaN
const otherLimit = Math.max(1, Math.floor(limit / 3))    // NaN


Math.max с NaN возвращает NaN, а не второй аргумент — «пол» из Math.max(2, …)
не спасает.…

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
  return NextResponse.json({ error: 'Сообщение не может быть пустым' }, { status: 400 })
}

// Пока просто логируем в консоль (в будущем — сохранить в БД или отправить в Telegram/email)
console.info('[feedback]', {
  userId: user.id,
  email: user.email,
  page: page ?? 'unknown',
  message: message.trim(),
  ts: new Date().toISOString(),
})

return NextResponse.json({ ok:…

---

### Bug: #34 — Стена персонажа: POST без рейт-лимита (+ revalidatePath на каждый пост)
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/characters/[slug]/wall создаёт пользовательский контент — и это единственная такая точка без рейт-лимита.

Роут сделан аккуратно: apiHandler, авторизация, zod (wallPostSchema), безопасный разбор тела (request.json().catch(() => null)). Не хватает только checkRateLimit:

ts
// app/api/characters/[slug]/wall/route.ts:42-57
const user = await getCurrentUser()
if (!user) return NextResponse.json({ error: 'Необходимо войти' }, { status: 401 })

const body = await request.json().catch(() => null)
const parsed = wallPostSchema.safeParse(body)
if (!parsed.success) return…

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


Источник — fetchChapterVersions (lib/server/chapters.ts:154-162), которая, в отличие от fetchChapterById, не пропускает контент через withSafeContent:

ts
export async function fetchChapterVersions(chapterId: string) {
  return dbQuery<ChapterVersion>(
    SELECT id, chapter_id, content, version_number, created_at
     FROM…

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
    INSERT INTO news_posts (section, title, content, tag, display_order, is_active)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING ${newsColumns},
    [data.section, data.title, data.content, data.tag, data.display_order, data.is_active],
  )
}

export async function updateNewsPost(id: string, data:…

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
    ['reader', 'author', 'editor', 'admin'].includes(role),
  )

  await dbQuery('DELETE FROM user_roles WHERE user_id = $1', [userId])

  if (normalizedRoles.length === 0) {
    return
  }

  await dbQuery(
    INSERT INTO user_roles (user_id, role)
     SELECT $1::uuid, unnest($2::user_role[])
     ON CONFLICT DO…

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
  slug = $5, status = $6::edition_status, is_primary = $7, quality_tier = $8
 WHERE id = $1
 RETURNING ${editionColumns},
[
  id,
  data.format ?? 'book',
  data.platform ?? null,
  data.external_url ?? null,
  nextSlug,
  data.status ?? 'draft',
  data.is_primary ?? false,      // ← вот здесь
  data.quality_tier ?? 'standard',
],


Единственный…

---

### Bug: #28 — /api/characters/chat: нет zod, пустое тело → 500, длина сообщения не ограничена, авторизация после запроса в БД
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/characters/chat — платный LLM-эндпоинт, но вход не валидируется zod (правило AGENTS.md: «каждая мутация — zod»), в отличие от соседнего guardHighlightRequest (lib/ai/highlight-actions.ts:53-58), где всё сделано правильно.

1. Пустое тело → 500

ts
// app/api/characters/chat/route.ts:33
const { messages, characterSlug } = await request.json()

Без try/catch. POST без тела или с битым JSON бросает SyntaxError до любой проверки. apiHandler вернёт 500 вместо 400. Образец рядом:

ts
// lib/ai/highlight-actions.ts:53-58
let body: unknown
try { body = await request.json() } catch…

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

if (!editionId || !chapterId) {
  return NextResponse.json({ error: 'editionId and chapterId are required' }, { status: 400 })
}
if (typeof progressPercent !== 'number' || Number.isNaN(progressPercent)) {
  return NextResponse.json({ error: 'progressPercent must be a number' }, { status: 400 })
}


Три…

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
// lib/server/chapter-highlights.ts:54
const limitClause = options.limit ? LIMIT ${Math.max(1, Math.min(200, options.limit))} : ''


Math.min(200, x) не защищает от нечисловых значений:

| ?limit= | Number(...) | результат |
|---|---|---|
| abc | NaN | NaN — falsy, ветка не берётся, лимита нет вообще (тихая отдача всех строк)…

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
chapterId: chapters[chapterIndex].id


parseInt('abc', 10) → NaN. Любое сравнение с NaN даёт false, поэтому обе проверки не срабатывают, notFound() не вызывается, и следующая строка выполняет chapters[NaN].id → TypeError: Cannot read properties of undefined.

То же в…

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


Все остальные обёрнуты в apiHandler из lib/api-handler.ts, который логирует 5xx и маскирует сообщения pg в проде (в них имена таблиц, колонок и constraint'ов). Здесь любое исключение из fetchReleaseById / fetchEditionById / fetchPublishedChaptersByEdition уходит наружу необработанным — Next отдаст дефолтную страницу ошибки, а на serverless-рантайме текст ошибки попадает в тело ответа.

Триггерится…

---

### Bug: #17 — Поведение слайдера
- Приоритет: `priority-medium`
- Статус: `open`
- Обновлено: 21.08.2026

Привет, крутой проект! 
Однако к ui/ux считаю нужно подходить из реального опыта использования. В частности, слайдер, я бы заменил, (если нужно поделюсь наработками),, но а общем плане, сейчас происходит следующее: 
Я "свацпаб" слайд, и приостанавливают, для того чтобы прочитать, или сфокусироваться на каком либо контенте, однако автослайдер не понимает "моего удержания". Слад листается по событию  логике тайминга, что в целом сейчас вызывает дискомфорт, ТК отсутствует фокусировка на ux. Спасибо

---

### Bug: #50 — postgres/: дублирующиеся номера миграций (007, 014) и вторая последовательность в migrations/
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

В postgres/ два номера заняты дважды, и рядом живёт вторая независимая
последовательность миграций.

Дубликаты:


postgres/007_add_audio_chapter_fields.sql
postgres/007_search_trgm.sql

postgres/014_add_digital_format.sql
postgres/014_highlights_stability.sql


Плюс отдельная папка со своей нумерацией:


postgres/migrations/001_magic_tokens.sql
postgres/migrations/002_character_system_role.sql


AGENTS.md говорит применять файлы «по порядку: schema.sql → 002_release_system.sql
… 013_rate_limits.sql, плюс highlights-migration.sql и
postgres/migrations/001_magic_tokens.sql». Списка не…

---

### Bug: #48 — /user/[slug]: владелец не видит свою полку (условие !isOwner зеркально смыслу)
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

На странице /user/[slug] владелец не видит собственную полку — единственный,
кому она не показывается.

[app/user/[slug]/page.tsx:70-81](../blob/main/app/user/%5Bslug%5D/page.tsx#L70-L81):

ts
const [quotes, shelf, weeks] = isPublic
  ? await Promise.all([
      fetchChapterHighlights({ ... }),
      user.show_reading && !isOwner ? fetchShelf(user.id, 6) : Promise.resolve([] as ShelfItem[]),
      user.show_reading ? fetchCoreWeeks(user.id) : Promise.resolve([]),
    ])
  : [[], [] as ShelfItem[], []]


!isOwner есть только у shelf; weeks (керн чтения) отдаётся владельцу нормально.…

---

### Bug: #47 — restoreChapterVersion: два запроса без транзакции, текущий текст главы не архивируется
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

restoreChapterVersion делает два независимых запроса без транзакции.

[lib/server/chapters.ts:226-238](../blob/main/lib/server/chapters.ts#L226-L238):

ts
export async function restoreChapterVersion(chapterId: string, versionId: string) {
  const version = await fetchChapterVersion(versionId)
  if (!version || version.chapter_id !== chapterId) return null

  await createChapterVersion(chapterId, version.content)     // 1) архивируем

  return dbQueryOne<Chapter>(
    UPDATE chapters SET content = $2, word_count = $3 ...,  // 2) откатываем
    [chapterId, version.content, ...],
  )
}…

---

### Bug: #46 — restoreChapterVersion считает word_count без снятия HTML-тегов — расходится с сохранением
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

Откат к версии считает слова по-другому, чем сохранение главы, — HTML-теги
попадают в счётчик.

[lib/server/chapters.ts:226-238](../blob/main/lib/server/chapters.ts#L226-L238):

ts
[chapterId, version.content, version.content.split(/\s+/).filter(Boolean).length]


[lib/actions/studio.ts:345-347](../blob/main/lib/actions/studio.ts#L345-L347) —
то же самое при обычном сохранении:

ts
const wordCount = valid.content
  ? valid.content.replace(/<[^>]>/g, ' ').split(/\s+/).filter(Boolean).length
  : chapter.word_count


Разница — replace(/<[^>]>/g, ' '). В restoreChapterVersion его нет,…

---

### Bug: #45 — createChapterVersion: version_number через SELECT-then-INSERT без UNIQUE — дубликаты версий
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 21.08.2026

Проблема

version_number считается через SELECT-then-INSERT без транзакции и без
уникального ограничения в схеме.

[lib/server/chapters.ts:192-206](../blob/main/lib/server/chapters.ts#L192-L206):

ts
const last = await dbQueryOne<{ version_number: number }>(
  SELECT version_number FROM chapter_versions
   WHERE chapter_id = $1 ORDER BY version_number DESC LIMIT 1,
  [chapterId],
)
const nextVersion = (last?.version_number ?? 0) + 1

return dbQueryOne<ChapterVersion>(
  INSERT INTO chapter_versions (chapter_id, content, version_number)
   VALUES ($1, $2, $3) ...,
  [chapterId, content,…

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


Тело функции начинается на строке объявления, дальше идёт перенос — форматирование сломано, вероятно при автозамене. Читается плохо в файле, который AGENTS.md называет единственной точкой доступа к Postgres. Ни на что не влияет, но чинится за секунду:

ts
function getDatabaseUrl() {
  const databaseUrl =
    process.env.DATABASE_URL ||
    ...


2. proxy.ts:66 — недостижимое…

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
    SELECT slug FROM editions WHERE slug = $1 OR slug LIKE $2,
    [baseSlug, ${baseSlug}-%],
  )
  const used = new Set(existing.map(e => e.slug))
  if (!used.has(baseSlug)) return baseSlug

  for (let i = 2; i < 100000; i++) {
    const candidate = ${baseSlug}-${i}
    if (!used.has(candidate)) return candidate
  }…

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

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret || authHeader !== Bearer ${cronSecret}) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result = await…

---

### Bug: #37 — /api/chapters/rate отвечает 200 status:retired вместо 410, как /api/orders
- Приоритет: `priority-low`
- Статус: `open`
- Обновлено: 08.08.2026

Описание

POST /api/orders и GET|POST /api/chapters/rate — оба legacy-заглушки снятой функциональности, но отвечают по-разному: orders отдаёт 410 Gone, rate — 200 OK с телом { status: 'retired' }.

ts
// app/api/chapters/rate/route.ts — 200 в обоих методах


200 на снятую функциональность — неверный код: для клиента, кэша и мониторинга это «всё хорошо». Следствия конкретные:

- клиентский код, который проверяет response.ok, продолжит считать вызов успешным и пойдёт по ветке успеха с телом, которого не ждёт;
- любой промежуточный кэш (Vercel, CDN, браузер) вправе кэшировать 200 — в отличие от…

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
  return () => cancelAnimationFrame(id)
}, [chapterKey, fontSize, measure])


cancelAnimationFrame(id) снимает rAF-цепочку, а промис document.fonts.ready отменить нельзя — .then(measure) выполнится когда шрифты догрузятся, независимо от того, размонтировался компонент или сменилась глава.

Что из этого следует:…

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
export async function deleteEditorialNote(
  id: string,
  _userId: string,
  _isAdmin: boolean,
): Promise<boolean> {
  const rows = await dbQuery<{ id: string }>(
    DELETE FROM chapter_editorial_notes WHERE id = $1 RETURNING id,
    [id],
  )
  return rows.length > 0
}


DELETE ... WHERE id = $1 — без…

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
    logError(method, path, body.error ?? body)
  } catch {
    logError(method, path, status ${result.status} (non-JSON body))
  }
}
return result


Response.clone() не копирует данные — он создаёт вторую ветку того же потока и обязывает рантайм буферизовать всё, что читает одна ветка, пока вторая не…

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

Варианты решения

- Keepalive запросы к БД каждые 4 минуты
- Neon paid план (без холодного старта)
- Индикатор загрузки на стороне клиента для первого запроса

---

