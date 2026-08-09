/**
 * Дефолтный набор типов связи между персонажами.
 *
 * В БД колонка `relationship_type` хранится как свободный TEXT — формальный
 * enum не вводим, чтобы автор мог задать свой тип сюжета (мифологический,
 * фан-арк и т.п.). Zod-схема при сохранении:
 *   - принимает любой из `DEFAULT` без изменений;
 *   - для пользовательского значения требует явной пометки (поле `custom`),
 *     иначе реджектит как не из списка — это защита от опечаток.
 *
 * Каждый тип имеет:
 *   - `key` — стабильный id (используется в данных, локализации);
 *   - `label` — RU-лейбл для UI;
 *   - `tone` — цветовая подсветка (cf-air-* / cf-live-*) для консистентности
 *     с дизайн-системой canfly.
 */

export type RelationshipKindKey =
  | 'ally'
  | 'rival'
  | 'mentor'
  | 'family'
  | 'romantic'
  | 'comrade'
  | 'enemy'
  | 'subordinate'
  | 'creator'
  | 'custom'

export interface RelationshipKind {
  key: RelationshipKindKey
  label: string
  /** Маленькая подпись под лейблом в форме — поясняет, что значит связь. */
  hint: string
  tone: 'accent' | 'on' | 'slow' | 'quiet' | 'warm'
}

export const RELATIONSHIP_KINDS: RelationshipKind[] = [
  {
    key: 'ally',
    label: 'Союзник',
    hint: 'Действуют заодно, помогают друг другу.',
    tone: 'on',
  },
  {
    key: 'rival',
    label: 'Соперник',
    hint: 'Соревнуются, но не враждуют.',
    tone: 'warm',
  },
  {
    key: 'mentor',
    label: 'Наставник',
    hint: 'Передаёт знания, формирует мировоззрение.',
    tone: 'accent',
  },
  {
    key: 'family',
    label: 'Семья',
    hint: 'Родственная связь, кровная или принятая.',
    tone: 'warm',
  },
  {
    key: 'romantic',
    label: 'Романтика',
    hint: 'Любовная линия или глубокая привязанность.',
    tone: 'accent',
  },
  {
    key: 'comrade',
    label: 'Боевой товарищ',
    hint: 'Сражались бок о бок, прошли через общее.',
    tone: 'on',
  },
  {
    key: 'enemy',
    label: 'Противник',
    hint: 'Прямая вражда, открытый конфликт.',
    tone: 'quiet',
  },
  {
    key: 'subordinate',
    label: 'Подчинённый',
    hint: 'Служит, подчиняется, следует иерархии.',
    tone: 'slow',
  },
  {
    key: 'creator',
    label: 'Создатель',
    hint: 'Создал, вырастил, вдохновил на существование.',
    tone: 'slow',
  },
]

export const DEFAULT_RELATIONSHIP_KEYS = RELATIONSHIP_KINDS.map((k) => k.key)

/** Лейбл типа: для дефолтных возвращает RU-лейбл, для кастомных — сам текст. */
export function relationshipLabel(type: string): string {
  const known = RELATIONSHIP_KINDS.find((k) => k.key === type)
  return known ? known.label : type
}

/** Тон типа (для UI-цветов); для неизвестного — quiet. */
export function relationshipTone(type: string): RelationshipKind['tone'] {
  const known = RELATIONSHIP_KINDS.find((k) => k.key === type)
  return known ? known.tone : 'quiet'
}

/** Считается ли ключ «дефолтным» (не требует кастомной пометки). */
export function isDefaultRelationshipKey(type: string): boolean {
  return DEFAULT_RELATIONSHIP_KEYS.includes(type as RelationshipKindKey)
}
