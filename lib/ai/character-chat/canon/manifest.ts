/**
 * Манифест проверенного канона персонажа.
 *
 * Источник правды для сюжетных утверждений — существующие
 * `releases → editions → chapters` и авторские поля `characters`. Этот файл
 * ничего не придумывает: он лишь фиксирует, какие опубликованные фрагменты
 * автор разрешил подавать модели, и по какому хешу проверяется, что глава не
 * изменилась после утверждения.
 *
 * Правила:
 * - активен только манифест со статусом `approved`, заполненным `scope`,
 *   подписью автора и хотя бы одним фрагментом;
 * - `is_primary` издания не означает «канон»: издание и точка знания
 *   выбираются явно;
 * - seed-данные и старые миграции каноном не считаются;
 * - реплики читателей и выводы модели в манифест не попадают никогда.
 */
export type CanonManifestStatus = 'draft' | 'pending_approval' | 'approved' | 'revoked'

/** Границы допустимого контекста: одно издание одного релиза и точка знания. */
export interface CanonScope {
  releaseSlug: string
  editionSlug: string
  /**
   * Последняя глава (`chapter_index`, с единицы), знание которой герой может
   * использовать. Всё, что дальше, — спойлер и в контекст не попадает, даже
   * если читатель просит. Прогресс чтения и текст запроса этот предел не
   * расширяют: источник ограничения — только манифест.
   */
  knowledgeCutoffChapterIndex: number
}

/**
 * Один утверждённый фрагмент главы.
 *
 * `anchor` — дословное начало выдержки в нормализованном тексте главы
 * (см. `chapterPlainText`). Он нужен, чтобы после правки текста выдержку можно
 * было найти заново, а не хранить копию главы в коде.
 */
export interface CanonSegment {
  /** Стабильный идентификатор фрагмента. Попадает в metadata, но не текст. */
  id: string
  /** UUID главы из `chapters.id`. */
  chapterId: string
  /** Ожидаемый `chapter_index` на момент утверждения. */
  chapterIndex: number
  anchor: string
  /** Предел выдержки в символах. */
  maxChars: number
  /** sha256 нормализованного текста всей главы на момент утверждения. */
  chapterHash: string
  /** sha256 нормализованной выдержки на момент утверждения. */
  fragmentHash: string
}

export interface CanonManifest {
  id: string
  version: number
  characterSlug: string
  status: CanonManifestStatus
  /** Кто утвердил (имя/почта автора). `null` — утверждения не было. */
  approvedBy: string | null
  /** ISO-дата утверждения. `null` — утверждения не было. */
  approvedAt: string | null
  scope: CanonScope | null
  /** Жёсткий предел суммарного текста фрагментов в system prompt. */
  maxTotalChars: number
  segments: CanonSegment[]
  /** Что именно ждёт решения автора — короткая памятка, не канон. */
  pendingDecision: string
}

/**
 * Черновик Сони. Проверено по рабочей БД 10.11.2026:
 * персонаж `sonya` существует (`reply_mode = ai_auto`), связан как `main`
 * с тремя опубликованными релизами, но `passport`, `knowledge_scope`,
 * `spoiler_policy`, `boundaries`, `speaking_style` и `personality` пусты.
 * Поэтому канон нельзя собрать «из карточки»: нужен явный выбор издания,
 * точки знания и подписанных фрагментов.
 *
 * Пока статус `draft`, `scope = null` и фрагментов нет, чат Сони работает
 * ровно как раньше — этот манифест ничего не добавляет в prompt.
 */
export const SONYA_CANON_MANIFEST: CanonManifest = {
  id: 'sonya-canon',
  version: 1,
  characterSlug: 'sonya',
  status: 'draft',
  approvedBy: null,
  approvedAt: null,
  scope: null,
  maxTotalChars: 6_000,
  segments: [],
  pendingDecision:
    'Нужно утвердить: релиз и издание, точку знания (последнюю доступную главу), ' +
    '4–8 фрагментов с якорями, spoiler scope и подпись автора. ' +
    'Кандидаты изданий с опубликованными главами: ' +
    'kroy-po-dushe / kroy-po-dushe-premium (book, 23 гл.), ' +
    'kroy-po-dushe-tom-2 / kroy-po-dushe-tom-2-v0 (book, 25 гл.), ' +
    'esche-odna-popytka-soni / sbornik-esche-odna-popytka-soni (book, 7 гл.). ' +
    'У всех изданий is_primary = false, поэтому «основное» издание выбирается автором, а не флагом.',
}

/** Реестр манифестов. Новый персонаж — новая запись, чужие не наследуются. */
export const CANON_MANIFESTS: readonly CanonManifest[] = [SONYA_CANON_MANIFEST]

/**
 * Ищет манифест по слагу персонажа. Сравнение точное: слаг из БД не должен
 * «подходить» другому герою по регистру или подстроке.
 */
export function findCanonManifest(characterSlug: string): CanonManifest | null {
  const normalized = characterSlug.trim()
  if (!normalized) return null
  return CANON_MANIFESTS.find((manifest) => manifest.characterSlug === normalized) ?? null
}

export type ActiveCanonManifest = CanonManifest & {
  scope: CanonScope
  approvedAt: string
  approvedBy: string
}

/**
 * Манифест активен только при полном наборе условий. Пустой или
 * неутверждённый манифест не должен попадать в prompt даже частично.
 */
export function isCanonManifestActive(
  manifest: CanonManifest | null,
): manifest is ActiveCanonManifest {
  if (!manifest) return false
  if (manifest.status !== 'approved') return false
  if (!manifest.approvedAt || !manifest.approvedBy) return false
  if (!manifest.scope) return false
  if (manifest.segments.length === 0) return false
  if (manifest.scope.knowledgeCutoffChapterIndex < 1) return false
  return true
}
