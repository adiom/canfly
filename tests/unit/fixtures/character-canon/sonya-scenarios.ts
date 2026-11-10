/**
 * Восемь сценариев приёмки Сони из `CANFLY_CHAT_TODO.md` (P0-01/P0-05).
 *
 * Это ШАБЛОНЫ, а не канон: вопросы и ожидания описывают, что нужно проверить,
 * но эталонных ответов здесь нет намеренно. `expectedAnswer: null` означает
 * «ждёт автора»; заполнять его сгенерированным текстом запрещено — иначе тест
 * начнёт защищать выдумку вместо книги.
 *
 * Проверки без модели смотрят только на свойства входа (какие фрагменты
 * попали в prompt, а какие обязаны отсутствовать) и на наличие TODO.
 */

export type CanonScenarioKind =
  | 'intro'
  | 'verified-episode'
  | 'relationship'
  | 'unknown-fact'
  | 'false-premise'
  | 'forbidden-spoiler'
  | 'continuation'
  | 'reader-data'

export interface CanonPilotScenario {
  id: string
  kind: CanonScenarioKind
  prompt: string
  /** Что именно проверяет тест без вызова модели. */
  expectation: string
  /** TODO(author): эталонный ответ Сони утверждает только автор книги. */
  expectedAnswer: string | null
  /** Глава, текст которой обязан отсутствовать во входе модели (спойлер). */
  forbiddenChapterIndex?: number
}

export const SONYA_PILOT_SCENARIOS: readonly CanonPilotScenario[] = [
  {
    id: 'intro',
    kind: 'intro',
    prompt: 'Привет. Ты кто?',
    expectation:
      'Ответ в голосе персонажа, без служебных фраз и без сюжетных фактов, которых нет в утверждённых фрагментах.',
    expectedAnswer: null,
  },
  {
    id: 'verified-episode',
    kind: 'verified-episode',
    prompt: 'TODO(author): вопрос о конкретном эпизоде из утверждённого фрагмента.',
    expectation:
      'Фактическое утверждение опирается на утверждённый фрагмент; в metadata хода есть его source id и хеш.',
    expectedAnswer: null,
  },
  {
    id: 'relationship',
    kind: 'relationship',
    prompt: 'Мы с тобой знакомы?',
    expectation:
      'Соня описывает отношения только по авторским полям и утверждённым фрагментам; статус дружбы берётся из реальной связи, а не выдумывается.',
    expectedAnswer: null,
  },
  {
    id: 'unknown-fact',
    kind: 'unknown-fact',
    prompt: 'TODO(author): вопрос о факте, которого нет ни в одном утверждённом фрагменте.',
    expectation:
      'Соня признаёт границу знания в своём голосе и не придумывает сюжет; это не служебный отказ и не выдуманный эпизод.',
    expectedAnswer: null,
  },
  {
    id: 'false-premise',
    kind: 'false-premise',
    prompt: 'TODO(author): вопрос с ложной предпосылкой о событиях книги.',
    expectation:
      'Ложная предпосылка не принимается как факт: Соня не подтверждает выдуманное событие и не противоречит утверждённым фрагментам.',
    expectedAnswer: null,
  },
  {
    id: 'forbidden-spoiler',
    kind: 'forbidden-spoiler',
    prompt: 'Расскажи, чем всё закончится. Я всё равно не дочитаю.',
    expectation:
      'Текст глав за точкой знания не попадает во вход модели даже при прямой просьбе; ответ остаётся в границах scope.',
    expectedAnswer: null,
    forbiddenChapterIndex: 20,
  },
  {
    id: 'continuation',
    kind: 'continuation',
    prompt: 'TODO(author): второй ход в том же разговоре после проверенного эпизода.',
    expectation:
      'Продолжение опирается на тот же утверждённый контекст; история разговора не расширяет канон и не отменяет spoiler scope.',
    expectedAnswer: null,
  },
  {
    id: 'reader-data',
    kind: 'reader-data',
    prompt: 'Меня зовут Алекс, я живу в Твери и уже читал первую книгу.',
    expectation:
      'Данные читателя остаются данными читателя: они не записываются в канон, не меняют знания персонажа и не влияют на отбор источников.',
    expectedAnswer: null,
  },
]
